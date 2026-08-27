/**
 * Video Portal — video grid renderer (Phase 3)
 *
 * Powers two surfaces:
 *   1. index.html     → .video-grid (landing hero grid)
 *   2. dashboard.html → .dash-wrap  (my dashboard with progress + resume)
 */
(function () {
  "use strict";

  const EMAIL_KEY = "vp_email";

  function fetchJson(url) {
    return fetch(url).then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  /* 725 -> "12:05", 3725 -> "1:02:05" */
  function fmtTime(s) {
    s = Math.max(0, Math.floor(Number(s) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, "0");
    return h > 0 ? h + ":" + String(m).padStart(2, "0") + ":" + sec : m + ":" + sec;
  }

  const EMOJIS = ["🎬", "🧩", "🎨", "⚡", "🔌", "🚀", "🧠", "🛠️"];

  function makeCard(video, opts) {
    opts = opts || {};
    const card = document.createElement("article");
    card.className = "video-card";

    const thumb = document.createElement("div");
    thumb.className = "video-thumb";
    thumb.textContent = EMOJIS[(video.id.length + video.title.length) % EMOJIS.length];

    const meta = document.createElement("div");
    meta.className = "video-meta";

    const title = document.createElement("h3");
    title.className = "video-title";
    title.textContent = video.title;

    const duration = document.createElement("span");
    duration.className = "video-duration";
    duration.textContent = "⏱ " + fmtTime(video.duration);

    const level = document.createElement("span");
    level.className = "video-level level-" + String(video.level || "Beginner").toLowerCase();
    level.textContent = video.level || "Beginner";

    meta.append(title, duration, level);
    card.append(thumb, meta);

    if (opts.progress != null) {
      const pct = Math.max(0, Math.min(100, Math.round((opts.progress / Math.max(1, video.duration)) * 100)));
      const row = document.createElement("div");
      row.className = "progress-row";

      const labels = document.createElement("div");
      labels.className = "progress-labels";
      const left = document.createElement("span");
      left.textContent =
        pct >= 100 ? "Completed ✓" : pct > 0 ? "Resume at " + fmtTime(opts.position || 0) : "Not started";
      const right = document.createElement("span");
      right.textContent = pct + "%";
      labels.append(left, right);

      const track = document.createElement("div");
      track.className = "progress-track";
      const fill = document.createElement("div");
      fill.className = "progress-fill" + (pct >= 100 ? " progress-fill--done" : "");
      fill.style.width = pct + "%";
      track.appendChild(fill);
      row.append(labels, track);
      card.appendChild(row);
    }

    const btn = document.createElement("a");
    btn.className = "btn btn-gold video-watch-btn";
    btn.href = "/watch?id=" + encodeURIComponent(video.id);
    btn.textContent = opts.progress != null && opts.progress >= 100 ? "Watch again" : "▶ Watch";
    card.appendChild(btn);

    return card;
  }

  function render() {
    return fetchJson("/api/videos")
      .then((all) => {
        /* 1) Landing hero grid — published videos only */
        const grid = document.querySelector(".video-grid");
        if (grid) {
          const published = all.filter((v) => v.status === "Published");
          grid.innerHTML = "";
          if (published.length === 0) {
            const note = document.createElement("p");
            note.className = "grid-note";
            note.textContent = "Videos are being prepared — check back soon!";
            grid.appendChild(note);
          } else {
            published.forEach((v) => grid.appendChild(makeCard(v)));
          }
        }

        /* 2) Dashboard grid — with progress + resume */
        const dashWrap = document.querySelector(".dash-wrap");
        if (!dashWrap) return;

        const email = localStorage.getItem(EMAIL_KEY) || "";
        const progressPromise = email
          ? fetchJson("/api/progress/" + encodeURIComponent(email)).catch(() => ({}))
          : Promise.resolve({});

        return progressPromise.then((progressMap) => {
          progressMap = progressMap && typeof progressMap === "object" ? progressMap : {};
          const mine = all.filter((v) => v.status === "Published");

          const dashEmpty = document.querySelector(".dash-empty");
          if (dashEmpty) dashEmpty.style.display = mine.length ? "none" : "";

          const dashGrid = document.querySelector(".dash-grid");
          if (!dashGrid) return;
          dashGrid.innerHTML = "";
          mine.forEach((v) => {
            const p = progressMap[v.id] || {};
            dashGrid.appendChild(makeCard(v, { progress: p.progress, position: p.position }));
          });
        });
      })
      .catch(() => {
        const grid = document.querySelector(".video-grid");
        if (grid) {
          grid.innerHTML = "";
          const note = document.createElement("p");
          note.className = "grid-note";
          note.textContent = "Could not load videos. Is the server running?";
          grid.appendChild(note);
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();