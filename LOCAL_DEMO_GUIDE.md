# Westmont Hub — Local demo guide (ngrok)

Share this guide with anyone who wants to **run the video portal on their laptop** and let others sign in from a **phone** using QR codes.

No paid hosting needed — your PC runs the app; **ngrok** gives you a temporary public HTTPS link for the demo.

---

## What you will have at the end

- Portal running on your computer
- A link like `https://abc123.ngrok-free.app` you can open on desktop **and** phone
- QR sign-in → video dashboard → watch lessons
- Admin page to edit lesson titles and content

---

## What you need first

| Requirement | Details |
|-------------|---------|
| **Windows PC** | This guide uses PowerShell (Mac/Linux steps are similar) |
| **Node.js** | Version 18 or 20 — [https://nodejs.org](https://nodejs.org) |
| **Project folder** | The `Udemy_demo` folder (unzipped or cloned from git) |
| **ngrok account** | Free — [https://ngrok.com](https://ngrok.com) |
| **Two browser devices** | e.g. laptop + phone (phone can use mobile data — same Wi‑Fi not required) |

---

## Part 1 — One-time setup

### 1. Install Node.js

1. Download the **LTS** installer from [nodejs.org](https://nodejs.org).
2. Run it (defaults are fine).
3. Open **PowerShell** and check:

```powershell
node -v
npm -v
```

You should see version numbers (e.g. `v20.x` and `10.x`).

### 2. Install project dependencies

```powershell
cd path\to\Udemy_demo
npm install
```

Replace `path\to\Udemy_demo` with the real folder path, for example:

```powershell
cd c:\GenAI\AI_WEB_SEMINAR\Demo_projects\Udemy_demo
```

### 3. Install ngrok

**Option A — website (recommended)**

1. Go to [https://ngrok.com/download](https://ngrok.com/download).
2. Download ngrok for Windows.
3. Unzip `ngrok.exe` — you can put it inside the project folder or anywhere on your PATH.

**Option B — winget**

```powershell
winget install ngrok.ngrok
```

### 4. Connect ngrok to your account

1. Sign up / log in at [https://dashboard.ngrok.com](https://dashboard.ngrok.com).
2. Copy your **Authtoken** from the dashboard.
3. Run once in PowerShell:

```powershell
ngrok config add-authtoken YOUR_TOKEN_HERE
```

---

## Part 2 — Start the demo (every time)

You need **two PowerShell windows** open.

### Terminal A — Start the portal

```powershell
cd path\to\Udemy_demo
npm start
```

Leave this running. You should see:

```text
Westmont Video Portal running -> http://localhost:3000
```

Quick check: open [http://localhost:3000](http://localhost:3000) on the same PC — the landing page should load.

> **Do not close this window** during the demo.

---

### Terminal B — Start ngrok

Open a **second** PowerShell window:

```powershell
ngrok http 3000
```

Leave this running. You will see something like:

```text
Forwarding   https://abc123.ngrok-free.app -> http://localhost:3000
```

**Copy the HTTPS URL** (the one starting with `https://` and ending with `.ngrok-free.app`).

Example: `https://abc123.ngrok-free.app`

> **Do not close this window** during the demo.

---

### Terminal A again — Set PUBLIC_URL and restart the server

The QR code must point to the ngrok link, not `localhost`.

1. Go back to **Terminal A**.
2. Stop the server: press **Ctrl+C**.
3. Start again **with your ngrok URL** (paste your real URL):

```powershell
$env:PUBLIC_URL = "https://abc123.ngrok-free.app"
npm start
```

You should now see:

```text
PUBLIC_URL (QR codes) -> https://abc123.ngrok-free.app
```

**Important:** Replace `abc123.ngrok-free.app` with **your** ngrok URL from Terminal B.  
The URL **changes each time** you restart ngrok (on the free plan), so repeat this step whenever ngrok gives you a new link.

#### Optional — helper script

If ngrok is already running in Terminal B, you can use:

```powershell
cd path\to\Udemy_demo
powershell -ExecutionPolicy Bypass -File .\scripts\ngrok-test.ps1
```

This detects the ngrok URL automatically and starts the server with `PUBLIC_URL` set.

---

## Part 3 — Run the demo

### On the laptop (presenter / “desktop”)

1. Open your **ngrok HTTPS URL** in Chrome or Edge — **not** `localhost`:
   - `https://abc123.ngrok-free.app`
2. If ngrok shows a **“Visit Site”** warning page, click **Visit Site** (normal on free ngrok).
3. On the right panel, click **Show QR code**.
4. You should see a QR image and a 6-character code.
5. **Keep this tab open** — it waits for the phone to sign in.

### On the phone (student)

**Method 1 — In-app scanner**

1. Open the same ngrok URL + `/qr-reader`:
   - `https://abc123.ngrok-free.app/qr-reader`
2. Allow **camera** access.
3. Point the camera at the QR on the laptop screen.
4. Choose a **student profile** from the list.
5. Tap **Verify & sign in**.

**Method 2 — Phone camera app**

1. Open the phone’s **Camera** app.
2. Scan the QR on the laptop screen.
3. Tap the link that appears.
4. Choose student → **Verify & sign in**.

**Method 3 — Manual code**

1. On the phone, open `/qr-reader`.
2. Expand **Enter code manually**.
3. Type the 6-character code shown on the laptop.

### Back on the laptop

Within a few seconds:

1. The page shows **Signed in as [name]**
2. It redirects to **Your lessons** (dashboard)
3. Click **Watch lesson** on any card

### Sign out

On the dashboard, click **Sign out** in the top bar to return to the landing page.

---

## Part 4 — Admin (edit lesson content)

1. Open: `https://abc123.ngrok-free.app/admin`
2. Password (default): `admin123`
3. Pick a lesson, edit title / description / resources / code snippets, then **Save**.

Changes appear on the watch page for all signed-in students.

> Change the admin password before any real public demo: set `ADMIN_PASSWORD` in the environment before `npm start`.

---

## Part 5 — Add or change videos (optional)

Videos are files in the project folder:

```text
Udemy_demo/videos/
  intro.mp4      ← landing page intro
  1 (1).mp4      ← lessons shown on dashboard
  ...
```

1. Copy `.mp4` files into `videos/`.
2. No restart needed — refresh the dashboard.
3. Use `/admin` to set titles and descriptions per file.

Thumbnails (optional): matching name in `thumbnails/` (e.g. `1 (1).webp`).

---

## Troubleshooting

| Problem | What to do |
|---------|------------|
| **`npm start` fails — port in use** | Something else uses port 3000. Close other Node windows or restart the PC. |
| **Phone opens `localhost` link** | Restart server with `$env:PUBLIC_URL = "https://YOUR.ngrok-free.app"` and open the **ngrok URL** on the laptop too. |
| **Desktop stays on “Show QR code”** | You must click **Show QR code** first. Leave that tab open while the phone verifies. |
| **QR expired** | Codes last **2 minutes**. Click **Refresh QR code** on the laptop and scan again. |
| **ngrok “Visit Site” page** | Click **Visit Site** on phone and laptop. |
| **Camera does not work on phone** | Use Chrome on Android, or scan with the native **Camera** app (Method 2), or enter the code manually. |
| **Dashboard does not open after sign-in** | Open the laptop on the **same ngrok HTTPS URL** (not localhost). Hard refresh: **Ctrl+F5**. |
| **ngrok URL stopped working** | Free ngrok URLs change when you restart ngrok. Copy the new URL, update `PUBLIC_URL`, restart `npm start`. |
| **Dev bypass button missing** | Normal on ngrok — login is **QR only** (more realistic demo). On localhost only, a dev bypass button appears. |

---

## Demo checklist (print this)

```text
[ ] npm install          (once)
[ ] ngrok authtoken      (once)
[ ] Terminal A: npm start
[ ] Terminal B: ngrok http 3000
[ ] Copy ngrok HTTPS URL
[ ] Terminal A: Ctrl+C, then PUBLIC_URL + npm start
[ ] Laptop: open ngrok URL → Show QR code
[ ] Phone: scan QR → pick student → Verify
[ ] Laptop: dashboard opens → play a lesson
[ ] Optional: /admin to edit content
```

---

## Quick command reference

```powershell
# Terminal A (after ngrok is running)
cd path\to\Udemy_demo
$env:PUBLIC_URL = "https://YOUR-ID.ngrok-free.app"
npm start

# Terminal B
ngrok http 3000
```

| Page | URL |
|------|-----|
| Landing / QR login | `https://YOUR-ID.ngrok-free.app/` |
| QR reader (phone) | `https://YOUR-ID.ngrok-free.app/qr-reader` |
| Dashboard | `https://YOUR-ID.ngrok-free.app/dashboard` |
| Admin | `https://YOUR-ID.ngrok-free.app/admin` |
| Health check | `https://YOUR-ID.ngrok-free.app/healthz` |

---

## Security notes for demos

- The ngrok link is **public** while the tunnel is open — anyone with the URL can try to sign in.
- Use **student profiles** only for demo names, not real private data.
- Stop ngrok (**Ctrl+C** in Terminal B) and the server when the demo is over.
- Default admin password `admin123` is for local demo only — change it for anything beyond a trusted room.

---

## Need more detail?

See also **`QR_NGROK_TEST.md`** in the same folder for technical notes and the automated `ngrok-test.ps1` script.

Happy demo!
