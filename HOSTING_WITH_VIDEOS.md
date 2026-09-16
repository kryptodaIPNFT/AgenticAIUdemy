# Hosting with persistent video storage

Your app reads videos from a folder on disk (`videos/`). For production you need **persistent storage** that survives redeploys and fits your file sizes.

---

## Pick the right option

| Option | Monthly cost | Storage | Best for |
|--------|-------------|---------|----------|
| **A. Oracle Cloud free VM** | **$0** | ~200 GB disk | Free always-on + full video folder |
| **B. Hetzner / cheap VPS** | **~€4–6** | 20–40 GB+ | Simple, reliable, easy SFTP uploads |
| **C. Render + persistent disk** | **~$7+** | Pay per GB | Stay on Render, mount a disk for `videos/` |
| **D. Cloudflare R2 + small host** | **~$0–5** | Cheap object storage | Many/large videos (needs code changes later) |

**Recommendation:** Start with **A (Oracle free VM)** if you want $0, or **B (Hetzner VPS)** if you want the easiest setup for ~€4/month.

Render **free tier alone** is **not** suitable for stored videos — files disappear on redeploy.

---

## Option A — Oracle Cloud free VM ( $0 + persistent disk )

You get a small Linux server with a **persistent boot disk** (~200 GB on the free tier). Upload videos with SFTP; the app works unchanged.

### Step 1 — Oracle account

1. [cloud.oracle.com](https://cloud.oracle.com) → sign up (card may be required for verification; stay in **Always Free** resources).
2. Create a **VM.Standard.E2.1.Micro** instance (Always Free eligible).
3. OS: **Ubuntu 22.04**.
4. Download the **SSH private key** (.pem).
5. Open firewall: allow **22** (SSH), **80** (HTTP), **443** (HTTPS).

### Step 2 — Connect and install Node

From PowerShell (path to your `.pem` key):

```powershell
ssh -i "C:\path\to\your-key.pem" ubuntu@YOUR_VM_PUBLIC_IP
```

On the server:

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx
sudo npm install -g pm2
```

### Step 3 — Deploy the app

```bash
sudo mkdir -p /var/www/westmont-hub
sudo chown ubuntu:ubuntu /var/www/westmont-hub
cd /var/www/westmont-hub

git clone https://github.com/YOUR_USER/westmont-video-portal.git .
npm install

# Persistent folders (survive app updates)
mkdir -p videos thumbnails data
```

Create environment file:

```bash
nano /var/www/westmont-hub/.env
```

Add (generate a real secret):

```env
PORT=3000
SESSION_SECRET=your-long-random-secret-here
ADMIN_PASSWORD=your-strong-admin-password
PUBLIC_URL=https://your-domain.com
VIDEOS_DIR=/var/www/westmont-hub/videos
DATA_DIR=/var/www/westmont-hub/data
THUMBNAILS_DIR=/var/www/westmont-hub/thumbnails
```

Start with PM2:

```bash
cd /var/www/westmont-hub
export $(grep -v '^#' .env | xargs)
pm2 start server.js --name westmont-hub
pm2 save
pm2 startup
```

### Step 4 — Upload videos (SFTP)

Use **WinSCP** or **FileZilla**:

| Field | Value |
|-------|--------|
| Host | Your VM public IP |
| User | `ubuntu` |
| Key file | Your `.pem` key |
| Remote folder | `/var/www/westmont-hub/videos/` |

Drop `.mp4` files here — they appear on the dashboard immediately (no redeploy).

### Step 5 — HTTPS with nginx (required for QR on phones)

```bash
sudo nano /etc/nginx/sites-available/westmont-hub
```

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    client_max_body_size 500M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/westmont-hub /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Free HTTPS with Let's Encrypt (if you have a domain):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Set `PUBLIC_URL=https://your-domain.com` in `.env` and `pm2 restart westmont-hub`.

---

## Option B — Hetzner VPS (~€4/month, easiest paid)

Same steps as Oracle, but on [hetzner.com/cloud](https://www.hetzner.com/cloud):

1. Create **CX22** (or smallest plan with enough disk).
2. Ubuntu 22.04, SSH key, follow **Steps 2–5** above.
3. Upload videos via SFTP to `/var/www/westmont-hub/videos/`.

Hetzner is often faster to set up than Oracle and includes more predictable disk space.

---

## Option C — Render + persistent disk (~$7+/month)

Keep Render for the app, attach a **Persistent Disk** for videos and course data.

### Step 1 — Upgrade from free

1. Render dashboard → your Web Service → **Settings**.
2. Change plan from **Free** to **Starter** (required for disks).
3. **Disks** → **Add disk**:
   - Name: `course-data`
   - Size: e.g. **10 GB** (increase as needed)
   - Mount path: `/var/data`

### Step 2 — Environment variables

| Key | Value |
|-----|--------|
| `VIDEOS_DIR` | `/var/data/videos` |
| `DATA_DIR` | `/var/data/data` |
| `THUMBNAILS_DIR` | `/var/data/thumbnails` |
| `SESSION_SECRET` | (random) |
| `ADMIN_PASSWORD` | (strong password) |

Redeploy. On first boot the app creates those folders on the disk.

### Step 3 — Upload videos to the disk

Render **Shell** (paid tiers):

```bash
ls /var/data/videos
# Use scp from your PC (Render docs show SSH for paid services)
```

Or commit **small** videos to git; use the disk for larger files uploaded via Shell/SSH.

**Note:** Render disk survives redeploys; ephemeral app disk does not.

---

## Option D — Cloud object storage (many large videos)

For **hundreds of GB** or heavy traffic, store videos in **Cloudflare R2** or **Backblaze B2** and stream from there. That needs app changes (S3-compatible API) — not built in yet.

Typical layout:

```text
App (Render/Fly)  →  lists metadata in data/meta.json
Videos            →  R2 bucket (cheap storage + CDN)
```

Ask if you want R2 integration added to the codebase.

---

## Managing videos day to day

| Task | How |
|------|-----|
| Add a lesson | Upload `.mp4` to `videos/` via SFTP (VM) or disk mount (Render) |
| Thumbnail | Same filename in `thumbnails/` (`.webp`, `.jpg`, `.svg`) |
| Title & snippets | `/admin` on the live site → saves to `data/meta.json` |
| Backup | Copy `videos/` + `data/` folder to your PC or cloud backup |

---

## Quick comparison for your seminar portal

```text
Budget $0 + OK with setup time     →  Oracle free VM + SFTP
Budget ~€4 + want simplicity       →  Hetzner VPS + SFTP
Already on Render + OK paying ~$7  →  Render Starter + persistent disk
Huge video library later           →  R2/B2 + app update (future)
```

---

## After you choose

1. Push code to GitHub (include `render.yaml`, this guide).
2. Deploy using **A**, **B**, or **C**.
3. Upload videos to the persistent `videos/` path.
4. Open the site over **HTTPS**, test QR login and `/admin`.

If you tell me **A, B, or C**, I can give you a single checklist tailored to that path only (including exact SFTP settings for Windows).
