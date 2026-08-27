const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const QRCode = require('qrcode');

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
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const VIDEOS_DIR = path.join(ROOT, 'videos');
const DATA_DIR = path.join(ROOT, 'data');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const QR_TTL_MS = 120 * 1000; // QR challenge lives for 2 minutes

app.use(express.json({ limit: '1mb' }));
app.use(session({
  name: 'wvp.sid',
  secret: process.env.SESSION_SECRET || 'westmont-video-portal-dev-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 12 }
}));

/* ---------------- data helpers ---------------- */
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); }
  catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(value, null, 2));
}
const students = () => readJson('students.json', []);
const meta = () => readJson('meta.json', {});

const VIDEO_EXT = new Set(['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v', '.mkv', '.avi']);
function listVideos() {
  if (!fs.existsSync(VIDEOS_DIR)) return [];
  return fs.readdirSync(VIDEOS_DIR)
    .filter((f) => VIDEO_EXT.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const st = fs.statSync(path.join(VIDEOS_DIR, name));
      return { name, url: `/videos/${encodeURIComponent(name)}`, size: st.size, mtime: st.mtimeMs };
    });
}

/* ---------------- QR challenge store (in-memory) ---------------- */
const challenges = new Map();
function sweepChallenges() {
  const now = Date.now();
  for (const [t, c] of challenges) if (c.expiresAt <= now) challenges.delete(t);
}
function randomCode(len = 6) {
  const chars = '23456789BCDFGHJKMNPQRTVWXY'; // no ambiguous 0/O/1/I/L
  let s = '';
  for (let i = 0; i < len; i++) s += chars[crypto.randomInt(chars.length)];
  return s;
}

/* ============================================================
   Phase 2 — QR-code authenticator (landing page)
   Desktop: GET /api/qr/challenge -> token + 6-char code + QR png
   Phone:   opens /qr-reader?code=XXXXXX (camera scan, email, NFC)
   Phone:   POST /api/qr/verify {code, studentId}
   Desktop: GET /api/qr/status?token=  -> pending | verified | expired
   ============================================================ */
app.get('/api/qr/challenge', async (req, res) => {
  try {
    sweepChallenges();
    const token = crypto.randomBytes(16).toString('hex');
    const code = randomCode(6);
    const origin = `${req.protocol}://${req.get('host')}`;
    const url = `${origin}/qr-reader?code=${code}`;
    let qr = '';
    try {
      qr = await QRCode.toDataURL(url, {
        width: 520, margin: 2, errorCorrectionLevel: 'M',
        color: { dark: '#002147', light: '#ffffff' }
      });
    } catch (e) { qr = ''; }
    const entry = { token, code, url, expiresAt: Date.now() + QR_TTL_MS, studentId: null };
    challenges.set(token, entry);
    res.json({ ok: true, token, code, url, qr, expiresIn: Math.round(QR_TTL_MS / 1000) });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Could not create a sign-in code.' });
  }
});

app.get('/api/qr/status', (req, res) => {
  const c = challenges.get(String(req.query.token || ''));
  if (!c || c.expiresAt <= Date.now()) return res.json({ status: 'expired' });
  if (!c.studentId) {
    return res.json({ status: 'pending', expiresIn: Math.max(0, Math.round((c.expiresAt - Date.now()) / 1000)) });
  }
  const stu = students().find((s) => s.id === c.studentId);
  if (!stu) return res.json({ status: 'expired' });
  if (!req.session.studentId) req.session.studentId = stu.id; // bind desktop session
  res.json({ status: 'verified', student: stu });
});

app.post('/api/qr/verify', (req, res) => {
  const { code, studentId } = req.body || {};
  sweepChallenges();
  const entry = [...challenges.values()].find((c) => c.code === String(code || '').trim().toUpperCase());
  if (!entry || entry.expiresAt <= Date.now()) {
    return res.status(410).json({ ok: false, error: 'This sign-in code has expired. Please show a fresh QR code on the desktop screen.' });
  }
  const stu = students().find((s) => s.id === studentId);
  if (!stu) return res.status(400).json({ ok: false, error: 'Unknown student profile. Choose your profile and try again.' });
  entry.studentId = stu.id;
  res.json({ ok: true, student: stu });
});

/* ---------------- students / me ---------------- */
app.get('/api/students', (req, res) => res.json({ students: students() }));

app.get('/api/me', (req, res) => {
  const student = students().find((s) => s.id === req.session.studentId) || null;
  res.json({ student, admin: Boolean(req.session.admin) });
});

/* ============================================================
   Phase 5 — video library (reads /videos on every request)
   ============================================================ */
app.get('/api/videos', (req, res) => {
  const videos = listVideos();
  res.json({ videos, count: videos.length });
});

/* ============================================================
   Phase 6 + 7 — per-video meta (description, resource, snippets)
   ============================================================ */
app.get('/api/meta', (req, res) => res.json({ meta: meta() }));

app.post('/api/meta', (req, res) => {
  if (!req.session.admin) return res.status(401).json({ ok: false, error: 'Admin sign-in required.' });
  const { video, description, resourceUrl, snippets } = req.body || {};
  if (typeof video !== 'string' || !video) return res.status(400).json({ ok: false, error: 'video is required' });
  const m = meta();
  m[video] = {
    description: typeof description === 'string' ? description.slice(0, 4000) : '',
    resourceUrl: typeof resourceUrl === 'string' ? resourceUrl.slice(0, 2000) : '',
    snippets: Array.isArray(snippets)
      ? snippets.filter((s) => s && typeof s.code === 'string').slice(0, 20).map((s) => ({
          title: String(s.title || 'Snippet').slice(0, 120),
          lang: String(s.lang || 'text').slice(0, 40),
          code: String(s.code).slice(0, 50000)
        }))
      : []
  };
  writeJson('meta.json', m);
  res.json({ ok: true });
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

/* ---------------- health ---------------- */
app.get('/healthz', (req, res) => res.json({ status: 'ok', service: 'westmont-video-portal', phase: 7 }));

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
app.use('/videos', express.static(VIDEOS_DIR, { fallthrough: true, index: false, maxAge: '1h' }));
app.use(express.static(PUBLIC_DIR));

/* 404 for unknown API routes */
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`Westmont Video Portal running -> http://localhost:${PORT}  (admin: /admin, password default "admin123")`);
});