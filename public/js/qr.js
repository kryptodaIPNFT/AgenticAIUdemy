/* ============================================================
   Phase 2 + 4 — Landing page QR authenticator + live auth loop
   - "Show QR code" -> GET /api/qr/challenge (token, code, PNG)
   - Polls GET /api/qr/status every 2s (live auth loop)
   - On "verified" -> binds student to this desktop session,
     then auto-redirects to /dashboard (no user interaction)
   ============================================================ */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const POLL_MS = 2000;
  let current = null;
  let pollTimer = null;
  let tickTimer = null;

  function apiHeaders(extra) {
    const h = Object.assign({}, extra || {});
    if (/ngrok/i.test(location.hostname)) h['ngrok-skip-browser-warning'] = '1';
    return h;
  }

  async function api(url, opts) {
    opts = opts || {};
    opts.credentials = 'include';
    opts.headers = apiHeaders(opts.headers);
    const r = await fetch(url, opts);
    let j = {};
    try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(j.error || 'Request failed (' + r.status + ')');
    return j;
  }

  function setBusy(btn, busy, label) {
    btn.disabled = busy;
    if (!busy) btn.textContent = label;
  }

  function showError(msg) {
    const el = $('#qrError');
    el.hidden = !msg;
    el.textContent = msg || '';
  }

  function stopTimers() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }

  async function showQr() {
    stopTimers();
    showError('');
    const btn = $('#btnShowQr');
    setBusy(btn, true, '');
    btn.textContent = 'Creating code\u2026';
    try {
      current = await api('/api/qr/challenge');
      const img = $('#qrImg');
      img.src = current.qr || '';
      img.style.display = current.qr ? '' : 'none';
      $('#qrCode').textContent = current.code;
      $('#qrIdle').hidden = true;
      $('#qrOk').hidden = true;
      $('#qrLive').hidden = false;
      startCountdown(current.expiresIn);
      startPolling();
    } catch (e) {
      showError(e.message);
    } finally {
      setBusy(btn, false, 'Show QR code');
    }
  }

  function startCountdown(seconds) {
    let left = seconds;
    const el = $('#qrTimer');
    const paint = () => {
      if (left <= 0) el.textContent = 'Code expired — press “Refresh QR code”.';
      else el.textContent = 'Waiting for unique QR-reader scan\u2026 expires in ' + left + 's';
    };
    paint();
    tickTimer = setInterval(() => { left -= 1; paint(); }, 1000);
  }

  function onVerified(student) {
    stopTimers();
    $('#qrIdle').hidden = true;
    $('#qrLive').hidden = true;
    $('#okName').textContent = student ? student.name : 'student';
    $('#qrOk').hidden = false;
    setTimeout(() => { window.location.href = '/dashboard'; }, 900);
  }

  async function pollOnce() {
    if (!current) return;
    const s = await api('/api/qr/status?token=' + encodeURIComponent(current.token));
    if (s.status === 'verified') {
      onVerified(s.student);
    } else if (s.status === 'expired') {
      stopTimers();
      $('#qrTimer').textContent = 'Code expired — press “Refresh QR code”.';
    }
  }

  function startPolling() {
    pollOnce().catch(() => {});
    pollTimer = setInterval(() => { pollOnce().catch(() => {}); }, POLL_MS);
  }

  async function checkAlreadySignedIn() {
    try {
      const me = await api('/api/me');
      if (me.student) window.location.replace('/dashboard');
    } catch (e) { /* not signed in yet */ }
  }

  function loadIntroCover() {
    const video = document.getElementById('introVideo');
    if (!video) return;
    fetch('/api/intro', { credentials: 'include', headers: apiHeaders() })
      .then((res) => res.json())
      .then((body) => {
        if (body && body.thumbnail) video.setAttribute('poster', body.thumbnail);
      })
      .catch(() => {});
  }

  $('#btnShowQr').addEventListener('click', showQr);
  $('#btnRefreshQr').addEventListener('click', showQr);
  loadIntroCover();
  checkAlreadySignedIn();
})();