# Deploy Westmont Video Portal on Render (free tier)

Step-by-step guide to publish this app at a public HTTPS URL like  
`https://westmont-video-portal.onrender.com`.

---

## Before you start

| Item | Notes |
|------|--------|
| **GitHub account** | Free — Render deploys from your repo |
| **Render account** | Free at [render.com](https://render.com) |
| **Credit card** | Usually **not** required for the free web service |
| **Video files** | Large `.mp4` files are **not** ideal in git (GitHub limit: 100 MB per file) |

**Free tier limits (important):**

- Service **sleeps after ~15 min** with no traffic (first visit may take 30–60 s to wake up).
- Disk is **ephemeral** — admin edits and student progress can reset when Render redeploys.
- **512 MB RAM** — keep demo videos short/small.

For a seminar demo this is usually fine. For production with many videos, use a paid Render disk or a VPS.

---

## Step 1 — Prepare the project on your PC

Open PowerShell in the project folder:

```powershell
cd "c:\GenAI\AI_WEB_SEMINAR\Demo_projects\Udemy_demo"
npm install
npm start
```

Confirm `http://localhost:3000` works, then stop the server (Ctrl+C).

---

## Step 2 — Create a GitHub repository

1. Go to [github.com/new](https://github.com/new).
2. Name it e.g. `westmont-video-portal`.
3. Choose **Private** or **Public**.
4. **Do not** add README / .gitignore (you already have files locally).
5. Click **Create repository**.

Copy the repo URL, e.g. `https://github.com/YOUR_USER/westmont-video-portal.git`.

---

## Step 3 — Push your code to GitHub

In PowerShell (replace `YOUR_USER` and repo name):

```powershell
cd "c:\GenAI\AI_WEB_SEMINAR\Demo_projects\Udemy_demo"

git init
git add server.js package.json package-lock.json render.yaml RENDER_DEPLOY.md
git add public/ data/ logo/ thumbnails/
git add README.md CONTENT_CREATOR_GUIDE.md QR_NGROK_TEST.md

# Optional: include small demo videos only (each file must be under 100 MB for GitHub)
# git add videos/

git commit -m "Prepare Westmont Video Portal for Render deploy"

git branch -M main
git remote add origin https://github.com/YOUR_USER/westmont-video-portal.git
git push -u origin main
```

**Do not commit** (unless you want them in git):

- `node_modules/` (already in `.gitignore`)
- `ngrok.exe`, `cookies*.txt`, `.env`
- Very large video files — upload later (Step 8)

---

## Step 4 — Sign up on Render

1. Go to [dashboard.render.com](https://dashboard.render.com).
2. Sign up with **GitHub** (easiest — Render can read your repos).
3. Authorize Render when GitHub asks.

---

## Step 5 — Create a Web Service

### Option A — Manual (recommended first time)

1. Dashboard → **New +** → **Web Service**.
2. Connect your GitHub account if asked.
3. Select the repo **`westmont-video-portal`** (or your repo name).
4. Fill in:

| Field | Value |
|-------|--------|
| **Name** | `westmont-video-portal` (becomes part of your URL) |
| **Region** | Choose closest to your audience |
| **Branch** | `main` |
| **Runtime** | **Node** |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance type** | **Free** |

5. Expand **Advanced** → set **Health Check Path** to `/healthz`.

### Option B — Blueprint (uses `render.yaml`)

1. Dashboard → **New +** → **Blueprint**.
2. Connect the repo — Render reads `render.yaml` automatically.
3. Set **ADMIN_PASSWORD** when prompted.

---

## Step 6 — Environment variables

In the Web Service → **Environment** tab, add:

| Key | Value | Required |
|-----|--------|----------|
| `ADMIN_PASSWORD` | A strong password (not `admin123`) | **Yes** |
| `SESSION_SECRET` | Long random string, e.g. run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | **Yes** |
| `NODE_VERSION` | `20` | Recommended |
| `PUBLIC_URL` | Leave empty on first deploy — app auto-uses Render’s `RENDER_EXTERNAL_URL` | Optional |

Click **Save Changes**.

---

## Step 7 — Deploy

1. Click **Create Web Service** (or **Deploy** if editing an existing service).
2. Watch the **Logs** tab:
   - Build: `npm install`
   - Start: `Westmont Video Portal running -> http://localhost:10000`
3. When status is **Live**, open your URL:

   `https://YOUR-SERVICE-NAME.onrender.com`

4. Test:
   - Landing page loads
   - `https://YOUR-SERVICE-NAME.onrender.com/healthz` → `{"status":"ok",...}`
   - **Show QR code** → scan with phone → dashboard opens
   - Admin: `https://YOUR-SERVICE-NAME.onrender.com/admin`

---

## Step 8 — Add videos on Render

GitHub often cannot store large `.mp4` files. Options:

### A) Small videos in git (easiest)

If each file is **under 100 MB**:

```powershell
git add videos/
git commit -m "Add course videos"
git push
```

Render redeploys automatically.

### B) Upload via Render Shell

1. Web Service → **Shell** tab (available on free tier with limits).
2. Create folder and upload — practical only for 1–2 small files; Shell is not ideal for GB uploads.

### C) Keep videos in repo with Git LFS

For larger files, use [Git LFS](https://git-lfs.github.com/) — more setup, still has bandwidth limits on free GitHub.

### D) Demo without heavy video

Ship with `intro.mp4` only first; add lessons later.

---

## Step 9 — After deploy checklist

- [ ] Change `ADMIN_PASSWORD` from default
- [ ] Open site only via **HTTPS Render URL** (not localhost) when testing QR on phones
- [ ] Sign in with QR → dashboard → watch a lesson
- [ ] Sign out from dashboard
- [ ] Edit one lesson in `/admin` and confirm it appears on watch page

---

## Step 10 — Automatic redeploys

Render redeploys when you push to `main`:

```powershell
git add .
git commit -m "Update course content"
git push
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **502 / service unavailable** | Check **Logs** for crash; ensure `npm start` runs `node server.js` |
| **First load very slow** | Free tier woke from sleep — wait ~1 minute |
| **QR scan works but desktop doesn’t redirect** | Open desktop on the **same Render HTTPS URL**, click **Show QR code** first |
| **No videos on dashboard** | `videos/` empty on server — add files (Step 8) and redeploy |
| **Admin login fails** | Check `ADMIN_PASSWORD` env var in Render dashboard |
| **Progress / meta lost after deploy** | Expected on free tier (ephemeral disk) — use paid **Persistent Disk** or external DB for production |

---

## Cost summary

| Plan | Price | Good for |
|------|-------|----------|
| Render **Free** Web Service | $0 | Demos, seminars, light testing |
| Render **Starter** + disk | ~$7+/mo | Always-on, persistent uploads |
| **ngrok + laptop** | $0 | Live workshop while your PC runs |

---

## Quick reference

```text
Local test:     npm start  →  http://localhost:3000
Render URL:     https://YOUR-SERVICE-NAME.onrender.com
Health check:   /healthz
Admin:          /admin
QR reader:      /qr-reader
```

If you want help preparing the GitHub push or fixing a failed Render build log, paste the log excerpt and we can fix it.
