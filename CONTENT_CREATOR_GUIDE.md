# Content Creator & Admin Guide

How to upload lesson videos and manage course content on the **Westmont Video Portal** (self-hosted Udemy-style platform).

---

## Quick start checklist

| Step | Action |
|------|--------|
| 1 | Ensure the server is running (`npm start` → http://localhost:3000) |
| 2 | Copy video files into the `videos/` folder |
| 3 | Open http://localhost:3000/admin and sign in |
| 4 | Add descriptions, resource links, and code snippets per lesson |
| 5 | Sign in as a student (QR or Dev Bypass) and confirm lessons appear on the dashboard |

---

## How video upload works

This portal does **not** use a browser upload form yet. Videos are added by placing files directly in the project folder:

```
Udemy_demo/
└── videos/
    ├── intro.mp4          ← landing-page introduction (guests only)
    ├── 1 (1).mp4          ← lesson 1, part 1
    ├── 1 (2).mp4          ← lesson 1, part 2
    └── my-new-lesson.mp4  ← any supported format
```

### Supported formats

`.mp4`, `.webm`, `.ogg`, `.ogv`, `.mov`, `.m4v`, `.mkv`, `.avi`

**Recommended:** `.mp4` (H.264) for best browser compatibility.

### Steps to upload a new lesson

1. **Copy your video file** into:
   ```
   c:\GenAI\AI_WEB_SEMINAR\Demo_projects\Udemy_demo\videos\
   ```
   (Use File Explorer, or run `copy "D:\MyLesson.mp4" "...\videos\Lesson 3.mp4"`)

2. **No server restart needed.** The server scans `videos/` on every request. Refresh the student dashboard and the new lesson appears automatically.

3. **Optional — improve the title with naming:**
   | Filename | Display title |
   |----------|---------------|
   | `intro.mp4` | *(landing page only — not listed as a lesson)* |
   | `1 (1).mp4` | Lesson 1 — Part 1 |
   | `2 (3).mp4` | Lesson 2 — Part 3 |
   | `Advanced-AI.mp4` | Advanced AI |

4. **Add rich content in Admin** (description, links, code) — see below.

### Special file: `intro.mp4`

- Shown on the **landing page** for guest users (before sign-in).
- **Excluded** from the student lesson dashboard.
- Replace this file to change the public course introduction.

### Removing a lesson

Delete the file from `videos/`. It disappears from the dashboard on the next page load.

### Custom lesson thumbnails

Place thumbnail images in the `thumbnails/` folder using the **same base name** as the video:

| Video file | Thumbnail file |
|------------|----------------|
| `1 (1).mp4` | `1 (1).jpg` (or `.png`, `.webp`, `.svg`) |

- The server auto-creates a branded **placeholder `.svg`** the first time a lesson is listed.
- **To replace:** drop your own image with the same name — refresh the dashboard (no restart).
- Recommended size: **640×360** (16:9).

See `thumbnails/README.txt` for details.

---

## Admin panel — manage lesson content

The admin area edits **metadata** (text, links, snippets). It does not upload video files.

### Sign in

1. Open **http://localhost:3000/admin**
2. Default password: **`admin123`**
3. Change in production by setting the environment variable:
   ```bash
   set ADMIN_PASSWORD=your-secure-password
   npm start
   ```

### What you can edit per lesson

- **Description** — shown on the watch page under “About this lesson”
- **Resource URL** — link to slides, PDF, GitHub repo, etc.
- **Reference snippets** — important material for students, shown **under the video** on the watch page:
  - **Code** — JavaScript, Python, HTML, etc.
  - **Terminal command** — shell one-liners (`npm install`, `git clone`, …)
  - **AI prompt** — Cursor / ChatGPT prompts students should reuse
  - **General note** — any other copy-paste text

Click **+ Add snippet** for each block, then **Save lesson content**. Students get a **Copy** button on each snippet.

---

## Student experience (for testing your content)

### Option A — Dev bypass (local testing only)

1. Open http://localhost:3000
2. Click **⚡ Dev Bypass: Simulate QR Login**
3. You are redirected to the dashboard with a mock student session

> Remove the dev bypass button before any external demo or deployment.

### Option B — Full QR sign-in flow

1. On the desktop landing page, click **Show QR code**
2. On a phone, scan the QR (or open the link) → `/qr-reader?code=XXXXXX`
3. Select a student profile and click **Verify & sign in**
4. The desktop auto-redirects to the dashboard

Test student profiles live in `data/students.json`.

---

## Function test results (local server)

Last verified against **http://localhost:3000**:

| Feature | Status | Notes |
|---------|--------|-------|
| Health check `/healthz` | ✅ Pass | Server running |
| Landing page `/` | ✅ Pass | Intro video + QR panel |
| Intro video stream `/videos/intro.mp4` | ✅ Pass | HTTP 200 |
| Lesson list `/api/videos` | ✅ Pass | 5 lessons (intro excluded) |
| QR challenge + verify + dashboard redirect | ✅ Pass | Full auth loop |
| Dev bypass `/api/dev/bypass` | ✅ Pass | Instant dashboard access |
| Dashboard `/dashboard` (authenticated) | ✅ Pass | HTTP 200 |
| Watch page `/watch?id=…` | ✅ Pass | HTML5 player loads local file |
| Video streaming (range requests) | ✅ Pass | HTTP 206 Partial Content |
| Admin login `/admin` | ✅ Pass | Password `admin123` |
| Save lesson meta `POST /api/meta` | ✅ Pass | Descriptions & snippets |
| Progress tracking API | ⚠️ Not implemented | Watch page works; progress save is optional/future |

---

## Folder reference

| Path | Purpose |
|------|---------|
| `videos/` | **Drop video files here** (primary upload location) |
| `data/meta.json` | Lesson descriptions, resources, snippets (edited via Admin) |
| `data/students.json` | Student profiles for QR sign-in |
| `public/admin.html` | Admin UI |
| `public/index.html` | Landing page (intro + QR) |
| `public/dashboard.html` | Student lesson grid (max 2 cards per row) |

---

## Tips for content creators

1. **Keep filenames stable** — if you rename a file, admin metadata in `meta.json` must be re-saved under the new name.
2. **Use short, descriptive names** when auto-titles are not enough; override with Admin description.
3. **Test playback** after upload: Dev Bypass → dashboard → click a lesson → confirm play/pause/volume/fullscreen.
4. **Large files** — copy via USB or network share; the server serves files directly with range-request support for seeking.
5. **Production** — change `ADMIN_PASSWORD`, remove the dev bypass button, and set `SESSION_SECRET` before going live.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Lesson not on dashboard | Confirm file is in `videos/` and is not named `intro.mp4` |
| Wrong title | Rename file using `Lesson N — Part M` pattern, or set description in Admin |
| Admin save fails | Sign in again at `/admin`; check browser console for 401 errors |
| Video won't play | Use `.mp4` H.264; avoid special characters in path if possible |
| Port 3000 in use | Stop the other process or set `PORT=3001 npm start` |

---

## Need help?

- Server logs print to the terminal where you ran `npm start`
- API health: http://localhost:3000/healthz
- Re-run the automated smoke test: `powershell -File test_flow.ps1` *(note: progress and `/api/video/` tests in that script target older endpoints)*
