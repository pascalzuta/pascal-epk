#!/usr/bin/env node
// Turns a folder of chord-sheet PDFs into one ChordPro file.
//
// Run it by hand whenever you add PDFs:
//   node tools/pdf-to-chordpro.mjs ~/Music/ChordSheets
//
// It uses pdftotext -layout so the chord columns stay lined up, then works out
// which lines are chords and which are lyrics and merges them together.
// Nothing is downloaded. It only reads files already on this computer.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { basename, extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = resolve(HERE, '..', 'library', 'songs.chordpro');

// ---------------------------------------------------------------------------
// Recognising chords
// ---------------------------------------------------------------------------

// A chord is a letter A-G, an optional sharp/flat, then the usual decorations,
// and optionally a bass note after a slash. Written strictly enough that
// ordinary words ("Bad", "Face", "Add", "Bed") are NOT mistaken for chords.
const QUALITY = '(?:maj|Maj|MAJ|min|Min|MIN|m|M|dim|aug|sus|add|alt|no|ø|°|\\+|-)';
const ROOT = '[A-G][#b♯♭]?';
const CHORD_RE = new RegExp(
  `^${ROOT}(?:${QUALITY}|\\d|#|b|\\(|\\)|\\+|-)*(?:\\/${ROOT})?$`
);

// Things that legitimately sit on a chord line but are not chords themselves.
const REPEAT_RE = /^\(?(?:x\s*\d+|\d+\s*x)\)?$/i;          // x2, (x4), 3x
const BARLINE_RE = /^(?:\|+|:\|+|\|+:|%|\/+|-+|—+)$/;       // | :| |: % //// --
const NOCHORD_RE = /^(?:N\.?C\.?|NC|tacet)$/i;

const isChordToken = (t) => CHORD_RE.test(t) || NOCHORD_RE.test(t);
const isFillerToken = (t) => REPEAT_RE.test(t) || BARLINE_RE.test(t);

// A whole line counts as a chord line when every token on it is a chord or a
// filler, and at least one real chord is present.
function isChordLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  if (!tokens.some(isChordToken)) return false;
  return tokens.every((t) => isChordToken(t) || isFillerToken(t));
}

const SECTION_RE = /^\s*\[([^\]]{1,40})\]\s*$/;             // [Verse 1], [Chorus]
const META_RE = /^\s*(tuning|capo|key)\s*[:\-–]?\s*(.+?)\s*$/i;

// Rubbish that web exports leave behind.
const PAGE_NUMBER_RE = /^\s*(?:page\s*)?\d+\s*(?:\/|of)?\s*\d*\s*$/i;
const URL_RE = /^\s*(?:https?:\/\/|www\.)\S+\s*$/i;

// ---------------------------------------------------------------------------
// Parsing one song
// ---------------------------------------------------------------------------

function toLines(raw) {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\f/g, '\n')            // page breaks become plain line breaks
    .split('\n')
    .map((l) => l.replace(/\t/g, '    ').replace(/\s+$/, ''))
    .filter((l) => !PAGE_NUMBER_RE.test(l) && !URL_RE.test(l));
}

// Put each chord in square brackets at the exact spot in the lyric line that it
// sat above in the PDF.
function mergeChordsIntoLyrics(chordLine, lyricLine) {
  const chords = [];
  const repeats = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(chordLine)) !== null) {
    // A repeat marker belongs to the whole line, not to one syllable, so it is
    // set aside and put at the end rather than dropped into the middle of a word.
    if (REPEAT_RE.test(m[0])) repeats.push(m[0]);
    else chords.push({ col: m.index, text: m[0] });
  }
  const tail = repeats.length ? ` ${repeats.join(' ')}` : '';
  if (chords.length === 0) return safeLyric(lyricLine).trim() + tail;

  let out = safeLyric(lyricLine);
  const furthest = chords[chords.length - 1].col;
  if (furthest > out.length) out = out.padEnd(furthest, ' ');

  // Work right to left so earlier positions are not shifted along.
  for (let i = chords.length - 1; i >= 0; i--) {
    const { col, text } = chords[i];
    const piece = isChordToken(text) ? `[${text}]` : text;
    out = out.slice(0, col) + piece + out.slice(col);
  }
  return out.replace(/^\s+/, '').replace(/\s+$/, '') + tail;
}

// Square brackets inside lyrics would be read as chords, so soften them.
const safeLyric = (s) => s.replace(/\[/g, '(').replace(/\]/g, ')');

// A chord line with no lyrics under it, e.g. an intro riff.
function chordsOnly(line) {
  return line
    .trim()
    .split(/\s+/)
    .map((t) => (isChordToken(t) ? `[${t}]` : t))
    .join(' ');
}

