// Everything to do with the one song file: where it comes from, how it is cut
// into songs, and what this device remembers.
//
// There is no database and no server. The song file is built into the app by
// Vite; any edits you make are kept in this browser's own storage, on this
// device only.

import { ChordProParser } from 'chordsheetjs';
import { DEMO_LIBRARY } from './demo-library.js';

// Picks up chord-reader/library/songs.chordpro at build time if it is there.
// If you have not run the converter yet, the glob is simply empty and the
// invented demo songs are used instead.
const bundled = import.meta.glob('../library/songs.chordpro', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const BUILT_IN_LIBRARY = Object.values(bundled)[0] ?? DEMO_LIBRARY;
export const USING_DEMO = Object.values(bundled).length === 0;

const KEY_LIBRARY = 'chordreader.library';
const KEY_SETLIST = 'chordreader.setlist';
const KEY_PREFS = 'chordreader.prefs';

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked. Nothing we can do, and nothing worth crashing over.
  }
};

export const loadLibraryText = () => read(KEY_LIBRARY, null) ?? BUILT_IN_LIBRARY;
export const saveLibraryText = (text) => write(KEY_LIBRARY, text);
export const forgetLibraryText = () => {
  try {
    localStorage.removeItem(KEY_LIBRARY);
  } catch {
    /* nothing to do */
  }
};
export const hasEdits = () => read(KEY_LIBRARY, null) !== null;

export const loadSetlist = () => read(KEY_SETLIST, []);
export const saveSetlist = (titles) => write(KEY_SETLIST, titles);

export const loadPrefs = () => read(KEY_PREFS, {});
export const savePrefs = (prefs) => write(KEY_PREFS, prefs);

// --- cutting the file into songs -------------------------------------------

const NEW_SONG = /^\s*\{new_song\}\s*$/i;
const TITLE_LINE = /^\s*\{\s*(?:title|t)\s*:\s*(.*?)\s*\}\s*$/i;

export function splitLibrary(text) {
  const chunks = [];
  let current = [];
  for (const line of String(text).split('\n')) {
    if (NEW_SONG.test(line)) {
      chunks.push(current);
      current = [];
      continue;
    }
    // A second {title:} means a new song even without a {new_song} marker, so
    // hand-edited files still work.
    if (TITLE_LINE.test(line) && current.some((l) => l.trim())) {
      chunks.push(current);
      current = [line];
      continue;
    }
    current.push(line);
  }
  chunks.push(current);

  return chunks
    .map((lines) => lines.join('\n').trim())
    .filter(Boolean)
    .map((text, index) => {
      const match = text.split('\n').find((l) => TITLE_LINE.test(l));
      const title = match ? match.match(TITLE_LINE)[1] : `Untitled ${index + 1}`;
      return { id: `${index}:${title}`, title, text };
    });
}

// Parsing is only done when a song is actually opened, so a big library still
// opens instantly.
export function parseSong(text) {
  try {
    return new ChordProParser().parse(text);
  } catch {
    return null;
  }
}

// {capo: 2nd fret} -> 2
export function capoFromSong(song) {
  const raw = song?.capo;
  if (raw === undefined || raw === null) return 0;
  const n = parseInt(String(raw).replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) && n >= 0 && n <= 12 ? n : 0;
}
