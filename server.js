const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieSession = require('cookie-session');
const QRCode = require('qrcode');
const store = require('./lib/store');

/* ============================================================
   Westmont Video Portal — self-hosted streaming platform
   Phase 1: Express server + animated landing + themes
   Phase 2: QR-code authenticator landing (no username/password)
   Phase 3: Standalone /qr-reader processing page
   Phase 4: Live auth loop (poll -> verify -> auto redirect)
   Phase 5: /api/videos reads the videos/ folder (Metro grid)
   Phase 6: Per-video description + resource downloads
   Phase 7: Secure /admin section (descriptions, resources,
            code snippets with copy-to-clipboard)
   ============================================================ */

const app = express();

app.use((req, res, next) => {
  const prefixes = ['/.netlify/functions/server.js', '/.netlify/functions/server'];
  for (let i = 0; i < prefixes.length; i++) {
    const p = prefixes[i];
    if (req.url.indexOf(p) === 0) {
      req.url = req.url.slice(p.length) || '/';
      break;
    }
  }
  next();
});
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const LOGO_DIR = path.join(ROOT, 'logo');
const VIDEOS_DIR = process.env.VIDEOS_DIR || path.join(ROOT, 'videos');
const THUMBNAILS_DIR = process.env.THUMBNAILS_DIR || path.join(ROOT, 'thumbnails');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const ON_NETLIFY = Boolean(
  process.env.NETLIFY ||
  process.env.NETLIFY_DEV ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.SITE_ID
);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '2131';
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
const QR_TTL_MS = 120 * 1000; // QR challenge lives for 2 minutes

function cookieSecure() {
  if (process.env.SESSION_SECURE === '1') return true;
  if (process.env.SESSION_SECURE === '0') return false;
  return ON_NETLIFY;
}

/* reverse proxy (Netlify / ngrok / Render) so HTTPS cookies and hosts are correct */
app.set('trust proxy', 1);

function publicOrigin(req) {
  if (PUBLIC_URL) return PUBLIC_URL;
  const proto = req.get('x-forwarded-proto') || req.protocol;
  return `${proto}://${req.get('host')}`;
}

