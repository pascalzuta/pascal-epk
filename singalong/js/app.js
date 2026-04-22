function escapeHtml(text) {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const songId = params.get("song");

  if (songId) {
    await renderDetail(parseInt(songId));
  } else {
    await renderList();
  }
}

async function renderList() {
  const app = document.getElementById("app");
  try {
    const songs = await db.getAllSongs();

    app.innerHTML = `
      <ul class="song-list">
        ${songs
          .map(
            (song, i) => `
          <li class="song-item" onclick="window.location.href='index.html?song=${song.id}'">
            <span class="song-number">${String(i + 1).padStart(2, "0")}</span>
            <div class="song-info">
              <div class="song-title">${escapeHtml(song.title)}</div>
              <div class="song-artist">${escapeHtml(song.artist)}</div>
            </div>
          </li>`
          )
          .join("")}
      </ul>`;
  } catch (err) {
    app.innerHTML = `<div class="loading">Could not load songs</div>`;
  }
}

async function renderDetail(id) {
  const app = document.getElementById("app");
  try {
    const song = await db.getSong(id);

    if (!song) {
      app.innerHTML = `<div class="loading">Song not found</div>`;
      return;
    }

    const lyricsHtml = song.lyrics
      ? escapeHtml(song.lyrics)
      : `<span class="no-lyrics">Lyrics not added yet</span>`;

    app.innerHTML = `
      <div class="song-detail">
        <a href="index.html" class="back-link">&larr; Back</a>
        <h1 class="detail-title">${escapeHtml(song.title)}</h1>
        <p class="detail-artist">${escapeHtml(song.artist)}</p>
        <div class="detail-divider"></div>
        <div class="detail-lyrics">${lyricsHtml}</div>
      </div>`;
  } catch (err) {
    app.innerHTML = `<div class="loading">Could not load song</div>`;
  }
}

init();
