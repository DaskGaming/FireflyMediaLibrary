const { app, BrowserWindow, ipcMain, dialog, globalShortcut, powerMonitor, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execSync } = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG_DIR = path.join(os.homedir(), '.config', 'sdml');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DATA_DIR = path.join(os.homedir(), '.local', 'share', 'sdml');
const PLAYBACK_FILE = path.join(DATA_DIR, 'playback.json');

const DEFAULT_CONFIG = {
  moviePaths: [
    path.join(os.homedir(), 'Movies'),
    path.join(os.homedir(), 'Videos', 'Movies')
  ],
  tvPaths: [
    path.join(os.homedir(), 'TV Shows'),
    path.join(os.homedir(), 'Videos', 'TV Shows')
  ],
  videoPaths: [],
  vlcPath: detectVLC()
};

const VIDEO_EXTS = new Set([
  '.mkv','.mp4','.avi','.mov','.m4v','.wmv','.flv','.ts','.m2ts','.webm',
  '.mpg','.mpeg','.m2v','.divx','.xvid','.ogv','.ogm',
  '.vob','.iso','.rmvb','.rm','.asf','.f4v','.3gp','.3g2',
  '.mxf','.mts','.dv','.qt','.amv','.nsv'
]);
const IMAGE_EXTS = new Set(['.jpg','.jpeg','.png','.webp','.bmp']);

// ── VLC Detection ─────────────────────────────────────────────────────────────
function detectVLC() {
  const candidates = [
    '/usr/bin/vlc',
    '/usr/local/bin/vlc',
    '/app/bin/vlc',
    '/snap/bin/vlc'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    const result = execSync('flatpak list --app --columns=application 2>/dev/null', { encoding: 'utf8', timeout: 3000 });
    if (result.includes('org.videolan.VLC')) return 'flatpak run org.videolan.VLC';
  } catch {}
  return '/usr/bin/vlc';
}

// ── Config Management ─────────────────────────────────────────────────────────
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return { ...DEFAULT_CONFIG, ...data };
    }
  } catch (e) { console.error('Config load error:', e); }
  saveConfig(DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG };
}

function saveConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

// ── Playback Tracking ─────────────────────────────────────────────────────────
function loadPlayback() {
  try {
    if (fs.existsSync(PLAYBACK_FILE)) return JSON.parse(fs.readFileSync(PLAYBACK_FILE, 'utf8'));
  } catch {}
  return { history: {}, inProgress: {} };
}

function savePlayback(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PLAYBACK_FILE, JSON.stringify(data, null, 2));
}

// ── Media Scanner ─────────────────────────────────────────────────────────────
const fsp = fs.promises;
const YEAR_RE = /\((\d{4})\)/;
const EP_RE = /[Ss](\d{1,2})[Ee](\d{1,2})|(\d{1,2})x(\d{1,2})/;
const SEASON_RE = /[Ss]eason\s*(\d{1,2})/i;

function makeId(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = Math.imul(31, h) + str.charCodeAt(i) | 0; }
  return Math.abs(h).toString(16).padStart(8, '0');
}

