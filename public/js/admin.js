/**
 * Westmont Video Portal — per-lesson admin editor.
 * One lesson selected at a time; each save writes only that video's meta key.
 */
(function () {
  'use strict';

  const picker = document.getElementById('lessonPicker');
  const form = document.getElementById('lessonEditForm');
  const emptyEl = document.getElementById('adminEmpty');
  const gate = document.getElementById('adminGate');
  const loginForm = document.getElementById('adminLoginForm');
  const loginError = document.getElementById('adminLoginError');
  const editor = document.getElementById('adminEditor');
  const logoutBtn = document.getElementById('btnLogout');

  const ui = {
    fileHint: document.getElementById('lessonFileHint'),
    heading: document.getElementById('lessonEditHeading'),
    saveTarget: document.getElementById('lessonSaveTarget'),
    title: document.getElementById('lessonTitle'),
    description: document.getElementById('lessonDescription'),
    resource: document.getElementById('lessonResource'),
    snippets: document.getElementById('lessonSnippets'),
    addSnippet: document.getElementById('btnAddSnippet'),
    status: document.getElementById('lessonSaveStatus')
  };

  let videos = [];
  let metaMap = {};
  let currentId = null;
  let dirty = false;

  function fetchJson(url, opts) {
    return fetch(url, opts).then((res) => {
      return res.json().then((body) => {
        if (!res.ok) throw new Error((body && body.error) || 'HTTP ' + res.status);
        return body;
      });
    });
  }

  function currentVideo() {
    return videos.find((v) => v.id === currentId) || null;
  }

  function metaFor(id) {
    return metaMap[id] || {};
  }

  function setDirty(flag) {
    dirty = flag;
  }

  function snippetRow(snippet) {
    const type = snippet.type || snippet.lang || 'code';
    const wrap = document.createElement('div');
    wrap.className = 'admin-snippet';
    wrap.innerHTML =
      '<div class="admin-snippet-grid">' +
        '<label>Label / title<input type="text" class="field" data-snippet-title placeholder="e.g. Install dependencies" autocomplete="off" /></label>' +
        '<label>Type<select class="field" data-snippet-type>' +
          '<option value="code">Code</option>' +
          '<option value="command">Terminal command</option>' +
          '<option value="prompt">AI prompt</option>' +
          '<option value="text">General note</option>' +
        '</select></label>' +
      '</div>' +
      '<label>Content<textarea class="field" rows="6" data-snippet-code placeholder="Paste code, command, or prompt…" autocomplete="off"></textarea></label>' +
      '<button type="button" class="admin-btn admin-btn-danger admin-snippet-remove">Remove snippet</button>';

    wrap.querySelector('[data-snippet-title]').value = snippet.title || '';
    wrap.querySelector('[data-snippet-type]').value = type;
    wrap.querySelector('[data-snippet-code]').value = snippet.code || '';
    wrap.querySelector('.admin-snippet-remove').addEventListener('click', () => {
      wrap.remove();
      setDirty(true);
    });
    wrap.querySelectorAll('input, textarea, select').forEach((el) => {
      el.addEventListener('input', () => setDirty(true));
      el.addEventListener('change', () => setDirty(true));
    });
    return wrap;
  }

  function renderSnippets(list) {
    if (!ui.snippets) return;
    ui.snippets.innerHTML = '';
    (list || []).forEach((s) => ui.snippets.appendChild(snippetRow(s)));
  }

  function fillForm(video) {
    if (!video || !form) return;
    const entry = metaFor(video.id);
    const autoTitle = video.title;
    const customTitle = entry.title || '';

    if (ui.heading) ui.heading.textContent = customTitle || autoTitle;
    if (ui.saveTarget) ui.saveTarget.textContent = video.name;
    if (ui.fileHint) ui.fileHint.textContent = 'Video file: ' + video.name;
    if (ui.title) ui.title.value = customTitle;
    if (ui.description) ui.description.value = entry.description || '';
    if (ui.resource) ui.resource.value = entry.resourceUrl || '';
    renderSnippets(Array.isArray(entry.snippets) ? entry.snippets : []);
    if (ui.status) {
      ui.status.textContent = '';
      ui.status.className = 'admin-status';
    }
    form.hidden = false;
    setDirty(false);
  }

  function populatePicker() {
    if (!picker) return;
    picker.innerHTML = '';
    videos.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.id;
      const hasMeta = metaMap[v.id] && (metaMap[v.id].description || metaMap[v.id].resourceUrl || (metaMap[v.id].snippets && metaMap[v.id].snippets.length));
      opt.textContent = v.title + (hasMeta ? ' ✓' : '');
      picker.appendChild(opt);
    });
    if (videos.length) {
      currentId = videos[0].id;
      picker.value = currentId;
      fillForm(currentVideo());
      if (emptyEl) emptyEl.hidden = true;
    } else {
      currentId = null;
      if (form) form.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
    }
  }

  function collectSnippets() {
    const nodes = ui.snippets ? ui.snippets.querySelectorAll('.admin-snippet') : [];
    const out = [];
    nodes.forEach((node) => {
      const code = node.querySelector('[data-snippet-code]').value;
      if (!String(code).trim()) return;
      out.push({
        title: node.querySelector('[data-snippet-title]').value.trim(),
        type: node.querySelector('[data-snippet-type]').value.trim() || 'code',
        code: code
      });
    });
    return out;
  }

  function saveCurrentLesson(e) {
    if (e) e.preventDefault();
    const video = currentVideo();
    if (!video) return;

    if (ui.status) {
      ui.status.textContent = 'Saving…';
      ui.status.className = 'admin-status';
    }

    const payload = {
      video: video.id,
      title: ui.title ? ui.title.value.trim() : '',
      description: ui.description ? ui.description.value : '',
      resourceUrl: ui.resource ? ui.resource.value.trim() : '',
      snippets: collectSnippets()
    };

    fetchJson('/api/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(() => {
      metaMap[video.id] = {
        title: payload.title,
        description: payload.description,
        resourceUrl: payload.resourceUrl,
        snippets: payload.snippets
      };
      if (payload.title) video.title = payload.title;
      setDirty(false);
      if (ui.status) {
        ui.status.textContent = 'Saved for "' + video.name + '" only ✓';
        ui.status.className = 'admin-status admin-status--ok';
      }
      if (ui.heading) ui.heading.textContent = payload.title || video.title;
      populatePicker();
      picker.value = video.id;
    }).catch((err) => {
      if (ui.status) {
        ui.status.textContent = err.message;
        ui.status.className = 'admin-status admin-status--err';
      }
    });
  }

  function onPickerChange() {
    if (!picker) return;
    const nextId = picker.value;
    if (dirty && !confirm('You have unsaved changes for the current lesson. Switch anyway?')) {
      picker.value = currentId;
      return;
    }
    currentId = nextId;
    fillForm(currentVideo());
  }

  function loadContent() {
    Promise.all([
      fetchJson('/api/videos'),
      fetchJson('/api/meta')
    ]).then(([videoPayload, metaPayload]) => {
      videos = Array.isArray(videoPayload.videos) ? videoPayload.videos : [];
      metaMap = (metaPayload && metaPayload.meta) || {};
      populatePicker();
    }).catch((err) => {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = 'Could not load lessons: ' + err.message;
      }
    });
  }

  function setAdminUI(authed) {
    if (gate) gate.hidden = authed;
    if (editor) editor.hidden = !authed;
    if (logoutBtn) logoutBtn.hidden = !authed;
    if (authed) {
      loadContent();
      loadInvites();
    }
  }

  /* ---------- unique QR-reader invite links ---------- */
  const inviteBody = document.getElementById('inviteTableBody');
  const inviteEmpty = document.getElementById('inviteEmpty');
  const inviteTable = document.getElementById('inviteTable');
  const inviteForm = document.getElementById('inviteCreateForm');
  const inviteStatus = document.getElementById('inviteStatus');
  const inviteName = document.getElementById('inviteName');
  const inviteEmail = document.getElementById('inviteEmail');

  function setInviteStatus(msg, ok) {
    if (!inviteStatus) return;
    inviteStatus.textContent = msg || '';
    inviteStatus.className = 'admin-status' + (msg ? (ok ? ' admin-status--ok' : ' admin-status--err') : '');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return Promise.resolve();
  }

  function renderInvites(list) {
    if (!inviteBody) return;
    inviteBody.innerHTML = '';
    const rows = Array.isArray(list) ? list : [];
    if (inviteTable) inviteTable.hidden = rows.length === 0;
    if (inviteEmpty) inviteEmpty.hidden = rows.length > 0;
    rows.forEach((s) => {
      const tr = document.createElement('tr');
      const who = document.createElement('td');
      who.innerHTML =
        '<div class="admin-cell-title"></div>' +
        '<div class="admin-invite-email"></div>';
      who.querySelector('.admin-cell-title').textContent = s.name || 'Student';
      who.querySelector('.admin-invite-email').textContent = s.email || '';

      const urlTd = document.createElement('td');
      const urlBox = document.createElement('div');
      urlBox.className = 'admin-invite-url';
      const urlEl = document.createElement('code');
      urlEl.textContent = s.inviteUrl || '';
      urlBox.appendChild(urlEl);
      urlTd.appendChild(urlBox);

      const act = document.createElement('td');
      act.className = 'admin-invite-actions';
      act.innerHTML =
        '<button type="button" class="admin-btn" data-copy>Copy link</button>' +
        '<button type="button" class="admin-btn" data-regen>New link</button>' +
        '<button type="button" class="admin-btn admin-btn-danger" data-del>Remove</button>';

      act.querySelector('[data-copy]').addEventListener('click', () => {
        copyText(s.inviteUrl || '').then(() => setInviteStatus('Copied link for ' + s.name + '.', true))
          .catch(() => setInviteStatus('Could not copy — select the URL and copy it manually.', false));
      });
      act.querySelector('[data-regen]').addEventListener('click', () => {
        if (!confirm('Create a new link for ' + s.name + '? The old URL will stop working.')) return;
        fetchJson('/api/admin/students/regenerate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: s.id })
        }).then(() => {
          setInviteStatus('New unique link created for ' + s.name + '.', true);
          loadInvites();
        }).catch((err) => setInviteStatus(err.message, false));
      });
      act.querySelector('[data-del]').addEventListener('click', () => {
        if (!confirm('Remove ' + s.name + ' and revoke their QR-reader link?')) return;
        fetchJson('/api/admin/students/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: s.id })
        }).then(() => {
          setInviteStatus('Removed ' + s.name + '.', true);
          loadInvites();
        }).catch((err) => setInviteStatus(err.message, false));
      });

      tr.appendChild(who);
      tr.appendChild(urlTd);
      tr.appendChild(act);
      inviteBody.appendChild(tr);
    });
  }

  function loadInvites() {
    fetchJson('/api/admin/students')
      .then((body) => renderInvites(body.students))
      .catch((err) => setInviteStatus(err.message, false));
  }

  if (inviteForm) {
    inviteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      setInviteStatus('Creating…', true);
      fetchJson('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inviteName ? inviteName.value : '',
          email: inviteEmail ? inviteEmail.value : ''
        })
      }).then((body) => {
        inviteForm.reset();
        setInviteStatus('Unique link created for ' + (body.student && body.student.name) + '.', true);
        loadInvites();
      }).catch((err) => setInviteStatus(err.message, false));
    });
  }

  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.getAttribute('data-tab');
      document.querySelectorAll('.admin-tab').forEach((t) => {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      const invites = document.getElementById('tabInvites');
      const lessons = document.getElementById('tabLessons');
      if (invites) invites.hidden = id !== 'invites';
      if (lessons) lessons.hidden = id !== 'lessons';
    });
  });

  if (picker) picker.addEventListener('change', onPickerChange);
  if (form) form.addEventListener('submit', saveCurrentLesson);
  if (ui.addSnippet) {
    ui.addSnippet.addEventListener('click', () => {
      ui.snippets.appendChild(snippetRow({ title: '', type: 'code', code: '' }));
      setDirty(true);
    });
  }
  [ui.title, ui.description, ui.resource].forEach((el) => {
    if (!el) return;
    el.addEventListener('input', () => setDirty(true));
  });

  if (loginForm) {
    const passInput = loginForm.querySelector('input[type="password"]');
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (loginError) loginError.hidden = true;
      fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passInput ? passInput.value : '' })
      })
        .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
        .then(({ ok, body }) => {
          if (ok) setAdminUI(true);
          else if (loginError) {
            loginError.textContent = (body && body.error) || 'Wrong admin password.';
            loginError.hidden = false;
            if (passInput) { passInput.value = ''; passInput.focus(); }
          }
        })
        .catch(() => {
          if (loginError) {
            loginError.textContent = 'Could not reach the server. Try again.';
            loginError.hidden = false;
          }
        });
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      fetch('/api/admin/logout', { method: 'POST' }).catch(() => {}).then(() => {
        setAdminUI(false);
        if (loginForm) loginForm.reset();
        if (loginError) loginError.hidden = true;
      });
    });
  }

  fetchJson('/api/me')
    .then((me) => { if (me && me.admin) setAdminUI(true); })
    .catch(() => {});
})();
