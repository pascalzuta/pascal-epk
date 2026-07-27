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

// --- the two numbers you set per song --------------------------------------
//
// These live in the song text itself, as {duration: 3:00} and {start_delay: 5},
// so they travel with your library file to every device rather than being stuck
// on one.

export const DEFAULT_DURATION = 180; // three minutes
export const DEFAULT_DELAY = 5; // five seconds

const DURATION_RE = /^[ \t]*\{[ \t]*duration[ \t]*:[ \t]*(\d+):([0-5]?\d)[ \t]*\}[ \t]*$/im;
const DELAY_RE = /^[ \t]*\{[ \t]*start_delay[ \t]*:[ \t]*(\d+)[ \t]*\}[ \t]*$/im;
const TITLE_ANYWHERE = /^[ \t]*\{[ \t]*(?:title|t)[ \t]*:.*\}[ \t]*$/im;

export function readTiming(text) {
  const duration = String(text).match(DURATION_RE);
  const delay = String(text).match(DELAY_RE);
  return {
    duration: duration
      ? Math.min(3600, Number(duration[1]) * 60 + Number(duration[2]))
      : DEFAULT_DURATION,
    delay: delay ? Math.min(120, Number(delay[1])) : DEFAULT_DELAY,
  };
}

export const asClock = (seconds) => {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

// Puts the two numbers back into the song text, replacing them if they are
// already there and slipping them in under the title if they are not.
export function writeTiming(text, { duration, delay }) {
  const durationLine = `{duration: ${asClock(duration)}}`;
  const delayLine = `{start_delay: ${Math.round(delay)}}`;
  let out = String(text);

  out = DURATION_RE.test(out)
    ? out.replace(DURATION_RE, durationLine)
    : insertAfterTitle(out, durationLine);
  out = DELAY_RE.test(out)
    ? out.replace(DELAY_RE, delayLine)
    : insertAfterTitle(out, delayLine);

  return out;
}

function insertAfterTitle(text, line) {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => TITLE_ANYWHERE.test(l));
  lines.splice(at + 1, 0, line); // at === -1 puts it at the very top
  return lines.join('\n');
}

// Swaps one song's text inside the whole library file, leaving every other song
// exactly as it was.
export function replaceSongText(libraryText, oldText, newText) {
  const at = libraryText.indexOf(oldText);
  if (at !== -1) {
    return libraryText.slice(0, at) + newText + libraryText.slice(at + oldText.length);
  }
  // Should not happen, but rebuilding from the pieces is better than losing an edit.
  return splitLibrary(libraryText)
    .map((song) => (song.text === oldText ? newText : song.text))
    .join('\n\n{new_song}\n\n');
}

// {capo: 2nd fret} -> 2
export function capoFromSong(song) {
  const raw = song?.capo;
  if (raw === undefined || raw === null) return 0;
  const n = parseInt(String(raw).replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) && n >= 0 && n <= 12 ? n : 0;
}
