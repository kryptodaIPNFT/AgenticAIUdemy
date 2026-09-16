# Westmont Hub — logo

The portal header uses **`/logo/westmont-hub.svg`**.

## Current setup

- File: `logo/westmont-hub.svg`
- Brand colors: blue `#0068b3`, gold `#e1ad62`
- Served at: http://localhost:3000/logo/westmont-hub.svg

## Replace with your own logo

1. Add your file to the `logo/` folder, e.g.:
   - `logo/westmont-hub.svg` (recommended — sharp at any size)
   - `logo/westmont-hub.png` or `.webp`

2. Update the `<img>` and favicon paths in:
   - `public/index.html`
   - `public/dashboard.html`
   - `public/watch.html`
   - `public/admin.html`
   - `public/qr-reader.html`

3. Hard-refresh the browser (Ctrl+F5).

If you have an official **Westmont Hub** asset, drop it in `logo/` using the same filename to replace the placeholder automatically.
