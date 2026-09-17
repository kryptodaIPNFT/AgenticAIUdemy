/**

 * Video Portal — watch page with completion tracking.

 */

(function () {

  'use strict';



  const SNIPPET_TYPES = {

    code: { label: 'Code', icon: '{ }' },

    command: { label: 'Command', icon: '⌘' },

    prompt: { label: 'Prompt', icon: '✦' },

    text: { label: 'Note', icon: 'ℹ' }

  };



  const params = new URLSearchParams(location.search);

  const videoId = params.get('id');

  const player = document.getElementById('player');

  if (!player || !videoId) return;



  const ui = {

    title: document.getElementById('watchTitle'),

    desc: document.getElementById('watchDesc'),

    resourceRow: document.getElementById('resourceRow'),

    resourceBtn: document.getElementById('resourceBtn'),

    snippetList: document.getElementById('snippetList'),

    snippetEmpty: document.getElementById('snippetEmpty'),

    markDone: document.getElementById('btnMarkDone')

  };



  function fetchJson(url, opts) {

    opts = opts || {};

    opts.credentials = 'include';

    return fetch(url, opts).then((res) => {

      return res.json().then((body) => {

        if (!res.ok) throw new Error((body && body.error) || 'HTTP ' + res.status);

        return body;

      });

    });

  }



  function setMarkDoneState(done) {

    if (!ui.markDone) return;

    if (done) {

      ui.markDone.textContent = 'Lesson complete ✓';

      ui.markDone.disabled = true;

      ui.markDone.classList.add('is-complete');

    }

  }



  function markComplete() {

    if (!ui.markDone || ui.markDone.disabled) return;

    ui.markDone.disabled = true;

    ui.markDone.textContent = 'Saving…';

    fetchJson('/api/progress/complete', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ videoId: videoId })

    }).then((data) => {

      setMarkDoneState(true);

      sessionStorage.removeItem('wh-celebrate-shown');

      if (data.allComplete) {

        window.location.href = '/dashboard?celebrate=1';

      }

    }).catch(() => {

      ui.markDone.disabled = false;

      ui.markDone.textContent = 'Mark lesson as complete';

      alert('Could not save completion. Are you still signed in?');

    });

  }



  function snippetType(raw) {

    const key = String(raw || 'code').toLowerCase();

    return SNIPPET_TYPES[key] || SNIPPET_TYPES.text;

  }



  function initSpeedButtons() {

    document.querySelectorAll('.speed-btn').forEach((btn) => {

      btn.addEventListener('click', () => {

        const rate = parseFloat(btn.getAttribute('data-rate') || '1');

        player.playbackRate = rate;

        document.querySelectorAll('.speed-btn').forEach((b) => b.classList.remove('is-active'));

        btn.classList.add('is-active');

      });

    });

  }



  function copyText(text, btn) {

    navigator.clipboard.writeText(text || '').then(() => {

      const prev = btn.textContent;

      btn.textContent = 'Copied ✓';

      btn.classList.add('is-copied');

      setTimeout(() => {

        btn.textContent = prev;

        btn.classList.remove('is-copied');

      }, 1600);

    }).catch(() => {});

  }



  function updateEmptyState(hasSnippets, hasResource) {

    if (!ui.snippetEmpty) return;

    ui.snippetEmpty.hidden = hasSnippets || hasResource;

  }



  function renderSnippets(snippets) {

    if (!ui.snippetList) return;

    const list = Array.isArray(snippets) ? snippets.filter((s) => s && String(s.code || '').trim()) : [];

    ui.snippetList.innerHTML = '';

    if (!list.length) return;



    list.forEach((s) => {

      const kind = snippetType(s.type || s.lang);

      const wrap = document.createElement('article');

      wrap.className = 'snippet-block snippet-block--' + (s.type || s.lang || 'code');



      const head = document.createElement('div');

      head.className = 'snippet-head';



      const meta = document.createElement('div');

      meta.className = 'snippet-meta';

      meta.innerHTML = '<span class="snippet-type-badge"></span><strong></strong>';

      meta.querySelector('.snippet-type-badge').textContent = kind.icon + ' ' + kind.label;

      meta.querySelector('strong').textContent = s.title || kind.label;



      const copyBtn = document.createElement('button');

      copyBtn.type = 'button';

      copyBtn.className = 'btn btn-sm btn-primary btn-copy snippet-copy-btn';

      copyBtn.textContent = 'Copy to clipboard';

      copyBtn.setAttribute('aria-label', 'Copy snippet to clipboard');

      copyBtn.addEventListener('click', () => copyText(s.code, copyBtn));



      head.append(meta, copyBtn);



      const pre = document.createElement('pre');

      pre.className = 'snippet-code';

      pre.textContent = s.code || '';



      wrap.append(head, pre);

      ui.snippetList.appendChild(wrap);

    });

  }



  function boot() {

    initSpeedButtons();



    Promise.all([

      fetchJson('/api/me').catch(() => ({ student: null })),

      fetchJson('/api/videos'),

      fetchJson('/api/progress').catch(() => ({ completed: [] }))

    ]).then(([me, payload, prog]) => {

      if (!me.student) {

        window.location.replace('/');

        return;

      }

      const videos = Array.isArray(payload.videos) ? payload.videos : [];

      const video = videos.find((v) => v.id === videoId);

      if (!video) throw new Error('not found');



      document.title = video.title + ' — E-Learning Streaming Solution';

      if (ui.title) ui.title.textContent = video.title;

      if (ui.desc) ui.desc.textContent = video.description || 'No description yet — your admin can add one from the admin panel.';



      player.src = video.url;

      player.load();



      if (video.resourceUrl && ui.resourceRow && ui.resourceBtn) {

        ui.resourceRow.hidden = false;

        ui.resourceBtn.href = video.resourceUrl;

      }



      renderSnippets(video.snippets);

      updateEmptyState(

        Array.isArray(video.snippets) && video.snippets.some((s) => s && String(s.code || '').trim()),

        Boolean(video.resourceUrl)

      );



      const doneIds = new Set(Array.isArray(prog.completed) ? prog.completed : []);

      if (doneIds.has(videoId)) setMarkDoneState(true);



      if (ui.markDone) {

        ui.markDone.addEventListener('click', markComplete);

      }

    }).catch(() => {

      if (ui.title) ui.title.textContent = 'Video not found';

      if (ui.desc) ui.desc.textContent = 'This lesson does not exist or was removed from the videos folder.';

    });

  }



  if (document.readyState === 'loading') {

    document.addEventListener('DOMContentLoaded', boot);

  } else {

    boot();

  }

})();


