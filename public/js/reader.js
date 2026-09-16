/* ============================================================
   /qr-reader — invite-only in-app scanner
   Requires ?k= unique admin-issued token. Desktop QR is not a URL,
   so the phone Camera app cannot open this page or complete login.
   ============================================================ */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(window.location.search);
  const inviteKey = (params.get('k') || '').trim();
  const QR_PREFIX = 'WHUB-SIGNIN:';
  let activeCode = '';
  let invitedStudent = null;

  const ui = {
    blocked: $('#rBlocked'),
    blockedText: $('#rBlockedText'),
    scan: $('#rScan'),
    verifyPanel: $('#rVerifyPanel'),
    video: $('#rVideo'),
    scanHint: $('#rScanHint'),
    startCam: $('#rStartCam'),
    stopCam: $('#rStopCam'),
    manualCode: $('#rManualCode'),
    manualGo: $('#rManualGo'),
    codeEl: $('#rCode'),
    rescan: $('#rRescan'),
    error: $('#rError'),
    invitedName: $('#rInvitedName'),
    verifyName: $('#rVerifyName')
  };

  let stream = null;
  let scanTimer = null;
  let detector = null;

  function apiHeaders(extra) {
    const h = Object.assign({}, extra || {});
    if (/ngrok/i.test(location.hostname)) h['ngrok-skip-browser-warning'] = '1';
    return h;
  }

  function showError(msg) {
    if (!ui.error) return;
    ui.error.hidden = !msg;
    ui.error.textContent = msg || '';
  }

  function setInvitedName(name) {
    const n = name || 'student';
    if (ui.invitedName) ui.invitedName.textContent = n;
    if (ui.verifyName) ui.verifyName.textContent = n;
  }

  function showBlocked(msg) {
    stopCamera();
    if (ui.scan) ui.scan.hidden = true;
    if (ui.verifyPanel) ui.verifyPanel.hidden = true;
    if (ui.blocked) ui.blocked.hidden = false;
    if (ui.blockedText && msg) ui.blockedText.textContent = msg;
  }

  function parseCodeFromQrText(raw) {
    const text = String(raw || '').trim();
    if (!text) return '';
    const upper = text.toUpperCase();
    if (upper.indexOf(QR_PREFIX) === 0) {
      return text.slice(QR_PREFIX.length).trim().toUpperCase();
    }
    if (/^[23456789BCDFGHJKMNPQRTVWXY]{6}$/i.test(text)) return text.toUpperCase();
    return '';
  }

  function showVerifyPanel(code) {
    activeCode = (code || '').trim().toUpperCase();
    stopCamera();
    if (ui.blocked) ui.blocked.hidden = true;
    if (ui.scan) ui.scan.hidden = true;
    if (ui.verifyPanel) ui.verifyPanel.hidden = false;
    if (ui.codeEl) ui.codeEl.textContent = activeCode || '———';
    showError(activeCode ? '' : 'No sign-in code — scan the desktop QR or enter the code manually.');
  }

  function showScanPanel() {
    activeCode = '';
    if (ui.blocked) ui.blocked.hidden = true;
    if (ui.verifyPanel) ui.verifyPanel.hidden = true;
    if (ui.scan) ui.scan.hidden = false;
    showError('');
    startCamera();
  }

  function stopCamera() {
    if (scanTimer) { cancelAnimationFrame(scanTimer); scanTimer = null; }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (ui.video) ui.video.srcObject = null;
    if (ui.stopCam) ui.stopCam.hidden = true;
  }

  function onQrDetected(raw) {
    const code = parseCodeFromQrText(raw);
    if (!code) return false;
    if (navigator.vibrate) navigator.vibrate(80);
    showVerifyPanel(code);
    return true;
  }

  async function scanFrame() {
    if (!detector || !ui.video || ui.video.readyState < 2) {
      scanTimer = requestAnimationFrame(scanFrame);
      return;
    }
    try {
      const codes = await detector.detect(ui.video);
      if (codes && codes.length) {
        for (let i = 0; i < codes.length; i++) {
          if (onQrDetected(codes[i].rawValue)) return;
        }
      }
    } catch (e) { /* keep scanning */ }
    scanTimer = requestAnimationFrame(scanFrame);
  }

  async function startCamera() {
    if (!ui.scan || ui.scan.hidden) return;
    if (ui.scanHint) ui.scanHint.textContent = 'Requesting camera access…';
    if (ui.startCam) ui.startCam.hidden = true;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (ui.scanHint) ui.scanHint.textContent = 'Camera not supported in this browser. Enter the 6-character code from the desktop instead.';
      if (ui.startCam) ui.startCam.hidden = false;
      return;
    }

    if (typeof BarcodeDetector === 'undefined') {
      if (ui.scanHint) ui.scanHint.textContent = 'In-app scan needs Chrome or Edge. Enter the 6-character code shown on the desktop.';
      if (ui.startCam) ui.startCam.hidden = false;
      return;
    }

    try {
      detector = new BarcodeDetector({ formats: ['qr_code'] });
    } catch (e) {
      if (ui.scanHint) ui.scanHint.textContent = 'Could not start QR scanner. Enter the code manually.';
      return;
    }

    try {
      stopCamera();
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      ui.video.srcObject = stream;
      await ui.video.play();
      if (ui.scanHint) ui.scanHint.textContent = 'Scanning… align the desktop QR inside the frame.';
      if (ui.stopCam) ui.stopCam.hidden = false;
      scanFrame();
    } catch (e) {
      if (ui.scanHint) ui.scanHint.textContent = 'Camera blocked. Allow camera in browser settings, or enter the code manually.';
      if (ui.startCam) {
        ui.startCam.hidden = false;
        ui.startCam.textContent = 'Try camera again';
      }
    }
  }

  async function verify() {
    const code = activeCode || (ui.manualCode && ui.manualCode.value.trim().toUpperCase()) || '';
    if (!code) { showError('No sign-in code. Scan the desktop QR first.'); return; }
    if (!inviteKey) { showError('Open your unique QR-reader link first.'); return; }
    const btn = $('#rVerify');
    if (btn) { btn.disabled = true; btn.textContent = 'Verifying…'; }
    showError('');
    try {
      const r = await fetch('/api/qr/verify', {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ code, inviteKey })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Verification failed (' + r.status + ')');
      $('#rPending').hidden = true;
      $('#rDone').hidden = false;
      $('#rDoneText').textContent =
        (j.student ? j.student.name : 'You') +
        ' is now signed in on the desktop. It is opening the dashboard — you can close this page.';
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Verify & sign in'; }
      showError(e.message);
    }
  }

  async function init() {
    if (!inviteKey) {
      showBlocked('This QR reader only works from a unique link issued in Admin. Scanning the desktop QR with your phone Camera app cannot sign you in. Ask your course admin to send you your personal link.');
      return;
    }

    try {
      const r = await fetch('/api/invite?k=' + encodeURIComponent(inviteKey), {
        credentials: 'include',
        headers: apiHeaders()
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.student) {
        throw new Error(j.error || 'This unique link is not valid.');
      }
      invitedStudent = j.student;
      setInvitedName(invitedStudent.name);
    } catch (e) {
      showBlocked(e.message);
      return;
    }

    if (ui.startCam) ui.startCam.addEventListener('click', startCamera);
    if (ui.stopCam) ui.stopCam.addEventListener('click', stopCamera);
    if (ui.rescan) ui.rescan.addEventListener('click', showScanPanel);
    if (ui.manualGo) {
      ui.manualGo.addEventListener('click', () => {
        const code = ui.manualCode ? ui.manualCode.value.trim().toUpperCase() : '';
        if (!code) { showError('Enter the 6-character code from the desktop.'); return; }
        showVerifyPanel(code);
      });
    }
    const verifyBtn = $('#rVerify');
    if (verifyBtn) verifyBtn.addEventListener('click', verify);

    showScanPanel();
  }

  window.addEventListener('pagehide', stopCamera);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
