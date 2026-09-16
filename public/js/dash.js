/**

 * Video Portal — Metro-style dashboard with completion tracking.

 */

(function () {

  'use strict';



  const EMOJIS = ['🎬', '🧩', '🎨', '⚡', '🔌', '🚀', '🧠', '🛠️'];

  const completedSet = new Set();



  function fetchJson(url, opts) {

    opts = opts || {};

    opts.credentials = 'include';

    if (/ngrok/i.test(location.hostname)) {

      opts.headers = Object.assign({ 'ngrok-skip-browser-warning': '1' }, opts.headers || {});

    }

    return fetch(url, opts).then((res) => {

      return res.json().then((body) => {

        if (!res.ok) throw new Error((body && body.error) || 'HTTP ' + res.status);

        return body;

      });

    });

  }



  function fmtTime(s) {

    s = Math.max(0, Math.floor(Number(s) || 0));

    const h = Math.floor(s / 3600);

    const m = Math.floor((s % 3600) / 60);

    const sec = String(s % 60).padStart(2, '0');

    return h > 0 ? h + ':' + String(m).padStart(2, '0') + ':' + sec : m + ':' + sec;

  }



  function thumbFallback(el, index, title) {

    el.classList.add('video-thumb--fallback');

    el.innerHTML = '';

    el.textContent = EMOJIS[(index + (title || '').length) % EMOJIS.length];

  }



  function makeCard(video, index, isDone) {

    const card = document.createElement('article');

    card.className = 'video-card video-card--clickable' + (isDone ? ' video-card--done' : '');

    card.tabIndex = 0;

    card.setAttribute('role', 'link');

    card.setAttribute('aria-label', (isDone ? 'Completed: ' : 'Watch ') + video.title);



    const watchHref = '/watch?id=' + encodeURIComponent(video.id);



    const thumb = document.createElement('div');

    thumb.className = 'video-thumb';

    if (isDone) {

      const badge = document.createElement('span');

      badge.className = 'video-complete-badge';

      badge.textContent = '✓ Completed';

      thumb.appendChild(badge);

    }

    if (video.thumbnail) {

      const img = document.createElement('img');

      img.src = video.thumbnail;

      img.alt = video.title + ' thumbnail';

      img.loading = 'lazy';

      img.decoding = 'async';

      img.addEventListener('error', () => {

        if (!thumb.querySelector('img')) return;

        img.remove();

        if (!thumb.querySelector('.video-complete-badge')) thumbFallback(thumb, index, video.title);

      });

      thumb.appendChild(img);

    } else if (!isDone) {

      thumbFallback(thumb, index, video.title);

    }



    const meta = document.createElement('div');

    meta.className = 'video-meta';



    const title = document.createElement('h3');

    title.className = 'video-title';

    title.textContent = video.title;



    const status = document.createElement('span');

    status.className = 'video-status' + (isDone ? ' video-status--done' : '');

    status.textContent = isDone ? '✓ Finished' : 'Not started';



    const duration = document.createElement('span');

    duration.className = 'video-duration';

    duration.textContent = video.duration ? '⏱ ' + fmtTime(video.duration) : '📁 ' + formatSize(video.size);



    const level = document.createElement('span');

    level.className = 'video-level level-' + String(video.level || 'Beginner').toLowerCase();

    level.textContent = video.level || 'Beginner';



    meta.append(title, status, duration, level);

    card.append(thumb, meta);



    const btn = document.createElement('a');

    btn.className = 'btn btn-primary video-watch-btn';

    btn.href = watchHref;

    btn.textContent = isDone ? '↻ Watch again' : '▶ Watch lesson';

    card.appendChild(btn);



    function go() { window.location.href = watchHref; }

    card.addEventListener('click', (e) => {

      if (e.target.closest('a')) return;

      go();

    });

    card.addEventListener('keydown', (e) => {

      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }

    });



    return card;

  }



  function formatSize(bytes) {

    if (!bytes) return 'Local file';

    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';

    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';

  }



  function setProgress(completed, total) {

    const text = document.getElementById('progressText');

    const fill = document.getElementById('progressFill');

    const track = document.getElementById('progressTrack');

    if (text) text.textContent = completed + ' / ' + total + ' completed';

    const pct = total ? Math.round((completed / total) * 100) : 0;

    if (fill) {

      fill.style.width = pct + '%';

      fill.classList.toggle('progress-fill--done', pct >= 100);

    }

    if (track) track.setAttribute('aria-valuenow', String(pct));

  }



  function showCelebration(force) {

    const modal = document.getElementById('celebrateModal');

    if (!modal) return;

    const key = 'wh-celebrate-shown';

    if (!force && sessionStorage.getItem(key) === '1') return;

    modal.hidden = false;

    document.body.classList.add('modal-open');

    sessionStorage.setItem(key, '1');

    const closeBtn = document.getElementById('celebrateClose');

    function close() {

      modal.hidden = true;

      document.body.classList.remove('modal-open');

    }

    if (closeBtn) closeBtn.onclick = close;

    modal.querySelectorAll('[data-close-celebrate]').forEach((el) => { el.onclick = close; });

  }



  function render() {

    const grid = document.getElementById('videoGrid');

    const empty = document.getElementById('emptyState');

    const note = document.getElementById('gridNote');

    if (!grid) return;



    const celebrateParam = new URLSearchParams(location.search).get('celebrate') === '1';



    Promise.all([

      fetchJson('/api/videos').catch(() => ({ videos: [], count: 0 })),

      fetchJson('/api/me').catch(() => ({ student: null })),

      fetchJson('/api/progress').catch(() => ({ completed: [], completedCount: 0, total: 0, allComplete: false }))

    ]).then(([payload, me, prog]) => {

      if (!me.student) {
        window.location.replace('/');
        return;
      }

      const videos = Array.isArray(payload.videos) ? payload.videos : [];

      const doneIds = new Set(Array.isArray(prog.completed) ? prog.completed : []);

      doneIds.forEach((id) => completedSet.add(id));



      const meEl = document.getElementById('meName');

      if (meEl && me.student) meEl.textContent = me.student.name;



      if (note) note.remove();

      grid.innerHTML = '';



      if (videos.length === 0) {

        if (empty) empty.hidden = false;

        setProgress(0, 0);

        return;

      }



      if (empty) empty.hidden = true;

      videos.forEach((v, i) => grid.appendChild(makeCard(v, i, doneIds.has(v.id))));

      const completedCount = videos.filter((v) => doneIds.has(v.id)).length;

      setProgress(completedCount, videos.length);



      if (prog.allComplete || (celebrateParam && completedCount >= videos.length)) {

        showCelebration(celebrateParam);

        if (celebrateParam) history.replaceState({}, '', '/dashboard');

      }

    }).catch(() => {

      if (note) note.textContent = 'Could not load lessons. Is the server running?';

    });

  }



  if (document.readyState === 'loading') {

    document.addEventListener('DOMContentLoaded', render);

  } else {

    render();

  }



  const logoutBtn = document.getElementById('btnLogout');

  if (logoutBtn) {

    logoutBtn.addEventListener('click', () => {

      logoutBtn.disabled = true;

      logoutBtn.textContent = 'Signing out…';

      fetchJson('/api/logout', { method: 'POST' })

        .catch(() => ({}))

        .then(() => { window.location.href = '/'; });

    });

  }

})();


