/**
 * Video Portal — admin panel (Phase 5)
 * List, search, add and delete course videos.
 */
(function () {
  "use strict";

  function fetchJson(url) {
    return fetch(url).then((res) => {
      if (!res.ok) {
        return res.json().then((body) => { throw new Error((body && body.error) || "HTTP " + res.status); }, () => { throw new Error("HTTP " + res.status); });
      }
      return res.json();
    });
  }

  function fmtTime(s) {
    s = Math.max(0, Math.floor(Number(s) || 0));
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, "0");
    return m + " min " + sec + " s";
  }

  const tableBody = document.querySelector(".admin-table");
  const searchInput = document.querySelector(".admin-search");
  const addForm = document.querySelector(".admin-form");
  const statusEl = document.querySelector(".admin-status");
  const emptyEl = document.querySelector(".admin-empty");

  let allVideos = [];

  function setStatus(msg, ok) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("admin-status--ok", !!ok);
    statusEl.classList.toggle("admin-status--err", !ok && !!msg);
  }

  function render(filter) {
    if (!tableBody) return;
    const q = (filter || "").toLowerCase().trim();
    const rows = allVideos.filter((v) => !q || v.title.toLowerCase().includes(q));

    tableBody.innerHTML = "";
    if (emptyEl) emptyEl.style.display = rows.length ? "none" : "";

    rows.forEach((v) => {
      const tr = document.createElement("tr");

      const tdTitle = document.createElement("td");
      tdTitle.className = "admin-cell-title";
      tdTitle.textContent = v.title;

      const tdLevel = document.createElement("td");
      tdLevel.textContent = v.level || "—";

      const tdDur = document.createElement("td");
      tdDur.textContent = fmtTime(v.duration);

      const tdStatus = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = "admin-badge admin-badge--" + String(v.status || "Draft").toLowerCase();
      badge.textContent = v.status || "Draft";
      tdStatus.appendChild(badge);

      const tdActions = document.createElement("td");
      const del = document.createElement("button");
      del.type = "button";
      del.className = "admin-btn admin-btn-danger";
      del.textContent = "Delete";
      del.addEventListener("click", () => {
        if (!confirm('Delete "' + v.title + '"? This cannot be undone.')) return;
        fetch("/api/videos/" + encodeURIComponent(v.id), { method: "DELETE" })
          .then((res) => {
            if (!res.ok) return res.json().then((b) => { throw new Error(b.error || "HTTP " + res.status); });
            setStatus("Video deleted.", true);
            load();
          })
          .catch((err) => setStatus(err.message, false));
      });
      tdActions.appendChild(del);

      tr.append(tdTitle, tdLevel, tdDur, tdStatus, tdActions);
      tableBody.appendChild(tr);
    });
  }

  function load() {
    fetchJson("/api/videos")
      .then((videos) => {
        allVideos = Array.isArray(videos) ? videos : [];
        render(searchInput ? searchInput.value : "");
      })
      .catch((err) => setStatus("Could not load videos: " + err.message, false));
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => render(searchInput.value));
  }

  if (addForm) {
    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(addForm).entries());
      data.duration = parseInt(data.duration, 10) || 600;

      fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then((res) => {
          if (!res.ok) return res.json().then((b) => { throw new Error(b.error || "HTTP " + res.status); });
          return res.json();
        })
        .then((created) => {
          setStatus('"' + (created && created.title ? created.title : "Video") + '" added.', true);
          addForm.reset();
          load();
        })
        .catch((err) => setStatus(err.message, false));
    });
  }

  load();
})();