'use strict';

/**
 * Assemble the Netlify publish folder (dist/) and a video manifest
 * the serverless API can read (Lambda cannot see the static CDN files).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const VIDEOS = path.join(ROOT, 'videos');
const THUMBS = path.join(ROOT, 'thumbnails');
const DATA = path.join(ROOT, 'data');
const VIDEO_EXT = new Set(['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v', '.mkv', '.avi']);
const THUMB_EXT = ['.webp', '.jpg', '.jpeg', '.png', '.svg'];

function emptyDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true });
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

function placeholderThumbSvg(title) {
  const label = String(title || 'Lesson').slice(0, 48)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;');
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
  <text x="320" y="248" text-anchor="middle" fill="#ffffff" font-family="system-ui,sans-serif" font-size="28" font-weight="800">${label}</text>
  <text x="320" y="278" text-anchor="middle" fill="#e1ad62" font-family="system-ui,sans-serif" font-size="14" font-weight="700" letter-spacing="3">WESTMONT HUB</text>
</svg>`;
}

function hasThumb(dir, base) {
  return THUMB_EXT.some((ext) => fs.existsSync(path.join(dir, base + ext)));
}

function listVideoFiles() {
  if (!fs.existsSync(VIDEOS)) return [];
  return fs.readdirSync(VIDEOS)
    .filter((f) => VIDEO_EXT.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => {
      const st = fs.statSync(path.join(VIDEOS, name));
      return { name, size: st.size, mtimeMs: st.mtimeMs };
    });
}

emptyDir(DIST);
copyIfExists(path.join(ROOT, 'public'), DIST);
copyIfExists(path.join(ROOT, 'logo'), path.join(DIST, 'logo'));
copyIfExists(THUMBS, path.join(DIST, 'thumbnails'));
copyIfExists(VIDEOS, path.join(DIST, 'videos'));

const distThumbs = path.join(DIST, 'thumbnails');
fs.mkdirSync(distThumbs, { recursive: true });

const videos = listVideoFiles();
videos.forEach((v) => {
  const base = path.basename(v.name, path.extname(v.name));
  if (hasThumb(distThumbs, base) || hasThumb(THUMBS, base)) return;
  fs.writeFileSync(path.join(distThumbs, base + '.svg'), placeholderThumbSvg(humanTitle(v.name)), 'utf8');
});

fs.mkdirSync(DATA, { recursive: true });
const manifestPath = path.join(DATA, 'video-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(videos, null, 2));
fs.copyFileSync(manifestPath, path.join(DIST, 'video-manifest.json'));

const totalMb = videos.reduce((sum, v) => sum + v.size, 0) / (1024 * 1024);
console.log('Netlify build complete.');
console.log('  Publish dir : dist/');
console.log('  Videos      : ' + videos.length + ' (' + totalMb.toFixed(1) + ' MB)');
if (totalMb > 100) {
  console.warn('  Warning: video payload is large. Prefer Netlify CLI deploy, or keep lesson files under ~10 MB each for Git-based deploys.');
}
