# Deploy Westmont Hub on Netlify (production, no ngrok)

This app now deploys as:

- **Static CDN** — pages, CSS, JS, logos, thumbnails, and lesson videos
- **Netlify Function** — `/api/*` (QR login, admin, progress)
- **Netlify Blobs** — student invite links, lesson text, and progress (survive redeploys)

Local `npm start` is unchanged (still a normal Node server on port 3000).

---

## Next time — short checklist

Repo: **https://github.com/kryptodalPNFT/AgenticAIUdemy**  
Site: import that repo in Netlify (do not upload the whole folder).

**1. Save code locally**

```powershell
cd C:\GenAI\AI_WEB_SEMINAR\Demo_projects\Udemy_demo
git add -A
git commit -m "Update course"
```

**2. Push to GitHub**

If `git push -u origin main` opens a blank browser login and fails, use a **classic PAT** with **`repo` ticked**, edited in Notepad:

```powershell
git -c credential.helper= push "https://x-access-token:PASTE_TOKEN@github.com/kryptodalPNFT/AgenticAIUdemy.git" main
```

Do not type your GitHub password. Delete the token after a successful push.

**3. Netlify (first time only, or when connecting a new site)**

| Field | Value |
|--------|--------|
| Repository | `AgenticAIUdemy` |
| Branch | `main` |
| Base directory | *(leave empty)* |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |

Click **Deploy**. Later pushes to `main` redeploy automatically.

**4. Environment variables** (then Trigger deploy once)

| Name | Value |
|------|--------|
| `ADMIN_PASSWORD` | `2131` |
| `SESSION_SECRET` | long random string |
| `PUBLIC_URL` | `https://YOUR-SITE.netlify.app` |

**5. Test:** `/healthz` → landing → `/admin` → copy unique QR-reader link → Show QR on desktop → phone opens that link (not the Camera app).

---

## What you need

