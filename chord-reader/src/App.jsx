import { useEffect, useMemo, useState } from 'react';
import {
  USING_DEMO,
  hasEdits,
  loadLibraryText,
  loadPrefs,
  loadSetlist,
  forgetLibraryText,
  saveLibraryText,
  savePrefs,
  saveSetlist,
  splitLibrary,
  replaceSongText,
} from './library.js';
import SongView from './SongView.jsx';
import SetlistView from './SetlistView.jsx';
import EditorView from './EditorView.jsx';

export default function App() {
  const [libraryText, setLibraryText] = useState(loadLibraryText);
  const [edited, setEdited] = useState(hasEdits);
  const [setlist, setSetlist] = useState(loadSetlist);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [fontScale, setFontScale] = useState(
    () => Number(localStorage.getItem('chordreader.font')) || 1,
  );
  const [screen, setScreen] = useState('library');
  const [openTitle, setOpenTitle] = useState(null);

  const songs = useMemo(() => splitLibrary(libraryText), [libraryText]);
  const song = songs.find((s) => s.title === openTitle) ?? null;

  useEffect(() => saveSetlist(setlist), [setlist]);
  useEffect(() => savePrefs(prefs), [prefs]);
  useEffect(() => {
    document.documentElement.style.setProperty('--scale', String(fontScale));
    localStorage.setItem('chordreader.font', String(fontScale));
  }, [fontScale]);

  // Where "next" goes: the setlist order if this song is in it, otherwise the
  // song after it in the library.
  const order = setlist.length > 0 && setlist.includes(openTitle) ? setlist : songs.map((s) => s.title);
  const position = order.indexOf(openTitle);
  const nextTitle = position >= 0 && position < order.length - 1 ? order[position + 1] : null;

  const open = (target) => {
    setOpenTitle(typeof target === 'string' ? target : target.title);
    setScreen('song');
  };

  if (screen === 'song' && song) {
    return (
      <SongView
        key={song.id}
        song={song}
        nextTitle={nextTitle}
        onBack={() => setScreen('library')}
        onNext={() => nextTitle && open(nextTitle)}
        onSongTextChange={(text) => {
          const next = replaceSongText(libraryText, song.text, text);
          saveLibraryText(next);
          setLibraryText(next);
          setEdited(true);
        }}
        prefs={prefs[song.title] ?? {}}
        onPrefsChange={(p) => setPrefs({ ...prefs, [song.title]: p })}
        fontScale={fontScale}
        onFontScale={(v) => setFontScale(Math.min(2.5, Math.max(0.6, Number(v.toFixed(2)))))}
      />
    );
  }

  if (screen === 'setlist') {
    return (
      <SetlistView
        songs={songs}
        setlist={setlist}
        onChange={setSetlist}
        onBack={() => setScreen('library')}
        onPlay={open}
      />
    );
  }

  if (screen === 'editor') {
    return (
      <EditorView
        text={libraryText}
        edited={edited}
        onBack={() => setScreen('library')}
        onSave={(text) => {
          saveLibraryText(text);
          setLibraryText(text);
          setEdited(true);
          setScreen('library');
        }}
        onRevert={() => {
          forgetLibraryText();
          setLibraryText(loadLibraryText());
          setEdited(false);
        }}
      />
    );
  }

  return (
    <div className="screen">
      <div className="topbar">
        <span className="topbar-title topbar-title-left">Songs</span>
        <button className="btn" onClick={() => setScreen('setlist')}>
          Setlist{setlist.length > 0 ? ` (${setlist.length})` : ''}
        </button>
        <button className="btn" onClick={() => setScreen('editor')}>
          Edit text
        </button>
      </div>

      {USING_DEMO && !edited && (
        <p className="notice notice-small">
          These are made-up demo songs. To get your own in, open “Edit text”,
          select everything, and paste in your songs.chordpro file. It stays on
          this device.
        </p>
      )}

      <div className="list">
        {songs.map((s) => (
          <div className="row" key={s.id}>
            <button className="row-title" onClick={() => open(s)}>
              {s.title}
            </button>
            {setlist.includes(s.title) && <span className="row-flag">in setlist</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
