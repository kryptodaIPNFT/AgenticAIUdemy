# naeed — Video Portal

A self-hosted **Udemy-style video streaming portal** — named **naeed**,
focused on **Agentic AI &amp; vibe coding** videos — built with Node.js +
Express and vanilla HTML/CSS/JS (no frontend frameworks).

> Landing title: **“Agentic AI is here. Take part of it.”**

## Stack

- Node.js + Express — static files + JSON API (`server.js`)
- Vanilla HTML/CSS/JS in `public/` — no build step, no frameworks
- Course videos live in `videos/` (served in Phase 3)
- CSS custom properties — blue & white theme with a gold/bronze `#e1ad62` accent

## Run

```bash
npm install
npm start        # http://localhost:3000
# or for auto-reload:
npm run dev
```

## Project structure

```
Udemy_demo/
- server.js            # Express server (static serving + API, as it grows)
- package.json
- public/
  - index.html         # Phase 1 shell (replaced by registration gate in Phase 2)
  - css/styles.css     # Global tokens + animated background + light/dark theme
  - js/theme.js        # Global light/dark mode toggle
- videos/              # Drop course videos here
- logo/                # Brand logos (served at /logo)
```

## Roadmap

1. **Phase 1** — Project setup, animated fluid blue/white background, global light/dark toggle ✅
2. **Phase 2** — Student registration + login gate (session-based, gold `#e1ad62` accents)
3. **Phase 3** — Video dashboard + Metro grid (max 2 cards/row) with `#0068b3` base that fades to white (light) / black (dark); `GET /api/videos`
4. **Phase 4** — Full video player (progress tracking, resume, playback speed, chapters)
5. **Phase 5** — Admin & content management (upload, edit, delete courses)
6. **Phase 6** — QR-code login tied to student profiles

## Theme

- Primary: blue & white — animated moving gradient with drifting soft orbs
- Accent/brand: gold/bronze `#e1ad62`
- Dashboard (Phase 3): starts at `#0068b3`, smoothly fades to white in light mode
  and black in dark mode
- Light/dark mode: global toggle (top-right), persisted in `localStorage`,
  applied pre-paint to avoid flash, 0.55s crossfade, `prefers-reduced-motion` respected

## API Endpoints (Phase 1)

- `GET /healthz` — health check
- Static: `/` (frontend), `/css`, `/js`, `/logo`
- `GET /api/videos` arrives with Phase 3