function cleanTitle(name) {
  return name
    .replace(/\(\d{4}\)/g, '')
    .replace(/[Ss]\d{1,2}[Ee]\d{1,2}/g, '')
    .replace(/\d{1,2}x\d{1,2}/g, '')
    .replace(/[._]/g, ' ')
    .replace(/\s*[-–]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function safeReaddir(dir) {
  try { return await fsp.readdir(dir, { withFileTypes: true }); } catch { return []; }
}

async function safeStat(p) {
  try { return await fsp.stat(p); } catch { return null; }
}

async function parseNFO(folder) {
  try {
    const files = await fsp.readdir(folder);
    const nfo = files.find(f => f.toLowerCase().endsWith('.nfo'));
    if (!nfo) return {};
    const xml = await fsp.readFile(path.join(folder, nfo), 'utf8');
    const get = tag => { const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i')); return m ? m[1].trim() : ''; };
    // Use global flag to collect ALL matching tags (e.g. multiple <genre> entries)
    const getAll = tag => { const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'gi'); return [...xml.matchAll(re)].map(m => m[1].trim()).filter(Boolean); };
    return {
      title: get('title'),
      year: parseInt(get('year')) || null,
      plot: get('plot') || get('outline'),
      rating: parseFloat(get('rating')) || null,
      genre: getAll('genre').join(', '),
      director: get('director'),
      runtime: get('runtime')
    };
  } catch { return {}; }
}

async function findArt(folder) {
  let files = {};
  try {
    for (const f of await fsp.readdir(folder)) {
      const ext = path.extname(f).toLowerCase();
      if (IMAGE_EXTS.has(ext)) files[f.toLowerCase()] = path.join(folder, f);
    }
  } catch { return { poster: null, fanart: null }; }

  const skipWords = ['fanart','background','backdrop','banner','logo','clearlogo','clearart','disc'];
  let poster = null;
  for (const [name, fpath] of Object.entries(files)) {
    const stem = path.basename(name, path.extname(name));
    if (stem.endsWith('-poster') || stem.endsWith('_poster') || name === 'poster.jpg' ||
        name === 'poster.jpeg' || name === 'poster.png' || name === 'folder.jpg' ||
        name === 'cover.jpg' || name === 'movie.jpg') { poster = fpath; break; }
  }
  if (!poster) for (const [name, fpath] of Object.entries(files)) { if (name.includes('poster')) { poster = fpath; break; } }
  if (!poster) for (const [name, fpath] of Object.entries(files)) { if (!skipWords.some(w => name.includes(w))) { poster = fpath; break; } }

  let fanart = null;
  for (const [name, fpath] of Object.entries(files)) {
    if (name.includes('fanart') || name.includes('background') || name.includes('backdrop')) { fanart = fpath; break; }
  }
  return { poster, fanart };
}

async function findSeasonArt(showDir, seasonNum) {
  const padded = String(seasonNum).padStart(2, '0');
  for (const name of [`season${padded}-poster.jpg`,`season${padded}-poster.png`,`season${seasonNum}-poster.jpg`]) {
    const full = path.join(showDir, name);
    if ((await safeStat(full))) return full;
  }
  return null;
}

async function scanMovies(moviePaths) {
  const movies = [];
  for (const base of moviePaths) {
    if (!(await safeStat(base))) continue;
    await walkMovies(base, movies);
  }
  return movies;
}

async function walkMovies(dir, movies) {
  const entries = await safeReaddir(dir);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(dir, entry.name);
    const subEntries = await safeReaddir(fullPath);
    const videoFile = subEntries.find(s => s.isFile() && VIDEO_EXTS.has(path.extname(s.name).toLowerCase()));
    if (videoFile) {
      const vPath = path.join(fullPath, videoFile.name);
      const [nfo, art, st] = await Promise.all([parseNFO(fullPath), findArt(fullPath), safeStat(fullPath)]);
      const year = nfo.year || (YEAR_RE.exec(entry.name) || [])[1];
      movies.push({
        id: makeId(vPath), type: 'movie',
        title: nfo.title || cleanTitle(entry.name) || entry.name,
        year: year ? parseInt(year) : null,
        path: vPath, folder: fullPath,
        addedTs: st ? st.mtimeMs : 0,
        poster: art.poster, fanart: art.fanart,
        plot: nfo.plot || '', rating: nfo.rating,
        genre: nfo.genre || '', director: nfo.director || '', runtime: nfo.runtime || ''
      });
    } else {
      await walkMovies(fullPath, movies);
    }
  }
}

async function scanTV(tvPaths) {
  const shows = [];
  for (const base of tvPaths) {
    if (!(await safeStat(base))) continue;
    const entries = await safeReaddir(base);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const show = await parseShow(path.join(base, entry.name), entry.name);
        if (show) shows.push(show);
      }
    }
  }
  return shows;
}

async function parseShow(showDir, showName) {
  const seasons = {};
  let totalEps = 0;
  const entries = await safeReaddir(showDir);

  for (const entry of entries) {
    const fullPath = path.join(showDir, entry.name);
    if (entry.isDirectory()) {
      const sm = SEASON_RE.exec(entry.name);
      const seasonNum = sm ? parseInt(sm[1]) : 0;
      const seasonKey = sm ? `Season ${seasonNum}` : entry.name;
      const eps = await scanEpisodes(fullPath, seasonNum, showName);
      if (eps.length) {
        const seasonPoster = (await findSeasonArt(showDir, seasonNum)) || (await findArt(fullPath)).poster;
        seasons[seasonKey] = eps;
        seasons[seasonKey]._art = { poster: seasonPoster };
        totalEps += eps.length;
      }
    } else if (VIDEO_EXTS.has(path.extname(entry.name).toLowerCase())) {
      const m = EP_RE.exec(entry.name);
      const sn = m ? parseInt(m[1] || m[3]) : 0;
      const en = m ? parseInt(m[2] || m[4]) : 0;
      const sk = sn ? `Season ${sn}` : 'Unsorted';
      if (!seasons[sk]) seasons[sk] = [];
      seasons[sk].push(await makeEpisode(fullPath, entry.name, sn, en, cleanTitle(showName)));
      totalEps++;
    }
  }

  if (totalEps === 0) return null;
  const [nfo, art, st] = await Promise.all([parseNFO(showDir), findArt(showDir), safeStat(showDir)]);
  return {
    id: makeId(showDir), type: 'tv',
    title: nfo.title || cleanTitle(showName) || showName,
    year: nfo.year || null, path: showDir, seasons,
    seasonCount: Object.keys(seasons).length, episodeCount: totalEps,
    addedTs: st ? st.mtimeMs : 0,
    poster: art.poster, fanart: art.fanart,
    plot: nfo.plot || '', rating: nfo.rating, genre: nfo.genre || ''
  };
}

