/* ============================================================
   Phase 3 — /qr-reader: the phone-side processing engine.
   Arrives via:
     - phone camera scan of the desktop QR (URL contains ?code=)
     - email link
     - NFC card tap
   It verifies the code against a chosen student profile:
     POST /api/qr/verify { code, studentId }
   ============================================================ */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(window.location.search);
  const codeFromUrl = (params.get('code') || '').trim().toUpperCase();

  const codeEl = $('#rCode');
  codeEl.textContent = codeFromUrl || '——\u2014——';
  if (!codeFromUrl) {
    codeEl.title = 'No code in the link — it will be read from the QR scan flow';
  }

  function showError(msg) {
    const el = $('#rError');
    el.hidden = !msg;
    el.textContent = msg || '';
  }

  async function loadStudents() {
    try {
      const r = await fetch('/api/students');
      const j = await r.json();
      const sel = $('#rStudent');
      sel.innerHTML = '';
      (j.students || []).forEach((s) => {
        const o = document.createElement('option');
        o.value = s.id;
        o.textContent = s.name + (s.email ? ' — ' + s.email : '');
        sel.appendChild(o);
      });
      if (sel.options.length === 0) sel.innerHTML = '<option value="">No profiles available</option>';
    } catch (e) {
      $('#rStudent').innerHTML = '<option value="">Could not load profiles</option>';
    }
  }

  async function verify() {
    const code = codeFromUrl || (window.prompt('Enter the 6-character sign-in code shown on the desktop:') || '').trim().toUpperCase();
    if (!code) { showError('No sign-in code available.'); return; }
    const studentId = $('#rStudent').value;
    if (!studentId) { showError('Choose your student profile first.'); return; }
    const btn = $('#rVerify');
    btn.disabled = true;
    btn.textContent = 'Verifying\u2026';
    showError('');
    try {
      const r = await fetch('/api/qr/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, studentId })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Verification failed (' + r.status + ')');
      $('#rPending').hidden = true;
      $('#rDone').hidden = false;
      $('#rDoneText').textContent =
        (j.student ? j.student.name : 'You') +
        ' is now signed in on the desktop. It is opening the dashboard — you can close this page.';
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Verify & sign in';
      showError(e.message);
    }
  }

  loadStudents();
  $('#rVerify').addEventListener('click', verify);
})();