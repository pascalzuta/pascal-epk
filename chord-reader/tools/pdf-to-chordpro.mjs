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
import { tmpdir } from 'node:os';
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

// macOS can already read PDF text on its own, using the same engine Preview
// uses. This is that, kept here so the script stays a single file you can
// download by itself. It is only used when pdftotext is not installed.
const MAC_PDF_READER = `// Reads the text layer out of a PDF using the PDF reader already built into
// macOS, so nothing has to be installed.
//
// Run by osascript, never by node:
//     osascript -l JavaScript mac-pdf-text.jxa.js <file.pdf>
//
// Apple's PDFKit can tell us the exact rectangle every single character sits
// in. That is better information than a text dump gives, so the columns are
// rebuilt from the real positions: characters are grouped into lines by how
// far down the page they are, then spaced out across the line by how far
// across they are. The result looks like "pdftotext -layout", which is what
// the converter expects.

ObjC.import('Quartz');
ObjC.import('Foundation');

function median(numbers) {
  if (numbers.length === 0) return 0;
  var sorted = numbers.slice().sort(function (a, b) {
    return a - b;
  });
  return sorted[Math.floor(sorted.length / 2)];
}

function charactersOnPage(page) {
  var text = ObjC.unwrap(page.string) || '';
  var count = page.numberOfCharacters;
  var characters = [];

  for (var i = 0; i < count; i++) {
    var ch = text[i];
    if (ch === undefined || ch === '\\n' || ch === '\\r') continue;

    var box;
    try {
      box = page.characterBoundsAtIndex(i);
    } catch (e) {
      continue;
    }
    var width = box.size.width;
    var height = box.size.height;
    // Characters PDFKit invented (line breaks and the like) have no size.
    if (!(width > 0) || !(height > 0)) continue;

    characters.push({ x: box.origin.x, y: box.origin.y, w: width, h: height, ch: ch });
  }
  return characters;
}

function pageToLayoutText(page) {
  var characters = charactersOnPage(page);
  if (characters.length === 0) return '';

  var heights = characters.map(function (c) {
    return c.h;
  });
  var widths = characters
    .filter(function (c) {
      return c.ch !== ' ';
    })
    .map(function (c) {
      return c.w;
    });

  var lineHeight = median(heights);
  var columnWidth = median(widths);
  if (!(columnWidth > 0)) columnWidth = lineHeight * 0.5;
  var sameLine = lineHeight * 0.6;

  // Down the page first. PDF pages measure upwards from the bottom, so a
  // larger y is higher up.
  characters.sort(function (a, b) {
    return b.y - a.y;
  });

  var lines = [];
  var current = null;
  characters.forEach(function (c) {
    if (current === null || Math.abs(current.y - c.y) > sameLine) {
      current = { y: c.y, chars: [] };
      lines.push(current);
    }
    current.chars.push(c);
  });

  var leftEdge = Math.min.apply(
    null,
    characters.map(function (c) {
      return c.x;
    })
  );

  return lines
    .map(function (line) {
      line.chars.sort(function (a, b) {
        return a.x - b.x;
      });

      // Group into words first. Placing single characters on a grid pushes
      // them into each other, because real type is not evenly spaced: an "i"
      // is half the width of an "m". Words keep their own spacing and only
      // their starting point is placed on the grid.
      var words = [];
      var word = null;
      var gapThatSeparates = columnWidth * 0.4;
      line.chars.forEach(function (c) {
        var separated =
          word === null ||
          c.ch === ' ' ||
          c.x - (word.x + word.width) > gapThatSeparates;
        if (separated) {
          if (c.ch === ' ') {
            word = null;
            return;
          }
          word = { x: c.x, width: c.w, text: c.ch };
          words.push(word);
        } else {
          word.text += c.ch;
          word.width = c.x + c.w - word.x;
        }
      });

      var out = '';
      words.forEach(function (w) {
        var column = Math.round((w.x - leftEdge) / columnWidth);
        // Words never touch: there is always at least one space between them.
        if (column <= out.length) column = out.length === 0 ? 0 : out.length + 1;
        while (out.length < column) out += ' ';
        out += w.text;
      });
      return out.replace(/\\s+\$/, '');
    })
    .join('\\n');
}

function run(argv) {
  if (argv.length < 1) {
    \$.NSFileHandle.fileHandleWithStandardError.writeData(
      \$('usage: osascript -l JavaScript mac-pdf-text.jxa.js <file.pdf>\\n').dataUsingEncoding(
        \$.NSUTF8StringEncoding
      )
    );
    return;
  }

  var url = \$.NSURL.fileURLWithPath(\$(argv[0]));
  var doc = \$.PDFDocument.alloc.initWithURL(url);
  if (!doc || doc.isNil()) throw new Error('this file could not be opened as a PDF');
  if (doc.isEncrypted && doc.isLocked) throw new Error('this PDF is locked');

  var pages = [];
  for (var i = 0; i < doc.pageCount; i++) {
    pages.push(pageToLayoutText(doc.pageAtIndex(i)));
  }

  var text = pages.join('\\n\\n');
  \$.NSFileHandle.fileHandleWithStandardOutput.writeData(
    \$(text).dataUsingEncoding(\$.NSUTF8StringEncoding)
  );
}
`;

