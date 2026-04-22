const ADMIN_PASS = "B0degaBay!";
let songs = [];
let selectedId = null;

function checkPassword() {
  const input = document.getElementById("gate-input");
  const error = document.getElementById("gate-error");
  if (input.value === ADMIN_PASS) {
    document.getElementById("gate").style.display = "none";
    document.getElementById("admin").style.display = "";
    sessionStorage.setItem("backstage", "1");
    init();
  } else {
    error.textContent = "Wrong password";
    input.value = "";
    input.focus();
  }
}

// Allow Enter key to submit
document.getElementById("gate-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") checkPassword();
});

// Skip gate if already authenticated this session
if (sessionStorage.getItem("backstage") === "1") {
  document.getElementById("gate").style.display = "none";
  document.getElementById("admin").style.display = "";
  init();
}

function escapeHtml(text) {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

async function init() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/songs?select=*&order=id`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    songs = await res.json();
    renderSidebar();
  } catch (err) {
    document.getElementById("sidebar").innerHTML =
      '<div class="loading" style="padding:1.5rem">Could not load songs</div>';
  }
}

function renderSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.innerHTML = songs
    .map(
      (song) => `
      <div class="admin-song-item${selectedId === song.id ? " active" : ""}"
           onclick="selectSong(${song.id})">
        ${escapeHtml(song.artist)} &mdash; ${escapeHtml(song.title)}
      </div>`
    )
    .join("");
}

function selectSong(id) {
  selectedId = id;
  renderSidebar();
  renderEditor();
}

function renderEditor() {
  const song = songs.find((s) => s.id === selectedId);
  if (!song) return;

  const editor = document.getElementById("editor");
  editor.classList.remove("admin-editor-empty");
  editor.innerHTML = `
    <div class="form-group">
      <label class="form-label">Artist</label>
      <input class="form-input" id="input-artist" value="${escapeAttr(song.artist)}">
    </div>
    <div class="form-group">
      <label class="form-label">Title</label>
      <input class="form-input" id="input-title" value="${escapeAttr(song.title)}">
    </div>
    <div class="form-group">
      <label class="form-label">Lyrics</label>
      <textarea class="form-textarea" id="input-lyrics">${escapeHtml(song.lyrics || "")}</textarea>
    </div>
    <div class="save-row">
      <button class="save-btn" id="btn-save" onclick="saveSong()">Save</button>
      <span class="save-status" id="save-status"></span>
    </div>`;
}

async function saveSong() {
  const btn = document.getElementById("btn-save");
  const status = document.getElementById("save-status");
  btn.disabled = true;
  status.textContent = "Saving...";

  try {
    const updated = await db.updateSong(selectedId, {
      artist: document.getElementById("input-artist").value,
      title: document.getElementById("input-title").value,
      lyrics: document.getElementById("input-lyrics").value,
    });

    const idx = songs.findIndex((s) => s.id === selectedId);
    songs[idx] = updated;
    renderSidebar();

    status.textContent = "Saved";
    setTimeout(() => {
      const el = document.getElementById("save-status");
      if (el) el.textContent = "";
    }, 2000);
  } catch (err) {
    status.textContent = "Error saving";
  } finally {
    btn.disabled = false;
  }
}
