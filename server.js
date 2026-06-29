const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

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
}, 5 * 60 * 1000);

const LYRICS_DIR = path.join(__dirname, 'lyrics');

if (!fs.existsSync(LYRICS_DIR)) {
    fs.mkdirSync(LYRICS_DIR);
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

        // 3 & 4. Fuzzy search in the lyrics directory
        const files = await fsPromises.readdir(LYRICS_DIR);

        // 3. Fuzzy search by Artist + Title
        if (artist && title) {
            const searchStr1 = `${artist} ${title}`.toLowerCase().replace(/[^a-z0-9]/g, '');
            const searchStr2 = `${title} ${artist}`.toLowerCase().replace(/[^a-z0-9]/g, '');

            for (const file of files) {
                const fileClean = file.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (fileClean.includes(searchStr1) || fileClean.includes(searchStr2)) {
                    const p = path.join(LYRICS_DIR, file);
                    if (file.endsWith('.ttml') && await sendLyricsFile(p, 'text/xml', res)) return;
                    if (file.endsWith('.lrc') && await sendLyricsFile(p, 'text/plain', res)) return;
                }
            }
        }

        // 4. Fuzzy search by Title only
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

        res.status(404).send('Lyrics not found');
    } catch (e) {
        console.error('Error handling lyrics request:', e);
        res.status(500).send('Internal server error');
    }
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Serwer z tekstami piosenek dzia\u0142a pod adresem: http://localhost:${PORT}`);
        console.log(`Wrzu\u0107 pliki ${'<ID>'}.lrc lub ${'<ID>'}.ttml do folderu: ${LYRICS_DIR}`);
    });
}

module.exports = app;