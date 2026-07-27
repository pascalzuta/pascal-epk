import { Fragment, useMemo, useState } from 'react';
import { ChordLyricsPair, Tag } from 'chordsheetjs';
import { parseSong, capoFromSong } from './library.js';
import { useWakeLock } from './useWakeLock.js';

const NBSP = '\u00a0';

// Keys nobody wants to read off a music stand. Gb major is F# major written the
// hard way, and it drags Cb and Fb along with it.
const AWKWARD_FLAT = ['Gb', 'Cb', 'Fb'];
const AWKWARD_SHARP = ['G#', 'D#', 'A#', 'E#', 'B#'];

// Moves every chord by `steps` semitones, then swaps sharps for flats (or the
// other way round) when the result would be unreadable.
function shift(song, steps) {
  if (!song) return song;
  try {
    let out = steps === 0 ? song : song.transpose(steps);
    const root = String(out.key ?? '').replace(/m(in)?$/i, '');
    if (AWKWARD_FLAT.includes(root)) out = out.useAccidental('#');
    else if (AWKWARD_SHARP.includes(root)) out = out.useAccidental('b');
    return out;
  } catch {
    return song;
  }
}

// Each word becomes its own little box with its chord sitting on top. Lines can
// then wrap between words without a chord ever losing its word, and without the
// blank rows you get when a whole chunk is pushed down.
function toBoxes(pairs) {
  const boxes = [];
  for (const pair of pairs) {
    const tokens = String(pair.lyrics ?? '').match(/\S+|\s+/g) ?? [''];
    tokens.forEach((token, i) => {
      const chord = i === 0 ? pair.chords : '';
      if (/^\s+$/.test(token)) {
        // A gap. If a chord sits over it, it needs a box of its own; otherwise
        // it is simply somewhere the line is allowed to break.
        if (chord) boxes.push({ chord, text: token, breakAfter: true });
        else if (boxes.length) boxes[boxes.length - 1].breakAfter = true;
      } else {
        boxes.push({ chord, text: token, breakAfter: false });
      }
    });
  }
  return boxes;
}

function Line({ line }) {
  const items = line.items ?? [];

  const comment = items.find((i) => i instanceof Tag && i.name === 'comment');
  if (comment) return <h2 className="section">{comment.value}</h2>;

  // Any other directive ({title:}, {key:} and so on) is shown in the header
  // instead, so it is skipped here.
  const pairs = items.filter((i) => i instanceof ChordLyricsPair);
  if (pairs.length === 0) return null;

  const anyChords = pairs.some((p) => p.chords);
  const anyLyrics = pairs.some((p) => p.lyrics.trim());
  if (!anyChords && !anyLyrics) return null;

  // An intro or a riff: chords with nothing sung underneath. These get proper
  // gaps rather than being squashed together into one long word.
  const chordsAlone = anyChords && !pairs.some((p) => p.chords && p.lyrics.trim());
  if (chordsAlone) {
    return (
      <p className="line line-chords">
        {pairs.map((pair, i) => {
          if (pair.chords) {
            return (
              <span className="chord chord-alone" key={i}>
                {pair.chords}
              </span>
            );
          }
          const extra = pair.lyrics.trim();
          return extra ? (
            <span className="repeat" key={i}>
              {extra}
            </span>
          ) : null;
        })}
      </p>
    );
  }

  const boxes = toBoxes(pairs);

  return (
    <p className={anyChords ? 'line' : 'line line-plain'}>
      {boxes.map((box, i) => (
        <Fragment key={i}>
          <span className="pair">
            {anyChords && <span className="chord">{box.chord || NBSP}</span>}
            <span className="lyric">{box.text || NBSP}</span>
          </span>
          {box.breakAfter && ' '}
        </Fragment>
      ))}
    </p>
  );
}