async function scanEpisodes(seasonDir, defaultSeason, showName) {
  const eps = [];
  const entries = await safeReaddir(seasonDir);
  for (const entry of entries) {
    if (entry.isFile() && VIDEO_EXTS.has(path.extname(entry.name).toLowerCase())) {
      const m = EP_RE.exec(entry.name);
      eps.push(await makeEpisode(
        path.join(seasonDir, entry.name), entry.name,
        m ? parseInt(m[1]||m[3]) : defaultSeason,
        m ? parseInt(m[2]||m[4]) : 0,
        cleanTitle(showName)
      ));
    } else if (entry.isDirectory()) {
      const epDir = path.join(seasonDir, entry.name);
      const subEntries = await safeReaddir(epDir);
      const vEntry = subEntries.find(s => s.isFile() && VIDEO_EXTS.has(path.extname(s.name).toLowerCase()));
      if (vEntry) {
        const vPath = path.join(epDir, vEntry.name);
        const m = EP_RE.exec(entry.name) || EP_RE.exec(vEntry.name);
        eps.push(await makeEpisode(
          vPath, vEntry.name,
          m ? parseInt(m[1]||m[3]) : defaultSeason,
          m ? parseInt(m[2]||m[4]) : 0,
          cleanTitle(showName), epDir
        ));
      }
    }
  }
  return eps.sort((a, b) => a.episode - b.episode);
}

async function makeEpisode(filePath, filename, season, episode, showName, epDir) {
  const stem = path.basename(filename, path.extname(filename));
  const dir = epDir || path.dirname(filePath);

  let nfo = {};
  try {
    const xml = await fsp.readFile(path.join(dir, stem + '.nfo'), 'utf8');
    const get = tag => { const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')); return m ? m[1].replace(/<[^>]*>/g,'').trim() : ''; };
    nfo = { title: get('title'), plot: get('plot') || get('outline'), rating: parseFloat(get('rating')) || null };
  } catch {}

  let thumb = null;
  if (epDir) { const art = await findArt(epDir); thumb = art.poster || art.fanart; }
  if (!thumb) {
    for (const ext of ['-thumb.jpg','-thumb.jpeg','-thumb.png','.jpg','.jpeg','.png']) {
      const c = path.join(dir, stem + ext);
      if (await safeStat(c)) { thumb = c; break; }
    }
  }

  let episodeTitle = nfo.title || '';
  if (!episodeTitle) {
    const cleanedShow = cleanTitle(showName);
    const escapedShow = cleanedShow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s._-]+');
    episodeTitle = stem
      .replace(new RegExp('^' + escapedShow + '[\\s._]*[-–]?[\\s._]*', 'i'), '')
      .replace(/[Ss]\d{1,2}[Ee]\d{1,2}/g,'').replace(/\d{1,2}x\d{1,2}/g,'')
      .replace(/[._]/g,' ').replace(/^\s*[-–]\s*/,'').replace(/\s*[-–]\s*$/,'')
      .replace(/\s+/g,' ').trim();
  }
  if (!episodeTitle) episodeTitle = `Episode ${episode}`;

  const st = await safeStat(filePath);
  const label = `S${String(season).padStart(2,'0')}E${String(episode).padStart(2,'0')}`;
  return {
    id: makeId(filePath), type: 'episode',
    title: `${showName} – ${label}`, episodeTitle, showName,
    season, episode, path: filePath, filename,
    addedTs: st ? st.mtimeMs : 0, plot: nfo.plot || '', poster: thumb
  };
}

// ── Video Scanner ─────────────────────────────────────────────────────────────
async function scanVideos(videoPaths) {
  const videos = [];
  for (const base of (videoPaths || [])) {
    if (!(await safeStat(base))) continue;
    await walkVideos(base, base, videos);
  }
  return videos;
}

