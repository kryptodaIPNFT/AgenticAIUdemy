'use strict';

/**
 * Persistence for students / meta / progress / QR challenges.
 * Local `npm start` uses the data/ folder + in-memory QR codes.
 * Netlify Functions use Netlify Blobs so admin edits and QR login
 * survive across serverless invocations.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const USE_BLOBS = Boolean(
  process.env.NETLIFY ||
  process.env.NETLIFY_DEV ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.SITE_ID
);

const challenges = new Map();
let seeded = false;

function loadBundled(file, fallback) {
  try {
    if (file === 'students.json') return require('../data/students.json');
    if (file === 'meta.json') return require('../data/meta.json');
    if (file === 'progress.json') return require('../data/progress.json');
    if (file === 'video-manifest.json') return require('../data/video-manifest.json');
  } catch (e) { /* missing seed */ }
  return fallback;
}

const SEEDS = {
  'students.json': loadBundled('students.json', []),
  'meta.json': loadBundled('meta.json', {}),
  'progress.json': loadBundled('progress.json', {}),
  'video-manifest.json': loadBundled('video-manifest.json', [])
};

function getBlobStore() {
  const { getStore } = require('@netlify/blobs');
  return getStore('westmont-hub');
}

function attachLambdaEvent(event) {
  if (!event) return;
  try {
    const blobs = require('@netlify/blobs');
    if (typeof blobs.connectLambda === 'function') blobs.connectLambda(event);
  } catch (e) {
    console.error('store.attachLambdaEvent', e.message);
  }
}

function readFileJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeFileJson(file, value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(value, null, 2));
}

async function getJson(file, fallback) {
  if (!USE_BLOBS) return readFileJson(file, fallback);
  try {
    const existing = await getBlobStore().get(file, { type: 'json' });
    if (existing != null) return existing;
    const seed = Object.prototype.hasOwnProperty.call(SEEDS, file) ? SEEDS[file] : fallback;
    if (seed != null) await getBlobStore().setJSON(file, seed);
    return seed != null ? seed : fallback;
  } catch (e) {
    console.error('store.getJson', file, e.message);
    return Object.prototype.hasOwnProperty.call(SEEDS, file) ? SEEDS[file] : fallback;
  }
}

async function setJson(file, value) {
  if (!USE_BLOBS) {
    writeFileJson(file, value);
    return;
  }
  await getBlobStore().setJSON(file, value);
}

function newInviteKey() {
  return crypto.randomBytes(24).toString('base64url');
}

async function getStudents() {
  const list = await getJson('students.json', []);
  let changed = false;
  const next = (Array.isArray(list) ? list : []).map((s) => {
    if (s && s.inviteKey) return s;
    changed = true;
    return Object.assign({}, s, { inviteKey: newInviteKey() });
  });
  if (changed) {
    try { await setJson('students.json', next); } catch (e) {
      console.error('store.getStudents save', e.message);
    }
  }
  return next;
}

async function saveStudents(list) {
  await setJson('students.json', list);
}

async function getMeta() {
  const m = await getJson('meta.json', {});
  return m && typeof m === 'object' ? m : {};
}

async function saveMeta(m) {
  await setJson('meta.json', m);
}

async function getProgress() {
  const p = await getJson('progress.json', {});
  return p && typeof p === 'object' ? p : {};
}

async function saveProgress(p) {
  await setJson('progress.json', p);
}

async function getVideoManifest() {
  const bundled = SEEDS['video-manifest.json'];
  if (Array.isArray(bundled) && bundled.length) return bundled;
  return getJson('video-manifest.json', []);
}

function sweepMemoryChallenges() {
  const now = Date.now();
  for (const [t, c] of challenges) if (c.expiresAt <= now) challenges.delete(t);
}

async function putChallenge(entry) {
  if (!USE_BLOBS) {
    sweepMemoryChallenges();
    challenges.set(entry.token, entry);
    return;
  }
  const store = getBlobStore();
  await store.setJSON('qr:' + entry.token, entry);
  await store.setJSON('qrcode:' + entry.code, { token: entry.token, expiresAt: entry.expiresAt });
}

async function getChallengeByToken(token) {
  const key = String(token || '');
  if (!key) return null;
  if (!USE_BLOBS) {
    sweepMemoryChallenges();
    const c = challenges.get(key);
    if (!c || c.expiresAt <= Date.now()) return null;
    return c;
  }
  const c = await getBlobStore().get('qr:' + key, { type: 'json' });
  if (!c || c.expiresAt <= Date.now()) return null;
  return c;
}

async function getChallengeByCode(code) {
  const value = String(code || '').trim().toUpperCase();
  if (!value) return null;
  if (!USE_BLOBS) {
    sweepMemoryChallenges();
    const entry = [...challenges.values()].find((c) => c.code === value);
    if (!entry || entry.expiresAt <= Date.now()) return null;
    return entry;
  }
  const store = getBlobStore();
  const ref = await store.get('qrcode:' + value, { type: 'json' });
  if (!ref || !ref.token || ref.expiresAt <= Date.now()) return null;
  return getChallengeByToken(ref.token);
}

async function bootstrap() {
  if (seeded) return;
  seeded = true;
  if (!USE_BLOBS) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* ignore */ }
  }
  await getStudents();
}

module.exports = {
  USE_BLOBS,
  DATA_DIR,
  newInviteKey,
  getStudents,
  saveStudents,
  getMeta,
  saveMeta,
  getProgress,
  saveProgress,
  getVideoManifest,
  putChallenge,
  getChallengeByToken,
  getChallengeByCode,
  bootstrap,
  attachLambdaEvent
};
