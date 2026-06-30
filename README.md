# 🌶️ Spicy Lyrics Custom Server (Cloud Edition)

A blazing-fast, intelligent, and **cloud-ready** custom lyrics server designed specifically for the **Spicy Lyrics** plugin in Spicetify. Host your own `.lrc` and `.ttml` lyrics files directly in **Vercel Blob** using a built-in, secure Admin Panel!

## ✨ Features

- **Built-in Admin Panel 🛡️**: Easily upload `.lrc` and `.ttml` files via a drag-and-drop web interface at `/admin`, protected by your secret password.
- **Vercel Blob Integration ☁️**: Your lyrics are securely stored in the cloud. No more manual redeploys just to add a new song!
- **Intelligent Fuzzy Search 🧠**: You don't need to know the exact Spotify Track ID. You don't even need to name the file perfectly! The server searches for the right lyrics using a smart fallback system:
  1. Matches exact **Spotify ID** (e.g. `<ID>.ttml`).
  2. Matches **Artist - Title**.
  3. **Fuzzy Search (Artist + Title)**: Ignores special characters and finds files that contain both the song title and at least one of the artists (e.g. `[OFFICIAL] Kanye West - JESSE (Live).ttml`).
  4. **Fuzzy Search (Title only)**: Fallback search if only the title matches the filename.
- **Enterprise-Grade Security**: Features timing-safe password comparison, strict rate-limiting, and filename sanitization to protect your cloud storage.

## 🚀 How to Deploy (Vercel)

This server is designed to be hosted 24/7 for **free** on Vercel.

1. Clone or fork this repository.
2. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New -> Project**.
3. Import your repository and click **Deploy**.
4. Once deployed, go to the **Storage** tab in Vercel and create a new **Blob** database. **Make sure to set it to Public!**
5. Go to your project's **Settings -> Environment Variables** and add a new secret:
   - Key: `ADMIN_PASSWORD`
   - Value: `twoje_super_tajne_haslo` (This will be used to log into the Admin Panel)
6. Go back to your project's **Deployments** tab and click the three dots (...) on the top deployment, then select **Redeploy** to apply the new database and password.

## ⚙️ Connecting to Spicy Lyrics

Once your server is running on Vercel, link it to your Spotify client:

1. Open **Spotify** (with Spicetify & Spicy Lyrics installed).
2. Go to the **Spicy Lyrics Settings** by clicking on the plugin settings icon.
3. Scroll down to **Add Custom Server**.
4. Enter a name (e.g., `My Server`).
5. Enter your Vercel URL, making sure to append `/api/lyrics` at the end!
   - Example: `https://your-project-name.vercel.app/api/lyrics`
6. Click **Add** and move your server up in the priority list!

## 📁 Adding New Lyrics

Whenever you want to add new lyrics to your server:
1. Go to your Admin Panel in the browser: `https://your-project-name.vercel.app/admin`
2. Enter your secret `ADMIN_PASSWORD`.
3. Drag and drop your `.lrc` or `.ttml` files into the box and click **Wgraj do chmury**.
4. Play the song on Spotify — the plugin will fetch your new lyrics instantly!

---
*Built to enhance the Spicetify and Spicy Lyrics experience.*
