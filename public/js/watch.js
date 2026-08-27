/**
 * Video Portal — watch page (Phase 4)
 * Player controls, playback progress persistence, speed menu,
 * transcript snippets and resources.
 */
(function () {
  "use strict";

  const EMAIL_KEY = "vp_email";
  const PROGRESS_INTERVAL_MS = 5000;
  const SNIPPET_TARGET_MS = 120; /* aim for ~2 minute snippets */

  const params = new URLSearchParams(location.search);
  const videoId = params.get("id");

  const player = document.querySelector("#player");
  if (!player || !videoId) return;

  const ui = {
    title: document.querySelector(".watch-title"),
    desc: document.querySelector(".watch-desc"),
    time: document.querySelector(".watch-time"),
    bar: document.querySelector(".watch-progress"),
    fill: document.querySelector(".watch-progress-fill"),
    speedBtn: document.querySelector(".speed-select"),
    speedMenu: document.querySelector(".speed-menu"),
    snippetList: document.querySelector(".watch-snippets"),
    resourceList: document.querySelector(".resource-list"),
    prevBtn: document.querySelector(".watch-prev"),
    nextBtn: document.querySelector(".watch-next"),
    sideCard: document.querySelector(".watch-card"),
  };

  function fmtTime(s) {
    s = Math.max(0, Math.floor(Number(s) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, "0");
    return h > 0 ? h + ":" + String(m).padStart(2, "0") + ":" + sec : m + ":" + sec;
  }

  /* ---------- progress persistence ---------- */

  function email() {
    return localStorage.getItem(EMAIL_KEY) || "";
  }

  function saveProgress() {
    const e = email();
    if (!e || !player.duration || !isFinite(player.duration)) return;
    const progress = Math.min(100, Math.round((player.currentTime / player.duration) * 100));
    fetch("/api/progress/" + encodeURIComponent(e), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: videoId, progress: progress, position: player.currentTime }),
    }).catch(() => {}); /* best-effort, never block playback */
  }

  function restorePosition() {
    const e = email();
    if (!e) return;
    fetch("/api/progress/" + encodeURIComponent(e))
      .then((res) => (res.ok ? res.json() : {}))
      .then((map) => {
        const p = (map && map[videoId]) || {};
        if (p.position && p.position > 5 && p.position < player.duration - 10) {
          player.currentTime = p.position;
        }
      })
      .catch(() => {});
  }

  /* ---------- snippets ---------- */

  function snippetButton(start, label, note) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "snippet" + (note ? " snippet--note" : "");
    btn.innerHTML =
      '<span class="snippet-time">' + fmtTime(start) + "</span>" +
      '<span class="snippet-body"><strong></strong><small></small></span>';
    btn.querySelector("strong").textContent = label;
    btn.querySelector("small").textContent = note || "";
    btn.addEventListener("click", () => {
      player.currentTime = start;
      player.play().catch(() => {});
    });
    return btn;
  }

  function buildSnippets(video) {
    const duration = Math.max(60, video.duration || 300);

    /* Try the transcript first: chunk lines into ~2 minute snippets */
    fetch("/transcript/" + encodeURIComponent(videoId))
      .then((res) => (res.ok ? res.json() : null))
      .then((lines) => {
        if (!Array.isArray(lines) || lines.length === 0) return buildFallback();

        const chunks = [];
        let current = { start: null, end: 0, text: "" };
        lines.forEach((line) => {
          if (typeof line.t !== "number") return;
          if (current.start === null) current.start = line.t;
          current.end = line.t;
          if (line.s) current.text += (current.text ? " " : "") + line.s;
          if (current.end - current.start >= SNIPPET_TARGET_MS) {
            chunks.push(current);
            current = { start: null, end: 0, text: "" };
          }
        });
        if (current.text) chunks.push(current);
        if (chunks.length === 0) return buildFallback();

        renderSnippets(chunks.map((c) => ({
          start: c.start,
          label: c.text.split(/[.!?\n]/)[0].slice(0, 60),
        })));
      })
      .catch(buildFallback);

    function buildFallback() {
      /* No transcript available: split the video into thirds */
      const third = Math.floor(duration / 3);
      renderSnippets([
        { start: 0, label: "Introduction & setup" },
        { start: third, label: "Core concepts & examples" },
        { start: second(duration), label: "Wrap-up & next steps" },
      ]);

      function second(d) {
        return Math.floor((2 * d) / 3);
      }
    }

    function renderSnippets(items) {
      if (!ui.snippetList) return;
      ui.snippetList.innerHTML = "";
      items.forEach((it) => ui.snippetList.appendChild(snippetButton(it.start, it.label)));
    }
  }

  /* ---------- resources ---------- */

  function renderResources(video) {
    if (!ui.resourceList) return;
    const resources = Array.isArray(video.resources) ? video.resources : [];
    ui.resourceList.innerHTML = "";
    if (resources.length === 0) {
      const li = document.createElement("li");
      li.className = "resource-item";
      li.textContent = "No resources for this lesson.";
      ui.resourceList.appendChild(li);
      return;
    }
    resources.forEach((r) => {
      const li = document.createElement("li");
      li.className = "resource-item";
      const icon = document.createElement("span");
      icon.className = "resource-icon";
      icon.textContent = r.type === "link" ? "🔗" : "📝";

      if (r.url) {
        const a = document.createElement("a");
        a.href = r.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = r.label || r.url;
        li.append(icon, a);
      } else {
        const span = document.createElement("span");
        span.textContent = r.label || "Resource";
        li.append(icon, span);
      }
      ui.resourceList.appendChild(li);
    });
  }

  /* ---------- speed menu ---------- */

  function initSpeed() {
    if (!ui.speedBtn || !ui.speedMenu) return;
    const speeds = ["0.5", "0.75", "1", "1.25", "1.5", "2"];

    ui.speedMenu.innerHTML = "";
    speeds.forEach((s) => {
      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = "speed-option" + (s === "1" ? " speed-option--active" : "");
      opt.textContent = s + "×";
      opt.addEventListener("click", () => {
        player.playbackRate = parseFloat(s);
        ui.speedBtn.textContent = s + "× speed";
        ui.speedMenu.querySelectorAll(".speed-option").forEach((o) =>
          o.classList.toggle("speed-option--active", o === opt)
        );
        ui.speedMenu.classList.remove("open");
      });
      ui.speedMenu.appendChild(opt);
    });

    ui.speedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      ui.speedMenu.classList.toggle("open");
    });
    document.addEventListener("click", () => ui.speedMenu.classList.remove("open"));
  }

  /* ---------- prev / next ---------- */

  function setNeighbor(btn, href, text) {
    if (href) {
      btn.href = href;
      btn.textContent = text;
      btn.disabled = false;
      btn.classList.remove("btn-disabled");
    } else {
      btn.removeAttribute("href");
      btn.textContent = text;
      btn.disabled = true;
      btn.classList.add("btn-disabled");
    }
  }

  function initNeighbors(videos, video) {
    const idx = videos.findIndex((v) => v.id === video.id);
    const prev = idx > 0 ? videos[idx - 1] : null;
    const next = idx >= 0 && idx < videos.length - 1 ? videos[idx + 1] : null;

    if (ui.prevBtn) setNeighbor(ui.prevBtn, prev ? "/watch?id=" + encodeURIComponent(prev.id) : null, "← Previous");
    if (ui.nextBtn) setNeighbor(ui.nextBtn, next ? "/watch?id=" + encodeURIComponent(next.id) : null, "Next →");

    /* Up next card in the sidebar */
    if (ui.sideCard) {
      ui.sideCard.style.display = next ? "" : "none";
      if (next) {
        const title = ui.sideCard.querySelector(".watch-card-title");
        const sub = ui.sideCard.querySelector(".watch-card-sub");
        const btn = ui.sideCard.querySelector(".watch-card-btn");
        if (title) title.textContent = next.title;
        if (sub) sub.textContent = "⏱ " + fmtTime(next.duration) + " · " + (next.level || "");
        if (btn) btn.href = "/watch?id=" + encodeURIComponent(next.id);
      }
    }
  }

  /* ---------- boot ---------- */

  function init() {
    fetch("/api/videos")
      .then((res) => (res.ok ? res.json() : null))
      .then((videos) => {
        if (!Array.isArray(videos)) throw new Error("no videos");
        const video = videos.find((v) => v.id === videoId) || videos[0];

        document.title = video.title + " — Video Portal";
        if (ui.title) ui.title.textContent = video.title;
        if (ui.desc) ui.desc.textContent = video.description || "";
        player.src = video.url;
        player.playbackRate = 1;

        renderResources(video);
        initNeighbors(videos, video);
        buildSnippets(video);
      })
      .catch(() => {
        if (ui.title) ui.title.textContent = "Video not found";
        if (ui.desc) ui.desc.textContent = "This lesson does not exist or was removed.";
      });

    initSpeed();

    /* progress UI + persistence */
    let lastSave = 0;
    player.addEventListener("timeupdate", () => {
      if (ui.time) ui.time.textContent = fmtTime(player.currentTime) + " / " + fmtTime(player.duration || 0);
      if (ui.fill && player.duration) {
        ui.fill.style.width = ((player.currentTime / player.duration) * 100).toFixed(2) + "%";
      }
      const now = Date.now();
      if (now - lastSave > PROGRESS_INTERVAL_MS) {
        lastSave = now;
        saveProgress();
      }
    });
    player.addEventListener("pause", saveProgress);
    player.addEventListener("seeked", saveProgress);
    player.addEventListener("ended", () => {
      const e = email();
      if (e) {
        fetch("/api/progress/" + encodeURIComponent(e), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: videoId, progress: 100, position: player.duration || 0 }),
        }).catch(() => {});
      }
    });
    player.addEventListener("loadedmetadata", restorePosition);

    /* clickable progress bar */
    if (ui.bar) {
      ui.bar.addEventListener("click", (e) => {
        if (!player.duration) return;
        const rect = ui.bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        player.currentTime = ratio * player.duration;
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();