| Item | Notes |
|------|--------|
| **Netlify account** | Free at [netlify.com](https://www.netlify.com) |
| **GitHub repo** | Netlify deploys from Git (or use the CLI without Git) |
| **Node.js 18+** | Already used locally |
| **Videos** | Each file in `videos/` should stay **under ~10 MB** for Git-based deploys. Larger files: use Netlify CLI (Step 8). |

GitHub’s hard limit is **100 MB per file**. Netlify’s Git deploys are happiest with small lesson files.

---

## Step 1 — Confirm it still runs locally

```powershell
cd C:\GenAI\AI_WEB_SEMINAR\Demo_projects\Udemy_demo
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Stop the server with Ctrl+C when done.

Optional: preview the Netlify build output:

```powershell
npm run build
```

This creates `dist/` (do not commit it).

---

## Step 2 — Create a GitHub repository

1. Go to [github.com/new](https://github.com/new).
2. Name it e.g. `westmont-hub`.
3. **Do not** add a README (the project already has files).
4. Create the repository and copy the URL.

---

## Step 3 — Push the project

```powershell
cd C:\GenAI\AI_WEB_SEMINAR\Demo_projects\Udemy_demo

git add server.js package.json package-lock.json netlify.toml .nvmrc .gitignore
git add public/ data/ lib/ logo/ thumbnails/ netlify/ scripts/
git add NETLIFY_DEPLOY.md README.md

# Only if each video is under 10–25 MB:
# git add videos/

git commit -m "Add Netlify production deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USER/westmont-hub.git
git push -u origin main
```

Skip `videos/` in Git if files are large — add them with the CLI in Step 8.

---

## Step 4 — Sign up / log in to Netlify

1. Open [app.netlify.com](https://app.netlify.com).
2. Sign up with **GitHub**.
3. Authorize Netlify to read the repo.

---

## Step 5 — Add a new site from Git

1. **Add new site** → **Import an existing project**.
2. Pick **GitHub** and the `westmont-hub` repo.
3. Confirm:

| Field | Value |
|-------|--------|
| **Branch** | `main` |
| **Build command** | `npm run build` |
| **Publish directory** | `dist` |

These also live in `netlify.toml`, so they should fill in automatically.

4. Click **Deploy site**. Wait until the deploy is **Published**.

Your URL looks like: `https://random-name-123.netlify.app`

You can rename it under **Project configuration → Domain management**.

---

## Step 6 — Production environment variables

**Project configuration → Environment variables** → add:

| Key | Value |
|-----|--------|
| `ADMIN_PASSWORD` | `2131` |
| `SESSION_SECRET` | Long random string (see command below) |
| `PUBLIC_URL` | Your live HTTPS URL, e.g. `https://westmont-hub.netlify.app` |

Generate a secret in PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Redeploy** after saving variables: **Deploys → Trigger deploy → Deploy site**.

`PUBLIC_URL` is what Admin copies into unique QR-reader links. If you add a custom domain later, update this to that domain and redeploy.

---

## Step 7 — Test the live site

1. Open `https://YOUR-SITE.netlify.app`
2. Open `https://YOUR-SITE.netlify.app/healthz` — should show `"host":"netlify"`
3. Sign in to `/admin` with `ADMIN_PASSWORD`
4. Copy a **unique QR-reader link** and send it to your phone
5. On desktop: **Show QR code**
6. On the phone: open the unique link → scan with the **in-app** camera → verify
7. Desktop should open the dashboard and play a lesson

No ngrok. The phone Camera app still cannot log anyone in (invite links only).

---

## Step 8 — Large videos (optional)

If Git rejected a file or the dashboard is missing lessons:

### Option A — Netlify CLI (recommended for bigger files)

```powershell
npm install -g netlify-cli
cd C:\GenAI\AI_WEB_SEMINAR\Demo_projects\Udemy_demo
npm run build
netlify login
netlify init          # first time only — link this folder to the site
netlify deploy --prod --dir=dist
```

This uploads `dist/videos/` without putting huge files in GitHub.

### Option B — Keep demo videos small

Use short `.mp4` files in `videos/` and `git add videos/` as in Step 3.

After any video change, rebuild/redeploy so `data/video-manifest.json` lists the new files.

---

## Step 9 — Custom domain (optional)

1. Netlify → **Domain management** → **Add a domain**.
2. Follow DNS instructions (or buy a domain in Netlify).
3. Set `PUBLIC_URL=https://your-domain.com` and redeploy.
4. Recreate/copy unique invite links (they include the host).

HTTPS is automatic.

---

## How deploys work after this

```text
git push origin main
    → Netlify runs npm run build
    → dist/ goes to the CDN (pages + videos)
    → netlify/functions/server.js serves /api
```

Admin edits (titles, invite links, progress) are stored in **Netlify Blobs**, not in Git, so they stay after a redeploy.

If you add a new `.mp4` to `videos/`, you must **redeploy** so the build regenerates the video list.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **Site is HTML but `/api/videos` is 404** | Confirm `netlify.toml` redirects; trigger a new deploy |
| **QR verifies on phone, desktop never signs in** | Open desktop on the **same Netlify HTTPS URL**; set `PUBLIC_URL` |
| **Admin password always fails** | Env vars were added after the last deploy — redeploy |
| **No lessons on the dashboard** | `videos/` was not in the build. Add files and redeploy, or use CLI (Step 8) |
| **Invite links still say localhost** | Set `PUBLIC_URL` to the Netlify URL, then copy links again from `/admin` |
| **Cookie / sign-in drops** | Site must be **HTTPS**. Do not mix `http://` and `https://` |
| **Function timeout** | Videos must **not** stream through `/api`. They should load from `/videos/...` on the CDN |

---

## Local vs production

| | Local | Netlify |
|--|--------|---------|
| Start | `npm start` | Git push or `netlify deploy --prod` |
| URL | `http://localhost:3000` | `https://….netlify.app` |
| Sessions | Signed cookie | Same, `Secure` on HTTPS |
| Data | `data/*.json` on disk | Netlify Blobs |
| Videos | `videos/` folder | CDN files in `dist/videos/` |

---

## Security checklist before a real class

- [ ] `ADMIN_PASSWORD` is not `admin123`
- [ ] `SESSION_SECRET` is a long random value
- [ ] Unique QR-reader links are sent only to intended students
- [ ] Default Camera-app QR login is still disabled (no web URL in the desktop QR)
- [ ] You stop unused Netlify preview deploys if the repo is public
