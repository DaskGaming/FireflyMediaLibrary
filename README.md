# Firefly Media Library

A Netflix-style local media frontend for Steam Deck. Browse and play your Movies, TV Shows, and Videos through a clean interface — no internet required, no subscriptions.  Disclaimer: this program was created with the assistance of Cluade AI.

---

## Features

- **Movies** — poster grid with TMDb genre filtering and full detail view
- **TV Shows** — season and episode browser with artwork and thumbnails
- **Videos** — folder-based library for home videos, concerts, recordings
- **Genres** — browse all content by genre in horizontal scrolling rows (TMDb order)
- **Collections** — auto-detected from folder names (e.g. "Marvel Collection")
- **Search** — searches Movies, TV Shows, and Videos simultaneously
- **VLC playback** — launches VLC fullscreen with resume-where-you-left-off
- **Sleep-safe** — prevents display sleep during playback, cleanly stops VLC on Deck sleep
- **Steam Deck optimised** — large touch targets, Web Browser controller layout, Game Mode ready

---

## Requirements

- Steam Deck (or any Linux system)
- VLC (installed automatically by the install script)
- Your media files on internal storage or SD card

---

## Installation

### Step 1 — Download the release files

Go to the [Releases](../../releases) page and download both files:

- `Firefly-Media-Library-linux-x64.zip`
- `install.sh`

Place both files in the **same folder**.

---

### Step 2 — Run the installer (Desktop Mode)

Switch your Steam Deck to **Desktop Mode** (Steam button → Power → Switch to Desktop).

Open **Konsole** and run:

```bash
cd ~/Downloads
bash install.sh
```

The installer will:
1. Install VLC via Flatpak if not already present
2. Extract the app to `~/firefly-media-library/`
3. Create a desktop shortcut
4. Create `steam-launch.sh` for adding to Steam

---

### Step 3 — Add to Steam

1. Open **Steam** in Desktop Mode
2. Click **Games → Add a Non-Steam Game to My Library**
3. Click **Browse** and navigate to:
   ```
   /home/deck/firefly-media-library/steam-launch.sh
   ```
4. Click **Add Selected Programs**
5. Right-click the entry → **Properties**
6. Rename it to `Firefly Media Library`
7. In **Launch Options** add:
   ```
   --no-sandbox --disable-gpu-sandbox
   ```
8. Under **Controller**, set layout to **Web Browser**

---

### Step 4 — Configure your media folders

Launch Firefly, tap **⚙ Settings**, and add your media folder paths:

- **Movie Library Folders** — your movies
- **TV Show Library Folders** — your TV shows
- **Video Library Folders** — home videos, concerts, etc.

Click **✓ Save & Refresh Library** when done.

**Common Steam Deck paths:**

| Location | Path |
|---|---|
| Internal Movies | `/home/deck/Movies` |
| Internal TV | `/home/deck/TV Shows` |
| SD card | `/run/media/mmcblk0p1/Movies` *(check exact name in Dolphin)* |

---

## Media Folder Structure

### Movies

```
Movies/
  The Dark Knight (2008)/
    The Dark Knight (2008).mkv
    poster.jpg
    fanart.jpg
    movie.nfo          <- optional metadata
```

### TV Shows

```
TV Shows/
  Breaking Bad/
    poster.jpg         <- show poster
    fanart.jpg         <- show background
    season01-poster.jpg
    Season 1/
      S01E01 - Pilot.mkv
      S01E01 - Pilot-thumb.jpg
    Season 2/
      S02E01 - Seven Thirty-Seven.mkv
```

### Videos

Top-level subfolders become folder cards in the Videos section:

```
Videos/
  Concerts/
    Radiohead Live 2023.mkv
    Radiohead Live 2023.jpg    <- thumbnail (same filename)
  Home Videos/
    2023/
      Holiday.mp4
  Sports/
    Cup Final 2024.mkv
```

### Collections

Name any folder with "Collection" in the name:

```
Movies/
  Marvel Collection/
    Iron Man (2008)/
    The Avengers (2012)/
  The Godfather Collection/
    The Godfather (1972)/
```

---

## Artwork

Firefly reads artwork from your media folders automatically:

| File | Used as |
|---|---|
| `poster.jpg` / `folder.jpg` / `cover.jpg` | Poster |
| `fanart.jpg` / `backdrop.jpg` | Background / fanart |
| `season01-poster.jpg` | Season artwork |
| `S01E01-thumb.jpg` / `S01E01.jpg` | Episode thumbnail |

Use **Kodi**, **tinyMediaManager**, or **Jellyfin** to download artwork automatically. Add a free [TMDB API key](https://www.themoviedb.org/settings/api) in Settings for live metadata fetching.

---

## Resume Watching

Firefly saves your position when VLC closes (after watching more than 30 seconds). The next time you open a movie's detail view, a **Resume (Xm)** button appears. In-progress items also show in the **Continue Watching** row at the top of the Home page.

---

## Sleep / Wake

Firefly prevents the Steam Deck from sleeping while VLC is playing. If you put the Deck to sleep manually during playback, VLC is stopped cleanly and your position is saved automatically.

---

## Building from Source

Requires [Node.js](https://nodejs.org) (LTS).

```bat
REM Windows
build.bat
```

Or individually:

```bash
npm run build-win      # Windows portable exe  ->  dist/
npm run build-linux    # Linux zip for Steam Deck  ->  dist/
npm run build-test     # Unpacked folder for quick testing  ->  dist/linux-unpacked/
```

---

## Configuration Files

| Data | Location |
|---|---|
| Settings | `~/.config/sdml/config.json` |
| Watch history | `~/.local/share/sdml/playback.json` |

Both are preserved when you update via `install.sh`.

---

## Updating

1. Download the new `Firefly-Media-Library-linux-x64.zip` and `install.sh` from Releases
2. Run `bash install.sh` — overwrites the app, preserves settings and watch history

---

## Uninstalling

```bash
rm -rf ~/firefly-media-library
rm ~/.local/share/applications/firefly-media-library.desktop
```

Then remove from your Steam library manually.

---

## Troubleshooting

**Crashes on launch from Steam**
- Check Launch Options: `--no-sandbox --disable-gpu-sandbox`
- Check Controller layout is set to **Web Browser**
- Remove and re-add the game to Steam

**Stuck on loading screen**
- Run `~/firefly-media-library/steam-launch.sh` in terminal to see the error

**No artwork showing**
- Name images `poster.jpg`, `folder.jpg`, or `cover.jpg`
- Or use a scraper (Kodi, tinyMediaManager) to download artwork automatically

**VLC not launching**
- Check VLC path in Settings
- Flatpak VLC: `flatpak run org.videolan.VLC`

---

## License

MIT — free to use, modify, and distribute.
