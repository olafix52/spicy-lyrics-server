const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { put, list } = require('@vercel/blob');

const app = express();
const PORT = 3000;

// Multer in-memory storage for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Restrict CORS to Spotify and local development origins
const allowedOrigins = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /\.spotify\.com$/,
    /\.spicetify\.app$/,
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. Spicetify desktop client, curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.some((pattern) => pattern.test(origin))) {
            return callback(null, true);
        }
        return callback(null, false);
    },
}));

// Simple in-memory rate limiter (per IP, 60 requests per minute)
const rateLimit = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 60;

app.use((req, res, next) => {
    // Skip rate limiting for admin panel upload actions
    if (req.path === '/api/upload') return next();

    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const entry = rateLimit.get(ip);

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimit.set(ip, { windowStart: now, count: 1 });
        return next();
    }

    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Too many requests. Try again later.' });
    }

    return next();
});

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimit) {
        if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
            rateLimit.delete(ip);
        }
    }
} , 5 * 60 * 1000);

const LYRICS_DIR = path.join(__dirname, 'lyrics');

try {
    if (!fs.existsSync(LYRICS_DIR)) {
        if (!process.env.VERCEL) {
            fs.mkdirSync(LYRICS_DIR);
        }
    }
} catch (e) {
    console.warn("Nie mozna utworzyc folderu lyrics (prawdopodobnie chmura read-only):", e.message);
}

const fsPromises = fs.promises;

async function fileExists(filePath) {
    try {
        await fsPromises.access(filePath);
        return true;
    } catch {
        return false;
    }
}

// Ensure a resolved path stays within LYRICS_DIR
function isSafePath(filePath) {
    const resolved = path.resolve(filePath);
    return resolved.startsWith(path.resolve(LYRICS_DIR) + path.sep) || resolved === path.resolve(LYRICS_DIR);
}

async function sendLyricsFile(filePath, type, res) {
    if (!isSafePath(filePath)) return false;
    if (await fileExists(filePath)) {
        res.type(type);
        res.send(await fsPromises.readFile(filePath, 'utf8'));
        return true;
    }
    return false;
}

app.get('/', (req, res) => {
    res.send('<html><body style="font-family: sans-serif; text-align: center; margin-top: 50px;"><h1>Spicy Lyrics Server jest aktywny! 🌶️</h1><p>Twój serwer działa poprawnie. Użyj wtyczki Spicy Lyrics w Spotify, aby z niego korzystać.</p></body></html>');
});

// ADMIN PANEL ROUTES
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        const password = req.headers.authorization;
        const correctPassword = process.env.ADMIN_PASSWORD;

        if (!correctPassword) {
            return res.status(500).json({ error: 'Brak zmiennej ADMIN_PASSWORD na serwerze.' });
        }
        if (password !== correctPassword) {
            return res.status(401).json({ error: 'Nieprawidłowe hasło.' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Nie przesłano plików.' });
        }

        const uploads = [];
        for (const file of req.files) {
            if (!file.originalname.endsWith('.lrc') && !file.originalname.endsWith('.ttml')) {
                continue;
            }
            
            // Upload to Vercel Blob
            const blob = await put(file.originalname, file.buffer, { 
                access: 'public',
                addRandomSuffix: false // Nadpisuje istniejące pliki o tej samej nazwie
            });
            uploads.push(blob.url);
        }

        res.json({ success: true, uploaded: uploads.length });
    } catch (e) {
        console.error('Upload error:', e);
        res.status(500).json({ error: e.message });
    }
});