async function walkVideos(rootBase, dir, videos) {
  const entries = await safeReaddir(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && VIDEO_EXTS.has(path.extname(entry.name).toLowerCase())) {
      const stem = path.basename(entry.name, path.extname(entry.name));
      // Build category from relative path between rootBase and the file's folder
      const relDir = path.relative(rootBase, dir);
      const category = relDir ? relDir.split(path.sep).join(' / ') : '';
      let thumb = null;
      for (const ext of ['.jpg','.jpeg','.png','.webp']) {
        if (await safeStat(path.join(dir, stem + ext))) { thumb = path.join(dir, stem + ext); break; }
      }
      const st = await safeStat(fullPath);
      videos.push({
        id: makeId(fullPath), type: 'video',
        title: stem.replace(/[._]/g,' ').replace(/\s+/g,' ').trim() || entry.name,
        filePath: fullPath, path: fullPath, category, thumb,
        addedTs: st ? st.mtimeMs : 0
      });
    } else if (entry.isDirectory()) {
      await walkVideos(rootBase, fullPath, videos);
    }
  }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────
let win;
let vlcProc = null;
let psbId = null;          // powerSaveBlocker id
let vlcLaunchTime = null;  // when VLC was started
let vlcStartPos = 0;       // position VLC started from
let vlcItemId = null;      // id of item currently playing

function stopVLC() {
  // Save progress based on elapsed time before killing
  if (vlcProc && vlcLaunchTime && vlcItemId) {
    try {
      const elapsed = (Date.now() - vlcLaunchTime) / 1000;
      const position = vlcStartPos + elapsed;
      const playback = loadPlayback();
      // Only save if watched for more than 30 seconds
      if (elapsed > 30) {
        playback.inProgress[vlcItemId] = {
          position,
          duration: 0,   // unknown without ffprobe
          pct: 0,
          updatedAt: Date.now()
        };
        savePlayback(playback);
      }
    } catch (e) { console.error('stopVLC progress save error:', e); }
  }

  if (vlcProc) {
    try { vlcProc.kill(); } catch {}
    vlcProc = null;
  }

  // Stop preventing sleep
  if (psbId !== null) {
    try { powerSaveBlocker.stop(psbId); } catch {}
    psbId = null;
  }

  vlcLaunchTime = null;
  vlcStartPos = 0;
  vlcItemId = null;

  globalShortcut.unregister('Escape');
  if (win) { win.show(); win.focus(); }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    backgroundColor: '#09090f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      webSecurity: true
    },
    frame: false,
    titleBarStyle: 'hidden',
    // Steam Deck: prevent blank screen under gamescope
    show: false,
  });

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (vlcProc) try { vlcProc.kill(); } catch {}
});

// Steam Deck / gamescope compatibility — must be set before app is ready
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService');

app.whenReady().then(() => {
  createWindow();

  // ── Sleep / Wake handling ───────────────────────────────────────────────────
  powerMonitor.on('suspend', () => {
    console.log('System suspending — stopping VLC and cleaning up');
    if (vlcProc) stopVLC();
    if (win) win.webContents.send('app-suspend');
  });

  powerMonitor.on('resume', () => {
    console.log('System resumed from sleep');
    if (win) {
      win.webContents.send('app-resume');
      setTimeout(() => { if (win) { win.show(); win.focus(); } }, 800);
    }
  });

  // Handle GPU crash on wake — only relaunch if not already in --disable-gpu mode
  app.on('render-process-gone', (e, wc, details) => {
    if (details.reason === 'crashed' && !process.argv.includes('--disable-gpu')) {
      console.error('Renderer crashed, relaunching with --disable-gpu');
      app.relaunch({ args: process.argv.slice(1).concat(['--disable-gpu']) });
      app.exit(0);
    }
  });
});

// Scan media
ipcMain.handle('scan-media', async () => {
  try {
    const cfg = loadConfig();
    const [movies, tv, videos] = await Promise.all([
      scanMovies(cfg.moviePaths || []),
      scanTV(cfg.tvPaths || []),
      scanVideos(cfg.videoPaths || [])
    ]);
    const playback = loadPlayback();

    // Attach progress data
    for (const item of [...movies, ...tv, ...videos]) {
      if (playback.inProgress[item.id]) {
        item.progress = playback.inProgress[item.id];
      }
    }

    // Detect collections
    const collections = {};
    for (const movie of movies) {
      const parts = movie.folder ? movie.folder.split(path.sep) : [];
      const colPart = parts.find(p => /collection/i.test(p));
      if (colPart) {
        const colName = colPart.replace(/collection/i, '').replace(/[-_]/g, ' ').trim() || 'Collection';
        const key = colName || colPart;
        if (!collections[key]) collections[key] = [];
        collections[key].push(movie);
      }
    }

    // Extract all unique genres from movies + tv
    const genreSet = new Set();
    for (const item of [...movies, ...tv]) {
      if (item.genre) {
        item.genre.split(/[,/|]/).map(g => g.trim()).filter(Boolean).forEach(g => genreSet.add(g));
      }
    }
    const genres = Array.from(genreSet).sort();

    return { movies, tv, videos, playback, collections, genres };
  } catch (err) {
    console.error('scan-media error:', err);
    return { movies: [], tv: [], videos: [], playback: { history: {}, inProgress: {} }, collections: {}, genres: [] };
  }
});

