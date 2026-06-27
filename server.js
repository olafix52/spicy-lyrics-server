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

app.get('/api/lyrics/:id', (req, res) => {
    const trackId = req.params.id;
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

    if (fs.existsSync(ttmlById)) {
        res.type('text/xml');
        return res.send(fs.readFileSync(ttmlById, 'utf8'));
    } else if (fs.existsSync(lrcById)) {
        res.type('text/plain');
        return res.send(fs.readFileSync(lrcById, 'utf8'));
    } else if (ttmlByName && fs.existsSync(ttmlByName)) {
        res.type('text/xml');
        return res.send(fs.readFileSync(ttmlByName, 'utf8'));
    } else if (lrcByName && fs.existsSync(lrcByName)) {
        res.type('text/plain');
        return res.send(fs.readFileSync(lrcByName, 'utf8'));
    }

    try {
        const files = fs.readdirSync(LYRICS_DIR);
        
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
                        return res.send(fs.readFileSync(p, 'utf8'));
                    } else if (file.endsWith('.lrc')) {
                        res.type('text/plain');
                        return res.send(fs.readFileSync(p, 'utf8'));
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
                        return res.send(fs.readFileSync(p, 'utf8'));
                    } else if (file.endsWith('.lrc')) {
                        res.type('text/plain');
                        return res.send(fs.readFileSync(p, 'utf8'));
                    }
                }
            }
        }
    } catch (e) {
        console.error(e);
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