export default function SongView({
  song,
  nextTitle,
  onBack,
  onNext,
  prefs,
  onPrefsChange,
  fontScale,
  onFontScale,
}) {
  const [showSettings, setShowSettings] = useState(false);
  useWakeLock(true);

  const parsed = useMemo(() => parseSong(song.text), [song.text]);

  // The chords written in the file are the shapes you play, with the capo the
  // sheet was written for. So:
  //   shapes   = what your hands do   = written + writtenCapo + transpose - capo
  //   sounding = what the room hears  = written + writtenCapo + transpose
  // Left alone, that shows the sheet exactly as it came off the PDF.
  const writtenCapo = capoFromSong(parsed);
  const capo = prefs.capo ?? writtenCapo;
  const transpose = prefs.transpose ?? 0;

  const shapes = useMemo(
    () => shift(parsed, writtenCapo + transpose - capo),
    [parsed, writtenCapo, transpose, capo],
  );
  const sounding = useMemo(
    () => shift(parsed, writtenCapo + transpose),
    [parsed, writtenCapo, transpose],
  );

  if (!parsed) {
    return (
      <div className="screen">
        <div className="topbar">
          <button className="btn" onClick={onBack}>
            ‹ Songs
          </button>
          <span className="topbar-title">{song.title}</span>
        </div>
        <p className="notice">
          This song could not be read. Open “Edit text” and check it for typing
          mistakes.
        </p>
      </div>
    );
  }

  const set = (patch) => onPrefsChange({ transpose, capo, ...patch });

  return (
    <div className="screen">
      <div className="topbar">
        <button className="btn" onClick={onBack}>
          ‹ Songs
        </button>
        <span className="topbar-title">{song.title}</span>
        {nextTitle && (
          <button className="btn btn-next" onClick={onNext} title="Go to the next song">
            <span className="next-label">Next</span>
            <span className="next-title">{nextTitle}</span>
            <span aria-hidden="true">›</span>
          </button>
        )}
        <button
          className={showSettings ? 'btn btn-on' : 'btn'}
          onClick={() => setShowSettings((v) => !v)}
          aria-label="Key and size"
        >
          Key
        </button>
      </div>

      <div className="keyline">
        <span>{capo === 0 ? 'No capo' : `Capo ${capo}`}</span>
        {shapes.key && <span className="keyline-shapes">Play {shapes.key} shapes</span>}
        {sounding.key && <span>Sounds in {sounding.key}</span>}
      </div>

      {showSettings && (
        <div className="settings">
          <div className="setting">
            <span className="setting-label">
              Transpose
              <span className="setting-hint">moves the whole song up or down</span>
            </span>
            <button className="btn btn-big" onClick={() => set({ transpose: transpose - 1 })}>
              −
            </button>
            <span className="setting-value">
              {transpose > 0 ? `+${transpose}` : transpose}
            </span>
            <button className="btn btn-big" onClick={() => set({ transpose: transpose + 1 })}>
              +
            </button>
          </div>
          <div className="setting">
            <span className="setting-label">
              Capo
              <span className="setting-hint">same pitch, different shapes</span>
            </span>
            <button className="btn btn-big" onClick={() => set({ capo: Math.max(0, capo - 1) })}>
              −
            </button>
            <span className="setting-value">{capo}</span>
            <button className="btn btn-big" onClick={() => set({ capo: Math.min(11, capo + 1) })}>
              +
            </button>
          </div>
          <div className="setting">
            <span className="setting-label">Text size</span>
            <button className="btn btn-big" onClick={() => onFontScale(fontScale - 0.1)}>
              −
            </button>
            <span className="setting-value">{Math.round(fontScale * 100)}%</span>
            <button className="btn btn-big" onClick={() => onFontScale(fontScale + 0.1)}>
              +
            </button>
          </div>
          <button
            className="btn btn-wide"
            onClick={() => set({ transpose: 0, capo: writtenCapo })}
          >
            Back to how it was written
          </button>
        </div>
      )}

      <div className="sheet">
        {shapes.lines.map((line, i) => (
          <Line line={line} key={i} />
        ))}
        <div className="sheet-end" />
      </div>
    </div>
  );
}