app.use((req, res, next) => {
  const pathOnly = String(req.path || req.url || '').split('?')[0];
  if (req.method === 'POST' && pathOnly === '/api/admin/thumbnail/upload') {
    return express.raw({ type: () => true, limit: '6mb' })(req, res, next);
  }
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(cookieSession({
  name: 'wvp.sid',
  keys: [process.env.SESSION_SECRET || 'westmont-video-portal-dev-secret'],
  maxAge: 1000 * 60 * 60 * 12,
  httpOnly: true,
  sameSite: 'lax',
  secure: cookieSecure()
}));

app.use((req, res, next) => {
  store.bootstrap().then(() => next()).catch(next);
});

app.use((req, res, next) => {
  if (req.session == null) req.session = {};
  next();
});

const QR_PAYLOAD_PREFIX = 'WHUB-SIGNIN:';

function newStudentId() {
  return 'stu-' + crypto.randomBytes(4).toString('hex');
}

function publicStudent(s) {
  if (!s) return null;
  return { id: s.id, name: s.name, email: s.email || '' };
}

function inviteUrlFor(req, key) {
  return `${publicOrigin(req)}/qr-reader?k=${encodeURIComponent(key)}`;
}

function adminStudentView(req, s) {
  return {
    id: s.id,
    name: s.name,
    email: s.email || '',
    inviteKey: s.inviteKey,
    inviteUrl: inviteUrlFor(req, s.inviteKey)
  };
}

async function findByInviteKey(key) {
  const k = String(key || '').trim();
  if (!k) return null;
  const list = await store.getStudents();
  return list.find((s) => s.inviteKey === k) || null;
}

function requireAdmin(req, res) {
  if (!req.session || !req.session.admin) {
    res.status(401).json({ ok: false, error: 'Admin sign-in required.' });
    return false;
  }
  return true;
}

const VIDEO_EXT = new Set(['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v', '.mkv', '.avi']);
const THUMB_EXT = ['.webp', '.jpg', '.jpeg', '.png', '.svg'];
const THUMB_LIBRARY_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const THUMB_UPLOAD_EXT = new Set(['.jpg', '.jpeg', '.png']);
const INTRO_FILE = 'intro.mp4';
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const THUMB_UPLOAD_MAX = 5 * 1024 * 1024;

function isIntroFile(name) {
  return String(name || '').toLowerCase() === INTRO_FILE.toLowerCase();
}

const LOGO_RASTER_EXT = ['.webp', '.png', '.jpg', '.jpeg'];
const LOGO_FALLBACK = 'westmont-hub.svg';
const LOGO_MIME = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function findCustomLogo() {
  const fallback = LOGO_FALLBACK;
  if (!fs.existsSync(LOGO_DIR)) return fallback;
  let files = [];
  try {
    files = fs.readdirSync(LOGO_DIR).filter((f) => {
      if (f.startsWith('.')) return false;
      return LOGO_RASTER_EXT.includes(path.extname(f).toLowerCase());
    });
  } catch (e) {
    return fallback;
  }
  if (!files.length) return fallback;
  const lower = files.map((f) => f.toLowerCase());
  const preferred = ['logo.webp', 'logo.png', 'logo.jpg', 'logo.jpeg'];
  for (let i = 0; i < preferred.length; i++) {
    const idx = lower.indexOf(preferred[i]);
    if (idx !== -1) return files[idx];
  }
  files.sort((a, b) => {
    let ma = 0;
    let mb = 0;
    try { ma = fs.statSync(path.join(LOGO_DIR, a)).mtimeMs; } catch (e) { /* ignore */ }
    try { mb = fs.statSync(path.join(LOGO_DIR, b)).mtimeMs; } catch (e) { /* ignore */ }
    return mb - ma;
  });
  return files[0];
}

function logoFileUrl(file) {
  const name = path.basename(file || LOGO_FALLBACK);
  let v = '';
  try {
    v = '?v=' + Math.floor(fs.statSync(path.join(LOGO_DIR, name)).mtimeMs);
  } catch (e) { /* ignore */ }
  return `/logo/${encodeURIComponent(name)}${v}`;
}

async function resolveLogoName() {
  if (ON_NETLIFY) {
    const manifest = await store.getLogoManifest();
    const named = manifest && typeof manifest.file === 'string' ? path.basename(manifest.file) : '';
    if (named) return named;
  }
  return findCustomLogo();
}

function placeholderThumbSvg(title) {
  const label = String(title || 'Lesson').slice(0, 48);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0068b3"/>
      <stop offset="55%" stop-color="#004a80"/>
      <stop offset="100%" stop-color="#00345c"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#e78943"/>
      <stop offset="100%" stop-color="#e1ad62"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <circle cx="520" cy="70" r="90" fill="rgba(231,137,67,0.18)"/>
  <circle cx="90" cy="300" r="70" fill="rgba(255,255,255,0.08)"/>
  <rect x="36" y="36" width="568" height="288" rx="18" fill="none" stroke="url(#gold)" stroke-width="3" opacity="0.85"/>
  <circle cx="320" cy="155" r="42" fill="rgba(255,255,255,0.14)" stroke="#e1ad62" stroke-width="2"/>
  <polygon points="305,130 305,180 345,155" fill="#ffffff"/>
  <text x="320" y="248" text-anchor="middle" fill="#ffffff" font-family="system-ui,sans-serif" font-size="28" font-weight="800">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
  <text x="320" y="278" text-anchor="middle" fill="#e1ad62" font-family="system-ui,sans-serif" font-size="12" font-weight="700" letter-spacing="1.2">E-LEARNING STREAMING SOLUTION</text>
</svg>`;
}

function findThumbnailFile(basename) {
  for (const ext of THUMB_EXT) {
    const file = basename + ext;
    if (fs.existsSync(path.join(THUMBNAILS_DIR, file))) return file;
  }
  return null;
}

function safeThumbName(name) {
  const file = path.basename(String(name || ''));
  if (!file || file === '.' || file === '..') return '';
  return file;
}

function thumbnailExists(file) {
  if (!file) return false;
  try {
    return fs.existsSync(path.join(THUMBNAILS_DIR, file));
  } catch (e) {
    return false;
  }
}

function resolveThumbnailFile(videoName, entry) {
  const assigned = safeThumbName(entry && entry.thumbnail);
  if (assigned && (ON_NETLIFY || thumbnailExists(assigned))) return assigned;
  const base = path.basename(videoName, path.extname(videoName));
  return findThumbnailFile(base) || (base + '.svg');
}

function thumbnailCacheQuery(file) {
  if (ON_NETLIFY || !file) return '';
  try {
    return '?v=' + Math.floor(fs.statSync(path.join(THUMBNAILS_DIR, file)).mtimeMs);
  } catch (e) {
    return '';
  }
}

function ensureThumbnail(videoName, title, entry) {
  if (ON_NETLIFY) return;
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
  if (safeThumbName(entry && entry.thumbnail) && thumbnailExists(safeThumbName(entry.thumbnail))) return;
  const base = path.basename(videoName, path.extname(videoName));
  if (findThumbnailFile(base)) return;
  const svgPath = path.join(THUMBNAILS_DIR, base + '.svg');
  fs.writeFileSync(svgPath, placeholderThumbSvg(title || humanTitle(videoName)), 'utf8');
}

function thumbnailUrl(videoName, entry) {
  const file = resolveThumbnailFile(videoName, entry);
  return `/thumbnails/${encodeURIComponent(file)}${thumbnailCacheQuery(file)}`;
}

async function listLibraryThumbnails() {
  if (ON_NETLIFY) {
    const manifest = await store.getThumbnailManifest();
    return (Array.isArray(manifest) ? manifest : [])
      .map((item) => (typeof item === 'string' ? item : (item && item.name)))
      .filter((name) => name && THUMB_LIBRARY_EXT.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((name) => ({
        name,
        url: `/thumbnails/${encodeURIComponent(name)}`
      }));
  }
  if (!fs.existsSync(THUMBNAILS_DIR)) return [];
  return fs.readdirSync(THUMBNAILS_DIR)
    .filter((f) => THUMB_LIBRARY_EXT.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => ({
      name,
      url: `/thumbnails/${encodeURIComponent(name)}${thumbnailCacheQuery(name)}`
    }));
}

function looksLikeJpeg(buf) {
  return Buffer.isBuffer(buf) && buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function looksLikePng(buf) {
  return Buffer.isBuffer(buf) && buf.length > 7 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a;
}

async function findLessonVideo(videoId) {
  const videos = await listVideos({ includeIntro: true });
  return videos.find((v) => v.id === videoId || v.name === videoId) || null;
}

async function saveAssignedThumbnail(videoId, thumbnailName) {
  const m = await store.getMeta();
  const prev = m[videoId] && typeof m[videoId] === 'object' ? m[videoId] : {};
  m[videoId] = Object.assign({}, prev, { thumbnail: thumbnailName });
  await store.saveMeta(m);
  return m[videoId];
}

function humanTitle(filename) {
  const base = path.basename(filename, path.extname(filename));
  if (/^intro$/i.test(base)) return 'Course Introduction';
  const part = base.match(/^(\d+)\s*\((\d+)\)$/);
  if (part) return 'Lesson ' + part[1] + ' — Part ' + part[2];
  const num = base.match(/^(\d+)/);
  if (num && base.length === num[1].length) return 'Lesson ' + num[1];
  return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function listVideos(opts) {
  opts = opts || {};
  const includeIntro = Boolean(opts.includeIntro);
  const m = await store.getMeta();
  let files = [];

  if (ON_NETLIFY || !fs.existsSync(VIDEOS_DIR)) {
    const manifest = await store.getVideoManifest();
    files = (Array.isArray(manifest) ? manifest : [])
      .filter((item) => item && item.name && VIDEO_EXT.has(path.extname(item.name).toLowerCase()))
      .map((item) => ({
        name: item.name,
        size: Number(item.size) || 0,
        mtimeMs: Number(item.mtimeMs) || 0
      }));
  } else if (fs.existsSync(VIDEOS_DIR)) {
    files = fs.readdirSync(VIDEOS_DIR)
      .filter((f) => VIDEO_EXT.has(path.extname(f).toLowerCase()))
      .map((name) => {
        const st = fs.statSync(path.join(VIDEOS_DIR, name));
        return { name, size: st.size, mtimeMs: st.mtimeMs };
      });
  }

  return files
    .filter((f) => includeIntro || !isIntroFile(f.name))
    .sort((a, b) => {
      const aIntro = isIntroFile(a.name);
      const bIntro = isIntroFile(b.name);
      if (aIntro !== bIntro) return aIntro ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    })
    .map((file, index) => {
      const name = file.name;
      const entry = m[name] || {};
      const title = entry.title || humanTitle(name);
      ensureThumbnail(name, title, entry);
      const thumbFile = resolveThumbnailFile(name, entry);
      return {
        id: name,
        name,
        title,
        description: entry.description || '',
        url: `/videos/${encodeURIComponent(name)}`,
        thumbnail: thumbnailUrl(name, entry),
        thumbnailFile: thumbFile,
        size: file.size,
        mtime: file.mtimeMs,
        duration: Number(entry.duration) || 0,
        level: entry.level || LEVELS[index % LEVELS.length],
        status: entry.status || 'Published',
        resourceUrl: entry.resourceUrl || '',
        snippets: Array.isArray(entry.snippets) ? entry.snippets : []
      };
    });
}

function randomCode(len = 6) {
  const chars = '23456789BCDFGHJKMNPQRTVWXY'; // no ambiguous 0/O/1/I/L
  let s = '';
  for (let i = 0; i < len; i++) s += chars[crypto.randomInt(chars.length)];
  return s;
}

/* ============================================================
   QR authenticator — invite-only in-app scanner
   Desktop QR encodes WHUB-SIGNIN:XXXXXX (not a web URL), so a
   phone Camera app cannot open /qr-reader. Login works only if
   the person opens their unique admin-issued /qr-reader?k= link.
   Desktop: GET /api/qr/challenge -> token + code + QR png
   Phone:   POST /api/qr/verify {code, inviteKey}
   Desktop: GET /api/qr/status?token=  -> pending | verified | expired
   ============================================================ */
app.get('/api/qr/challenge', async (req, res) => {
  try {
    const token = crypto.randomBytes(16).toString('hex');
    const code = randomCode(6);
    const payload = QR_PAYLOAD_PREFIX + code;
    let qr = '';
    try {
      qr = await QRCode.toDataURL(payload, {
        width: 520, margin: 2, errorCorrectionLevel: 'M',
        color: { dark: '#002147', light: '#ffffff' }
      });
    } catch (e) { qr = ''; }
    const entry = { token, code, payload, expiresAt: Date.now() + QR_TTL_MS, studentId: null };
    await store.putChallenge(entry);
    res.json({ ok: true, token, code, qr, expiresIn: Math.round(QR_TTL_MS / 1000) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Could not create a sign-in code.' });
  }
});

app.get('/api/qr/status', async (req, res) => {
  try {
    const c = await store.getChallengeByToken(req.query.token);
    if (!c) return res.json({ status: 'expired' });
    if (!c.studentId) {
      return res.json({ status: 'pending', expiresIn: Math.max(0, Math.round((c.expiresAt - Date.now()) / 1000)) });
    }
    const list = await store.getStudents();
    const stu = list.find((s) => s.id === c.studentId);
    if (!stu) return res.json({ status: 'expired' });
    if (!req.session.studentId) req.session.studentId = stu.id;
    res.json({ status: 'verified', student: publicStudent(stu) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: 'error', error: 'Could not save your sign-in session.' });
  }
});

app.post('/api/qr/verify', async (req, res) => {
  try {
    const { code, inviteKey } = req.body || {};
    const stu = await findByInviteKey(inviteKey);
    if (!stu) {
      return res.status(403).json({
        ok: false,
        error: 'This QR reader link is not valid. Open the unique link you were sent, then scan the desktop code there.'
      });
    }
    const entry = await store.getChallengeByCode(code);
    if (!entry) {
      return res.status(410).json({ ok: false, error: 'This sign-in code has expired. Please show a fresh QR code on the desktop screen.' });
    }
    entry.studentId = stu.id;
    await store.putChallenge(entry);
    res.json({ ok: true, student: publicStudent(stu) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Could not verify sign-in.' });
  }
});

app.get('/api/invite', async (req, res) => {
  try {
    const stu = await findByInviteKey(req.query.k);
    if (!stu) {
      return res.status(403).json({
        ok: false,
        error: 'This sign-in link is invalid or has been revoked. Ask your course admin for a new unique QR-reader link.'
      });
    }
    res.json({ ok: true, student: publicStudent(stu) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Could not check this invite link.' });
  }
});

/* ---------------- students / me ---------------- */
app.get('/api/me', async (req, res) => {
  try {
    const list = await store.getStudents();
    const student = list.find((s) => s.id === req.session.studentId) || null;
    res.json({ student: publicStudent(student), admin: Boolean(req.session.admin) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ student: null, admin: false, error: 'Could not load session.' });
  }
});

app.get('/api/admin/students', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const list = await store.getStudents();
    res.json({ ok: true, students: list.map((s) => adminStudentView(req, s)) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Could not load students.' });
  }
});

app.post('/api/admin/students', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const name = String((req.body && req.body.name) || '').trim().slice(0, 120);
    const email = String((req.body && req.body.email) || '').trim().slice(0, 200);
    if (!name) return res.status(400).json({ ok: false, error: 'Name is required.' });
    const list = await store.getStudents();
    const student = { id: newStudentId(), name, email, inviteKey: store.newInviteKey() };
    list.push(student);
    await store.saveStudents(list);
    res.json({ ok: true, student: adminStudentView(req, student) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Could not create student.' });
  }
});

app.post('/api/admin/students/regenerate', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = String((req.body && req.body.id) || '');
    const list = await store.getStudents();
    const idx = list.findIndex((s) => s.id === id);
    if (idx < 0) return res.status(404).json({ ok: false, error: 'Student not found.' });
    list[idx].inviteKey = store.newInviteKey();
    await store.saveStudents(list);
    res.json({ ok: true, student: adminStudentView(req, list[idx]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Could not refresh invite link.' });
  }
});

app.post('/api/admin/students/delete', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = String((req.body && req.body.id) || '');
    const list = await store.getStudents();
    const next = list.filter((s) => s.id !== id);
    if (next.length === list.length) return res.status(404).json({ ok: false, error: 'Student not found.' });
    await store.saveStudents(next);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Could not remove student.' });
  }
});

/* ---------------- lesson completion progress ---------------- */
const progressAll = () => store.getProgress();

function progressForStudent(map, studentId) {
  if (!studentId) return {};
  const entry = map[studentId];
  return entry && typeof entry === 'object' ? entry : {};
}

function completedVideoIds(map, studentId) {
  const studentMap = progressForStudent(map, studentId);
  return Object.keys(studentMap).filter((id) => studentMap[id] && studentMap[id].completed);
}

app.get('/api/progress', async (req, res) => {
  if (!req.session.studentId) {
    return res.status(401).json({ ok: false, error: 'Sign in required.' });
  }
  try {
    const all = await progressAll();
    const map = progressForStudent(all, req.session.studentId);
    const videos = await listVideos();
    const completed = completedVideoIds(all, req.session.studentId);
    res.json({
      ok: true,
      progress: map,
      completed,
      completedCount: completed.length,
      total: videos.length,
      allComplete: videos.length > 0 && completed.length >= videos.length
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Could not load progress.' });
  }
});

app.post('/api/progress/complete', async (req, res) => {
  if (!req.session.studentId) {
    return res.status(401).json({ ok: false, error: 'Sign in required.' });
  }
  try {
    const videoId = req.body && req.body.videoId;
    if (typeof videoId !== 'string' || !videoId) {
      return res.status(400).json({ ok: false, error: 'videoId is required.' });
    }
    const videos = await listVideos();
    if (!videos.some((v) => v.id === videoId)) {
      return res.status(404).json({ ok: false, error: 'Lesson not found.' });
    }
    const all = await progressAll();
    const sid = req.session.studentId;
    if (!all[sid]) all[sid] = {};
    all[sid][videoId] = { completed: true, completedAt: new Date().toISOString() };
    await store.saveProgress(all);
    const completed = completedVideoIds(all, sid);
    const total = videos.length;
    const allComplete = total > 0 && completed.length >= total;
    res.json({ ok: true, videoId, completed, completedCount: completed.length, total, allComplete });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Could not save progress.' });
  }
});

/* ============================================================
   Phase 5 — video library (reads /videos on every request)
   ============================================================ */
app.get('/api/videos', async (req, res) => {
  const includeIntro = req.query.includeIntro === '1' || req.query.intro === '1';
  const videos = await listVideos({ includeIntro });
  res.json({ videos, count: videos.length });
});

app.get('/api/intro', async (req, res) => {
  const videos = await listVideos({ includeIntro: true });
  const intro = videos.find((v) => isIntroFile(v.name));
  if (!intro) {
    return res.json({
      ok: false,
      thumbnail: '/thumbnails/intro.svg',
      thumbnailFile: 'intro.svg'
    });
  }
  res.json({
    ok: true,
    name: intro.name,
    title: intro.title,
    thumbnail: intro.thumbnail,
    thumbnailFile: intro.thumbnailFile
  });
});

app.get('/api/logo', async (req, res) => {
  const file = await resolveLogoName();
  res.json({
    ok: true,
    file,
    url: logoFileUrl(file),
    mime: LOGO_MIME[path.extname(file).toLowerCase()] || 'image/png'
  });
});

app.get('/api/logo/file', async (req, res) => {
  const file = await resolveLogoName();
  if (ON_NETLIFY) {
    return res.redirect(302, '/logo/' + encodeURIComponent(file));
  }
  const full = path.join(LOGO_DIR, file);
  if (!fs.existsSync(full)) {
    return res.status(404).type('text').send('Logo not found');
  }
  res.setHeader('Content-Type', LOGO_MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(full);
});

/* ============================================================
   Phase 6 + 7 — per-video meta (description, resource, snippets)
   ============================================================ */
app.get('/api/meta', async (req, res) => res.json({ meta: await store.getMeta() }));

app.post('/api/meta', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { video, title, description, resourceUrl, snippets } = req.body || {};
  if (typeof video !== 'string' || !video) return res.status(400).json({ ok: false, error: 'video is required' });
  const lesson = await findLessonVideo(video);
  if (!lesson) {
    return res.status(404).json({ ok: false, error: 'Lesson not found: ' + video });
  }
  const m = await store.getMeta();
  const prev = m[video] && typeof m[video] === 'object' ? m[video] : {};
  m[video] = Object.assign({}, prev, {
    title: typeof title === 'string' ? title.slice(0, 200) : '',
    description: typeof description === 'string' ? description.slice(0, 4000) : '',
    resourceUrl: typeof resourceUrl === 'string' ? resourceUrl.slice(0, 2000) : '',
    snippets: Array.isArray(snippets)
      ? snippets.filter((s) => s && typeof s.code === 'string' && s.code.trim()).slice(0, 20).map((s) => ({
          title: String(s.title || 'Snippet').slice(0, 120),
          type: String(s.type || s.lang || 'code').slice(0, 40),
          code: String(s.code).slice(0, 50000)
        }))
      : []
  });
  await store.saveMeta(m);
  res.json({ ok: true, video, meta: m[video] });
});

app.get('/api/admin/thumbnails', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ ok: true, thumbnails: await listLibraryThumbnails() });
});

app.post('/api/admin/thumbnail', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const video = typeof req.body?.video === 'string' ? req.body.video : '';
  const thumbnail = safeThumbName(req.body && req.body.thumbnail);
  if (!video) return res.status(400).json({ ok: false, error: 'video is required' });
  if (!thumbnail) return res.status(400).json({ ok: false, error: 'thumbnail is required' });
  if (!THUMB_LIBRARY_EXT.has(path.extname(thumbnail).toLowerCase())) {
    return res.status(400).json({ ok: false, error: 'Choose a JPG, PNG, or WebP image.' });
  }
  const lesson = await findLessonVideo(video);
  if (!lesson) return res.status(404).json({ ok: false, error: 'Lesson not found: ' + video });
  if (!ON_NETLIFY && !thumbnailExists(thumbnail)) {
    return res.status(404).json({ ok: false, error: 'Thumbnail file not found: ' + thumbnail });
  }
  const meta = await saveAssignedThumbnail(video, thumbnail);
  res.json({
    ok: true,
    video,
    thumbnail,
    thumbnailUrl: thumbnailUrl(video, meta),
    thumbnailFile: thumbnail
  });
});

app.post('/api/admin/thumbnail/upload', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (ON_NETLIFY) {
    return res.status(400).json({
      ok: false,
      error: 'Uploading new images is not available on this host. Place JPG/PNG files in the thumbnails folder, then assign them here.'
    });
  }
  const video = typeof req.query.video === 'string' ? req.query.video : '';
  const original = safeThumbName(req.query.name);
  const ext = path.extname(original).toLowerCase();
  if (!video) return res.status(400).json({ ok: false, error: 'video is required' });
  if (!THUMB_UPLOAD_EXT.has(ext)) {
    return res.status(400).json({ ok: false, error: 'Upload a JPG or PNG image.' });
  }
  const lesson = await findLessonVideo(video);
  if (!lesson) return res.status(404).json({ ok: false, error: 'Lesson not found: ' + video });
  const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!buf.length) return res.status(400).json({ ok: false, error: 'No image data received.' });
  if (buf.length > THUMB_UPLOAD_MAX) {
    return res.status(413).json({ ok: false, error: 'Image is too large (max 5 MB).' });
  }
  if (ext === '.png' && !looksLikePng(buf)) {
    return res.status(400).json({ ok: false, error: 'That file is not a valid PNG image.' });
  }
  if ((ext === '.jpg' || ext === '.jpeg') && !looksLikeJpeg(buf)) {
    return res.status(400).json({ ok: false, error: 'That file is not a valid JPG image.' });
  }
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
  const destName = path.basename(video, path.extname(video)) + ext;
  fs.writeFileSync(path.join(THUMBNAILS_DIR, destName), buf);
  for (const other of THUMB_EXT) {
    if (other === ext) continue;
    const rival = path.basename(video, path.extname(video)) + other;
    const rivalPath = path.join(THUMBNAILS_DIR, rival);
    if (fs.existsSync(rivalPath)) {
      try { fs.unlinkSync(rivalPath); } catch (e) { /* ignore */ }
    }
  }
  const meta = await saveAssignedThumbnail(video, destName);
  res.json({
    ok: true,
    video,
    thumbnail: destName,
    thumbnailUrl: thumbnailUrl(video, meta),
    thumbnailFile: destName
  });
});

/* ---------------- admin auth ---------------- */
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== 'string' || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'Wrong admin password.' });
  }
  req.session.admin = true;
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => {
  req.session.admin = false;
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session = null;
  res.clearCookie('wvp.sid');
  res.json({ ok: true });
});

/* ---------------- health ---------------- */
app.get('/healthz', (req, res) => res.json({
  status: 'ok',
  service: 'westmont-video-portal',
  phase: 7,
  host: ON_NETLIFY ? 'netlify' : 'node'
}));

/* ---------------- pages (before static so routes win) ---------------- */
app.get('/qr-reader', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'qr-reader.html')));
app.get('/watch', (req, res) => {
  if (!req.session.studentId) return res.redirect('/');
  res.sendFile(path.join(PUBLIC_DIR, 'watch.html'));
});
app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
app.get('/dashboard', (req, res) => {
  if (req.session.studentId) return res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html'));
  res.redirect('/');
});

/* ---------------- static ---------------- */
app.use('/logo', express.static(LOGO_DIR, { fallthrough: true, index: false, maxAge: '7d' }));
app.use('/thumbnails', express.static(THUMBNAILS_DIR, { fallthrough: true, index: false, maxAge: '1h' }));
app.use('/videos', express.static(VIDEOS_DIR, { fallthrough: true, index: false, maxAge: '1h' }));
app.use(express.static(PUBLIC_DIR));

/* 404 for unknown API routes */
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

async function startLocal() {
  [VIDEOS_DIR, THUMBNAILS_DIR, DATA_DIR].forEach((dir) => {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ignore */ }
  });
  await store.bootstrap();
  app.listen(PORT, () => {
    console.log(`Westmont Video Portal running -> http://localhost:${PORT}  (admin: /admin, password default "2131")`);
    if (PUBLIC_URL) console.log(`PUBLIC_URL (QR codes) -> ${PUBLIC_URL}`);
    console.log(`Videos folder -> ${VIDEOS_DIR}`);
    console.log(`Data folder   -> ${DATA_DIR}`);
  });
}

if (require.main === module) {
  startLocal().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { app, bootstrap: store.bootstrap };