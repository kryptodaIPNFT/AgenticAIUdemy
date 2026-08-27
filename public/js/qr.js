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

  async function api(url, opts) {
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
      else el.textContent = 'Waiting for your phone\u2026 expires in ' + left + 's';
    };
    paint();
    tickTimer = setInterval(() => { left -= 1; paint(); }, 1000);
  }

  function startPolling() {
    pollTimer = setInterval(async () => {
      if (!current) return;
      try {
        const s = await api('/api/qr/status?token=' + encodeURIComponent(current.token));
        if (s.status === 'verified') {
          stopTimers();
          $('#qrLive').hidden = true;
          $('#okName').textContent = s.student ? s.student.name : 'student';
          $('#qrOk').hidden = false;
          setTimeout(() => { window.location.href = '/dashboard'; }, 900);
        } else if (s.status === 'expired') {
          stopTimers();
          $('#qrTimer').textContent = 'Code expired — press “Refresh QR code”.';
        }
      } catch (e) { /* keep polling; transient network blips are fine */ }
    }, POLL_MS);
  }

  $('#btnShowQr').addEventListener('click', showQr);
  $('#btnRefreshQr').addEventListener('click', showQr);
})();