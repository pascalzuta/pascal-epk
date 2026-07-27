#!/usr/bin/env node
// Builds the copy of the reader that goes on the web, at zuta.co/chords.
//
//   npm run publish
//
// The whole point of this build is that IT CONTAINS NO SONGS. Your library is
// moved out of the way first, so it cannot possibly be folded in, put back
// afterwards, and then the finished files are searched to prove none of your
// words got through. If anything is found, the build is deleted rather than
// left lying around.
//
// Your own everyday build (npm run build) is untouched and still has your songs
// in it.

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const LIBRARY = join(ROOT, 'library', 'songs.chordpro');
const PARKED = join(ROOT, 'library', 'songs.chordpro.not-for-the-web');
const OUT = resolve(ROOT, '..', 'chords');
const BASE = '/chords/';

const say = (msg) => console.log(msg);

// Everything the app is built from. Anything that already appears in here is
// the app's own wording, not yours, so it cannot count as a leak.
function appWording() {
  const parts = [readFileSync(join(ROOT, 'index.html'), 'utf8')];
  for (const dir of ['src', 'tools']) {
    for (const file of everyFile(join(ROOT, dir))) {
      parts.push(readFileSync(file, 'utf8'));
    }
  }
  parts.push(readFileSync(join(ROOT, 'vite.config.js'), 'utf8'));
  parts.push(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  return parts.join('\n').toLowerCase();
}

// What to search the finished files for: your song titles and your actual lyric
// lines. If the library had been folded in, these would be sitting in the
// bundle word for word.
function fingerprint(text, ownWording) {
  const found = new Set();
  const keep = (phrase) => {
    const clean = phrase.replace(/\s+/g, ' ').trim().toLowerCase();
    if (clean.length >= 10 && !ownWording.includes(clean)) found.add(clean);
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const title = line.match(/^\{\s*(?:title|t)\s*:\s*(.+?)\}$/i);
    if (title) {
      keep(title[1]);
      continue;
    }
    if (line.startsWith('{')) continue; // other directives are not your words
    keep(line); // exactly as it sits in the file, chords and all
    keep(line.replace(/\[[^\]]*\]/g, '')); // and the bare words
  }
  return [...found];
}

function everyFile(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...everyFile(path));
    else out.push(path);
  }
  return out;
}

const hadLibrary = existsSync(LIBRARY);
const libraryText = hadLibrary ? readFileSync(LIBRARY, 'utf8') : '';

if (hadLibrary) {
  say('Moving your songs out of the way so they cannot end up on the web...');
  renameSync(LIBRARY, PARKED);
}

try {
  say(`Building the songs-free copy into ${OUT} ...`);
  execFileSync('npx', ['vite', 'build', '--base', BASE, '--outDir', OUT, '--emptyOutDir'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, APP_BASE: BASE },
  });
} finally {
  if (hadLibrary) {
    renameSync(PARKED, LIBRARY);
    say('Your songs are back where they were.');
  }
}

// --- prove it -------------------------------------------------------------

if (hadLibrary) {
  const words = fingerprint(libraryText, appWording());
  const leaks = [];
  for (const file of everyFile(OUT)) {
    let text;
    try {
      text = readFileSync(file, 'utf8').toLowerCase();
    } catch {
      continue; // an image or similar
    }
    for (const word of words) {
      if (text.includes(word)) leaks.push(`${file}: ${word}`);
    }
  }

  if (leaks.length > 0) {
    console.error('\nSTOP. Words from your songs turned up in the built files:');
    for (const leak of leaks.slice(0, 10)) console.error('  ' + leak);
    console.error('\nThe build has been deleted. Nothing was published.\n');
    rmSync(OUT, { recursive: true, force: true });
    process.exit(1);
  }
  say(`Checked every built file for ${words.length} of your titles and lyric lines: none found.`);
} else {
  say('You have no library file yet, so there was nothing that could leak.');
}

say(
  [
    '',
    'Done. The songs-free app is in the "chords" folder at the top of the repository.',
    '',
    'To put it live, commit that folder and push it to your main branch. It will',
    'then be at https://zuta.co/chords',
    '',
  ].join('\n'),
);