const have = (command, args) => {
  try {
    execFileSync(command, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

// -layout keeps the columns lined up, which is what tells us which chord sits
// over which syllable. Images are ignored: only the text layer is ever read.
const readWithPdftotext = (file) =>
  execFileSync('pdftotext', ['-layout', '-nopgbrk', file, '-'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

let macReaderPath = null;
function readWithMacOS(file) {
  if (macReaderPath === null) {
    macReaderPath = join(tmpdir(), 'chord-reader-pdf-text.js');
    writeFileSync(macReaderPath, MAC_PDF_READER, 'utf8');
  }
  return execFileSync('osascript', ['-l', 'JavaScript', macReaderPath, file], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

// Prefers pdftotext when it is there, because it is quick and well proven.
// Otherwise falls back to what macOS already has, so nothing needs installing.
function chooseReader() {
  if (have('pdftotext', ['-v'])) return { name: 'pdftotext', read: readWithPdftotext };
  if (process.platform === 'darwin' && have('osascript', ['-e', '1'])) {
    return { name: "the PDF reader built into macOS", read: readWithMacOS };
  }
  console.error(
    [
      '',
      'This script needs something that can read the text out of a PDF, and',
      'could not find one.',
      '',
      'On a Mac it uses the reader built into the system, so this should not',
      'normally happen. Otherwise install pdftotext:',
      '    brew install poppler',
      '',
    ].join('\n')
  );
  process.exit(1);
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
  if (args.includes('--look-at')) {
    const file = args[args.indexOf('--look-at') + 1];
    if (!file) {
      console.error('\nGive me a PDF to look at:\n    --look-at "<one file>.pdf"\n');
      process.exit(1);
    }
    const reader = chooseReader();
    console.log(`\nReading ${basename(file)} with ${reader.name}.\n`);
    let raw;
    try {
      raw = reader.read(resolve(file));
    } catch (err) {
      console.error('That failed. The exact complaint was:\n');
      console.error(String(err.stderr || err.message).trim() + '\n');
      process.exit(1);
    }
    console.log(`It gave back ${raw.length} characters. Here are the first 40 lines:\n`);
    console.log(raw.split('\n').slice(0, 40).join('\n'));
    if (raw.trim() === '') {
      console.log('\n(Nothing at all. This PDF probably has no text in it, only a picture.)');
    }
    console.log('');
    return;
  }
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

  const reader = chooseReader();
  console.log(`\nReading the PDFs with ${reader.name}...\n`);

  const songs = [];
  const failed = [];
  let allEmpty = true;
  for (const pdf of pdfs) {
    try {
      const raw = reader.read(pdf);
      if (raw.trim() === '') {
        // Nothing at all came back. The page is a picture of a chord sheet
        // rather than a chord sheet, so there is no text to lift out of it.
        failed.push([basename(pdf), 'there is no text in this PDF, only a picture']);
        continue;
      }
      allEmpty = false;
      const song = parseSong(raw, titleFromFilename(pdf));
      if (!song.body) {
        failed.push([basename(pdf), 'text was found, but no chords or lyrics in it']);
        continue;
      }
      songs.push(song);
      console.log(`  read  ${basename(pdf)}  ->  ${song.title}`);
    } catch (err) {
      failed.push([basename(pdf), err.message]);
    }
  }

  if (songs.length === 0) {
    console.error('\nNone of the PDFs could be read, so nothing was written.');
    console.error('\nHere is what went wrong with each one:');
    for (const [name, why] of failed) console.error(`  ${name}\n      ${why}`);
    console.error(
      allEmpty
        ? [
            '',
            'Every one of these PDFs is a picture of a chord sheet rather than',
            'a chord sheet. There are no letters in the file to read, only pixels,',
            'so no tool can pull the words out of them as they are.',
            '',
            'The fix is to get them again as real text. In your browser, open the',
            'song page and use File > Print > Save as PDF, rather than saving or',
            'exporting an image. Then run this again.',
            '',
          ].join('\n')
        : [
            '',
            'If that is the same message over and over, copy it to Claude.',
            '',
            'To look at just one file in detail, run:',
            `    node ${process.argv[1]} --look-at "<one file>.pdf"`,
            '',
          ].join('\n')
    );
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