// Get config
ipcMain.handle('get-config', () => loadConfig());

// Get playback state only (lightweight — no filesystem scan)
ipcMain.handle('get-playback', () => loadPlayback());

// Save config
ipcMain.handle('save-config', (_, cfg) => {
  saveConfig(cfg);
  return true;
});

// Launch VLC
ipcMain.handle('play', (_, item) => {
  const cfg = loadConfig();
  const playback = loadPlayback();
  const vlcPath = cfg.vlcPath;
  const filePath = item.path;

  if (!fs.existsSync(filePath)) return { error: 'File not found: ' + filePath };

  const args = [
    filePath,
    '--fullscreen',
    '--started-from-file',
    '--no-osd',
    '--qt-minimal-view',
    '--mouse-hide-timeout=1000',
  ];
  const resumePos = item.resumePosition || 0;
  if (resumePos > 10) args.push('--start-time', String(Math.floor(resumePos)));

  // Track launch
  playback.history[item.id] = {
    title: item.title,
    launchedAt: Date.now(),
    type: item.type
  };
  savePlayback(playback);

  // Launch VLC - handle flatpak wrapper
  let proc;
  if (vlcPath.startsWith('flatpak run')) {
    const parts = vlcPath.split(' ');
    proc = spawn(parts[0], [...parts.slice(1), ...args], { detached: true, stdio: 'ignore' });
  } else {
    proc = spawn(vlcPath, args, { detached: true, stdio: 'ignore' });
  }

  vlcProc = proc;
  vlcLaunchTime = Date.now();
  vlcStartPos = resumePos;
  vlcItemId = item.id;

  // Prevent Steam Deck from sleeping during playback
  try {
    psbId = powerSaveBlocker.start('prevent-display-sleep');
  } catch (e) { console.error('powerSaveBlocker error:', e); }

  // Register Escape globally so it works even while VLC has focus
  globalShortcut.register('Escape', () => stopVLC());

  proc.on('close', () => {
    // Save progress based on elapsed time
    if (vlcLaunchTime && vlcItemId) {
      try {
        const elapsed = (Date.now() - vlcLaunchTime) / 1000;
        const position = vlcStartPos + elapsed;
        const pb = loadPlayback();
        if (elapsed > 30) {
          pb.inProgress[vlcItemId] = {
            position,
            duration: 0,
            pct: 0,
            updatedAt: Date.now()
          };
        }
        savePlayback(pb);
      } catch (e) { console.error('VLC close progress save error:', e); }
    }

    vlcProc = null;
    vlcLaunchTime = null;
    vlcStartPos = 0;
    vlcItemId = null;

    // Stop preventing sleep
    if (psbId !== null) {
      try { powerSaveBlocker.stop(psbId); } catch {}
      psbId = null;
    }

    globalShortcut.unregister('Escape');
    if (win) {
      win.show();
      win.focus();
      win.webContents.send('vlc-closed');
    }
  });

  return { ok: true };
});

// Stop VLC from the UI (e.g. a stop button)
ipcMain.handle('stop-playback', () => {
  stopVLC();
  return true;
});

// Update watch progress
ipcMain.handle('update-progress', (_, { id, position, duration }) => {
  const playback = loadPlayback();
  const pct = duration > 0 ? (position / duration) * 100 : 0;
  if (pct >= 95) {
    delete playback.inProgress[id];
  } else {
    playback.inProgress[id] = { position, duration, pct, updatedAt: Date.now() };
  }
  savePlayback(playback);
  return true;
});

// Browse folder dialog
ipcMain.handle('browse-folder', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

// Quit / fullscreen toggle
ipcMain.handle('quit', () => app.quit());
ipcMain.handle('toggle-fullscreen', () => {
  win.setFullScreen(!win.isFullScreen());
  return win.isFullScreen();
});