// MAIN LYRICS API
app.get('/api/lyrics/:id', async (req, res) => {
    try {
        // Sanitize trackId to prevent path traversal
        const trackId = path.basename(req.params.id);
        const title = req.query.title;
        const artist = req.query.artist;

        const ttmlById = path.join(LYRICS_DIR, `${trackId}.ttml`);
        const lrcById = path.join(LYRICS_DIR, `${trackId}.lrc`);

        // 1. Search by exact Spotify ID
        if (await sendLyricsFile(ttmlById, 'text/xml', res)) return;
        if (await sendLyricsFile(lrcById, 'text/plain', res)) return;

        // 2. Search by "Artist - Title" filename
        if (artist && title) {
            // Use path.basename to strip any traversal from artist/title
            const safeArtist = path.basename(artist.replace(/[/\\?%*:|"<>]/g, ''));
            const safeTitle = path.basename(title.replace(/[/\\?%*:|"<>]/g, ''));

            const ttmlByName = path.join(LYRICS_DIR, `${safeArtist} - ${safeTitle}.ttml`);
            const lrcByName = path.join(LYRICS_DIR, `${safeArtist} - ${safeTitle}.lrc`);

            if (await sendLyricsFile(ttmlByName, 'text/xml', res)) return;
            if (await sendLyricsFile(lrcByName, 'text/plain', res)) return;
        }

        // 3 & 4. Fuzzy search in the local lyrics directory
        let files = [];
        try {
            files = await fsPromises.readdir(LYRICS_DIR);
        } catch (err) {
            // Directory doesn't exist on Vercel
        }

        // 3. Local Fuzzy search by Artist + Title
        if (artist && title) {
            const titleClean = title.toLowerCase().replace(/[^a-z0-9]/g, '');
            const artists = artist.split(',').map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ''));

            for (const file of files) {
                const fileClean = file.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (fileClean.includes(titleClean) && artists.some(a => fileClean.includes(a))) {
                    const p = path.join(LYRICS_DIR, file);
                    if (file.endsWith('.ttml') && await sendLyricsFile(p, 'text/xml', res)) return;
                    if (file.endsWith('.lrc') && await sendLyricsFile(p, 'text/plain', res)) return;
                }
            }
        }

        // 4. Local Fuzzy search by Title only
        if (title) {
            const titleStr = title.toLowerCase().replace(/[^a-z0-9]/g, '');

            for (const file of files) {
                const fileClean = file.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (fileClean.includes(titleStr)) {
                    const p = path.join(LYRICS_DIR, file);
                    if (file.endsWith('.ttml') && await sendLyricsFile(p, 'text/xml', res)) return;
                    if (file.endsWith('.lrc') && await sendLyricsFile(p, 'text/plain', res)) return;
                }
            }
        }

        // ----------------------------------------------------
        // 5. BLOB STORAGE FALLBACK
        // Jeśli nie znaleziono lokalnie, szukaj w chmurze
        // ----------------------------------------------------
        try {
            const { blobs } = await list();
            
            // 5a. Exact match
            const exactTtml = blobs.find(b => b.pathname === `${trackId}.ttml`);
            if (exactTtml) {
                const fetchRes = await fetch(exactTtml.url);
                res.type('text/xml');
                return res.send(await fetchRes.text());
            }
            const exactLrc = blobs.find(b => b.pathname === `${trackId}.lrc`);
            if (exactLrc) {
                const fetchRes = await fetch(exactLrc.url);
                res.type('text/plain');
                return res.send(await fetchRes.text());
            }

            // 5b. Artist - Title match
            if (artist && title) {
                const safeArtist = path.basename(artist.replace(/[/\\?%*:|"<>]/g, ''));
                const safeTitle = path.basename(title.replace(/[/\\?%*:|"<>]/g, ''));
                
                const byNameTtml = blobs.find(b => b.pathname === `${safeArtist} - ${safeTitle}.ttml`);
                if (byNameTtml) {
                    const fetchRes = await fetch(byNameTtml.url);
                    res.type('text/xml');
                    return res.send(await fetchRes.text());
                }
                const byNameLrc = blobs.find(b => b.pathname === `${safeArtist} - ${safeTitle}.lrc`);
                if (byNameLrc) {
                    const fetchRes = await fetch(byNameLrc.url);
                    res.type('text/plain');
                    return res.send(await fetchRes.text());
                }
            }

            // 5c. Fuzzy match in Blob
            if (artist && title) {
                const titleClean = title.toLowerCase().replace(/[^a-z0-9]/g, '');
                const artists = artist.split(',').map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ''));

                for (const b of blobs) {
                    const fileClean = b.pathname.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (fileClean.includes(titleClean) && artists.some(a => fileClean.includes(a))) {
                        const fetchRes = await fetch(b.url);
                        res.type(b.pathname.endsWith('.ttml') ? 'text/xml' : 'text/plain');
                        return res.send(await fetchRes.text());
                    }
                }
            } else if (title) {
                const titleStr = title.toLowerCase().replace(/[^a-z0-9]/g, '');
                for (const b of blobs) {
                    const fileClean = b.pathname.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (fileClean.includes(titleStr)) {
                        const fetchRes = await fetch(b.url);
                        res.type(b.pathname.endsWith('.ttml') ? 'text/xml' : 'text/plain');
                        return res.send(await fetchRes.text());
                    }
                }
            }

        } catch (err) {
            console.error('Blob search error:', err);
        }

        res.status(404).send('Lyrics not found');
    } catch (e) {
        console.error('Error handling lyrics request:', e);
        res.status(500).send('Internal server error');
    }
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Serwer z tekstami piosenek działa pod adresem: http://localhost:${PORT}`);
        console.log(`Wrzuć pliki ${'<ID>'}.lrc lub ${'<ID>'}.ttml do folderu: ${LYRICS_DIR}`);
    });
}

module.exports = app;