const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());

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

app.get('/api/lyrics/:id', async (req, res) => {
    // Sanitize trackId to prevent path traversal
    const trackId = path.basename(req.params.id);
    const title = req.query.title;
    const artist = req.query.artist;

    const ttmlById = path.join(LYRICS_DIR, `${trackId}.ttml`);
    const lrcById = path.join(LYRICS_DIR, `${trackId}.lrc`);

    let ttmlByName = null;
    let lrcByName = null;
    
    if (artist && title) {
        const safeArtist = artist.replace(/[/\\?%*:|"<>]/g, '');
        const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '');
        ttmlByName = path.join(LYRICS_DIR, `${safeArtist} - ${safeTitle}.ttml`);
        lrcByName = path.join(LYRICS_DIR, `${safeArtist} - ${safeTitle}.lrc`);
    }

    if (await fileExists(ttmlById)) {
        res.type('text/xml');
        return res.send(await fsPromises.readFile(ttmlById, 'utf8'));
    } else if (await fileExists(lrcById)) {
        res.type('text/plain');
        return res.send(await fsPromises.readFile(lrcById, 'utf8'));
    } else if (ttmlByName && await fileExists(ttmlByName)) {
        res.type('text/xml');
        return res.send(await fsPromises.readFile(ttmlByName, 'utf8'));
    } else if (lrcByName && await fileExists(lrcByName)) {
        res.type('text/plain');
        return res.send(await fsPromises.readFile(lrcByName, 'utf8'));
    }

    try {
        const files = await fsPromises.readdir(LYRICS_DIR);
        
        // Szukanie po Artyście + Tytule
        if (artist && title) {
            const searchStr1 = `${artist} ${title}`.toLowerCase().replace(/[^a-z0-9]/g, '');
            const searchStr2 = `${title} ${artist}`.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            for (const file of files) {
                const fileClean = file.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (fileClean.includes(searchStr1) || fileClean.includes(searchStr2)) {
                    const p = path.join(LYRICS_DIR, file);
                    if (file.endsWith('.ttml')) {
                        res.type('text/xml');
                        return res.send(await fsPromises.readFile(p, 'utf8'));
                    } else if (file.endsWith('.lrc')) {
                        res.type('text/plain');
                        return res.send(await fsPromises.readFile(p, 'utf8'));
                    }
                }
            }
        }

        // Szukanie po samym Tytule piosenki
        if (title) {
            const titleStr = title.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            for (const file of files) {
                const fileClean = file.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (fileClean.includes(titleStr)) {
                    const p = path.join(LYRICS_DIR, file);
                    if (file.endsWith('.ttml')) {
                        res.type('text/xml');
                        return res.send(await fsPromises.readFile(p, 'utf8'));
                    } else if (file.endsWith('.lrc')) {
                        res.type('text/plain');
                        return res.send(await fsPromises.readFile(p, 'utf8'));
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error reading lyrics directory:', e);
    }

    res.status(404).send('Lyrics not found');
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Serwer z tekstami piosenek działa pod adresem: http://localhost:${PORT}`);
        console.log(`Wrzuć pliki ${'<ID>'}.lrc lub ${'<ID>'}.ttml do folderu: ${LYRICS_DIR}`);
    });
}

module.exports = app;