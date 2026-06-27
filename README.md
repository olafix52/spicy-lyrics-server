# 🌶️ Spicy Lyrics Custom Server

A lightweight, blazing-fast, and intelligent custom lyrics server designed specifically for the **Spicy Lyrics** plugin in Spicetify. Host your own `.lrc` and `.ttml` lyrics files and stream them directly to your Spotify client!

## ✨ Features

- **Multi-format Support**: Seamlessly serves both `.lrc` (unsynced/synced) and `.ttml` (word-by-word) lyrics formats.
- **Smart File Matching**: You don't need to know the exact Spotify Track ID. The server intelligently searches for the right lyrics using a 4-step fallback system:
  1. Matches exact **Spotify ID** (`<ID>.ttml` or `<ID>.lrc`).
  2. Matches **Artist - Title** (e.g., `Rick Astley - Never Gonna Give You Up.lrc`).
  3. **Fuzzy Search (Artist + Title)**: Scans the entire directory for files containing both the artist and the song title.
  4. **Fuzzy Search (Title only)**: Fallback search if only the title matches the filename.
- **Cloud Ready**: Configured out-of-the-box for instant deployment to Vercel Serverless Functions.

## 🚀 How to Deploy (Vercel)

The easiest way to host this server 24/7 for free is by deploying it to [Vercel](https://vercel.com).

1. Install the Vercel CLI and login:
   ```bash
   npx vercel login
   ```
2. Deploy to production:
   ```bash
   npx vercel --prod
   ```
3. Vercel will provide you with a production URL (e.g., `https://spicy-lyrics-server.vercel.app`).

## ⚙️ Connecting to Spicy Lyrics

Once your server is running (either locally or on Vercel), you need to link it to your Spotify client:

1. Open **Spotify** (with Spicetify & Spicy Lyrics installed).
2. Go to the **Spicy Lyrics Settings** by clicking on the plugin settings icon.
3. Scroll down to **Add Custom Server**.
4. Enter a name (e.g., `My Server`).
5. Enter your server URL, making sure to append `/api/lyrics` at the end!
   - Example: `https://spicy-lyrics-server.vercel.app/api/lyrics`
   - Local example: `http://localhost:3000/api/lyrics`
6. Click **Add** and move your server up in the priority list!

## 📁 Adding New Lyrics

Whenever you want to add new lyrics to your server:
1. Drop your `.lrc` or `.ttml` files into the `lyrics/` directory.
2. (If using Vercel) Run `npx vercel --prod` to push your new files to the cloud.
3. Play the song on Spotify — the plugin will fetch your new lyrics automatically!

---
*Built to enhance the Spicetify and Spicy Lyrics experience.*