function parseSong(raw, fallbackTitle) {
  const lines = toLines(raw);
  const meta = {};
  let title = '';
  let artist = '';

  // --- header block, everything before the first section or first chord line
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (SECTION_RE.test(line)) break;
    if (isChordLine(line)) break;

    const meta_match = line.match(META_RE);
    if (meta_match) {
      meta[meta_match[1].toLowerCase()] = meta_match[2];
      continue;
    }
    if (!title) {
      title = line.trim();
      continue;
    }
    if (!artist && line.trim().length <= 60) {
      artist = line.trim().replace(/^by\s+/i, '');
      continue;
    }
    // Anything else in the header is not something we were asked to keep.
  }

  // --- body
  const body = [];
  let blankPending = false;
  const pushBlank = () => {
    if (body.length > 0) blankPending = true;
  };
  const push = (text) => {
    if (blankPending) {
      body.push('');
      blankPending = false;
    }
    body.push(text);
  };

  for (; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) {
      pushBlank();
      continue;
    }

    const section = line.match(SECTION_RE);
    if (section) {
      pushBlank();
      push(`{comment: ${section[1].trim()}}`);
      continue;
    }

    if (isChordLine(line)) {
      const next = lines[i + 1];
      const nextIsLyric =
        next !== undefined &&
        next.trim() !== '' &&
        !isChordLine(next) &&
        !SECTION_RE.test(next);
      if (nextIsLyric) {
        push(mergeChordsIntoLyrics(line, next));
        i++; // the lyric line has been used up
      } else {
        push(chordsOnly(line));
      }
      continue;
    }

    push(safeLyric(line).trim());
  }

  return {
    title: title || fallbackTitle,
    artist,
    meta,
    body: body.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
  };
}

function toChordPro(song) {
  const out = [`{title: ${song.title}}`];
  if (song.artist) out.push(`{artist: ${song.artist}}`);
  if (song.meta.key) out.push(`{key: ${song.meta.key}}`);
  if (song.meta.capo) out.push(`{capo: ${song.meta.capo}}`);
  if (song.meta.tuning) out.push(`{meta: tuning ${song.meta.tuning}}`);
  out.push('');
  out.push(song.body);
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Reading the PDFs
// ---------------------------------------------------------------------------

function checkPdftotext() {
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
  } catch {
    console.error(
      [
        '',
        'This script needs a tool called pdftotext, which is not installed.',
        '',
        'To install it, open Terminal and run:',
        '    brew install poppler',
        '',
        'If that says "brew: command not found", install Homebrew first from',
        'https://brew.sh, then run the line above again.',
        '',
      ].join('\n')
    );
    process.exit(1);
  }
}

function pdfToLayoutText(file) {
  // -layout keeps the columns lined up. Images are ignored: this only ever
  // reads the text layer.
  return execFileSync('pdftotext', ['-layout', '-nopgbrk', file, '-'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

const titleFromFilename = (file) =>
  basename(file, extname(file))
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function usage() {
  console.log(
    [
      '',
      'Turn a folder of chord-sheet PDFs into one ChordPro file.',
      '',
      'Use it like this:',
      '    node tools/pdf-to-chordpro.mjs <folder with your PDFs> [output file]',
      '',
      'For example:',
      '    node tools/pdf-to-chordpro.mjs ~/Music/ChordSheets',
      '',
      'If you leave the output file out, it writes to:',
      `    ${DEFAULT_OUT}`,
      '',
      'To see it working on an invented example song, without any PDFs:',
      '    node tools/pdf-to-chordpro.mjs --demo',
      '',
    ].join('\n')
  );
}

function runDemo() {
  const sample = readFileSync(join(HERE, 'demo', 'sample-layout.txt'), 'utf8');
  const song = parseSong(sample, 'Demo Song');
  console.log('\n--- what pdftotext -layout gives us -------------------------\n');
  console.log(sample.trimEnd());
  console.log('\n--- what this script turns it into --------------------------\n');
  console.log(toChordPro(song));
  console.log('');
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--demo')) return runDemo();
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) return usage();

  const inputDir = resolve(args[0]);
  const outFile = args[1] ? resolve(args[1]) : DEFAULT_OUT;

  let entries;
  try {
    if (!statSync(inputDir).isDirectory()) throw new Error('not a folder');
    entries = readdirSync(inputDir);
  } catch {
    console.error(`\nI could not open that folder:\n    ${inputDir}\n`);
    process.exit(1);
  }

  const pdfs = entries
    .filter((f) => extname(f).toLowerCase() === '.pdf' && !f.startsWith('.'))
    .sort((a, b) => a.localeCompare(b))
    .map((f) => join(inputDir, f));

  if (pdfs.length === 0) {
    console.error(`\nThere are no PDFs in that folder:\n    ${inputDir}\n`);
    process.exit(1);
  }

  checkPdftotext();

  const songs = [];
  const failed = [];
  for (const pdf of pdfs) {
    try {
      const song = parseSong(pdfToLayoutText(pdf), titleFromFilename(pdf));
      if (!song.body) {
        failed.push([basename(pdf), 'no text found — it may be a scan or picture']);
        continue;
      }
      songs.push(song);
      console.log(`  read  ${basename(pdf)}  ->  ${song.title}`);
    } catch (err) {
      failed.push([basename(pdf), err.message]);
    }
  }

  if (songs.length === 0) {
    console.error('\nNone of the PDFs could be read, so nothing was written.\n');
    process.exit(1);
  }

  songs.sort((a, b) => a.title.localeCompare(b.title));
  const file = songs.map(toChordPro).join('\n\n{new_song}\n\n') + '\n';

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, file, 'utf8');

  console.log(`\nWrote ${songs.length} song${songs.length === 1 ? '' : 's'} to:\n    ${outFile}`);
  if (failed.length > 0) {
    console.log('\nThese ones did not work:');
    for (const [name, why] of failed) console.log(`  ${name}  —  ${why}`);
  }
  console.log('');
}

main();
