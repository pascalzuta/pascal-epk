import { Fragment, useMemo, useRef, useState } from 'react';
import { ChordLyricsPair, Tag } from 'chordsheetjs';
import { asClock, capoFromSong, parseSong, readTiming, writeTiming } from './library.js';
import { useWakeLock } from './useWakeLock.js';
import { useAutoScroll } from './useAutoScroll.js';

const NBSP = ' ';

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
  if (comment) {
    return (
      <h2 className="section" data-line>
        {comment.value}
      </h2>
    );
  }

  // Any other directive ({title:}, {duration:} and so on) is handled elsewhere,
  // so it is skipped here.
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
      <p className="line line-chords" data-line>
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

  return (
    <p className={anyChords ? 'line' : 'line line-plain'} data-line>
      {toBoxes(pairs).map((box, i) => (
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

function Stepper({ label, hint, value, onChange, step = 1, min = 0, max = 99, format }) {
  return (
    <div className="setting">
      <span className="setting-label">
        {label}
        {hint && <span className="setting-hint">{hint}</span>}
      </span>
      <button
        className="btn btn-big"
        onClick={() => onChange(Math.max(min, value - step))}
        aria-label={`${label} down`}
      >
        −
      </button>
      <span className="setting-value">{format ? format(value) : value}</span>
      <button
        className="btn btn-big"
        onClick={() => onChange(Math.min(max, value + step))}
        aria-label={`${label} up`}
      >
        +
      </button>
    </div>
  );
}

export default function SongView({
  song,
  nextTitle,
  onBack,
  onNext,
  onSongTextChange,
  prefs,
  onPrefsChange,
  fontScale,
  onFontScale,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const sheetRef = useRef(null);
  const touch = useRef(null);
  useWakeLock(true);

  const parsed = useMemo(() => parseSong(song.text), [song.text]);
  const timing = useMemo(() => readTiming(song.text), [song.text]);

  const scroll = useAutoScroll({
    sheetRef,
    duration: timing.duration,
    delay: timing.delay,
  });

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

  // Kept out of the re-render whenever the clock ticks.
  const sheet = useMemo(
    () => shapes?.lines.map((line, i) => <Line line={line} key={i} />),
    [shapes],
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
  const setTiming = (patch) =>
    onSongTextChange(writeTiming(song.text, { ...timing, ...patch }));

  const { phase } = scroll;
  const live = phase === 'waiting' || phase === 'running';
  const countdown = Math.ceil(timing.delay - scroll.elapsed);

  // A quick tap moves on a line. A drag is you scrolling by hand, and is left
  // alone. Acting on lifting the finger keeps both possible and still lands
  // within a few hundredths of a second.
  const onPointerDown = (e) => {
    touch.current = { x: e.clientX, y: e.clientY, at: performance.now() };
  };
  const onPointerUp = (e) => {
    const down = touch.current;
    touch.current = null;
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved < 12 && performance.now() - down.at < 500) scroll.nextLine();
  };

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
        >
          Setup
        </button>
        <button
          className={phase === 'paused' ? 'btn btn-pause btn-on' : 'btn btn-pause'}
          onClick={() => (live ? scroll.pause() : phase === 'paused' ? scroll.resume() : null)}
          disabled={!live && phase !== 'paused'}
          aria-label={live ? 'Pause' : 'Carry on'}
        >
          {live ? '❚❚' : '▶'}
        </button>
      </div>

      <div className="keyline">
        <span>{capo === 0 ? 'No capo' : `Capo ${capo}`}</span>
        {shapes.key && <span className="keyline-shapes">Play {shapes.key} shapes</span>}
        {sounding.key && <span>Sounds in {sounding.key}</span>}
        <span className="keyline-clock">
          {phase === 'idle'
            ? asClock(timing.duration)
            : `${asClock(scroll.elapsed)} / ${asClock(timing.duration)}`}
        </span>
        {scroll.speed !== 1 && (
          <span className="keyline-speed">{Math.round(scroll.speed * 100)}%</span>
        )}
      </div>

      {showSettings && (
        <div className="settings">
          <Stepper
            label="Transpose"
            hint="moves the whole song up or down"
            value={transpose}
            min={-11}
            max={11}
            onChange={(v) => set({ transpose: v })}
            format={(v) => (v > 0 ? `+${v}` : String(v))}
          />
          <Stepper
            label="Capo"
            hint="same pitch, different shapes"
            value={capo}
            max={11}
            onChange={(v) => set({ capo: v })}
          />
          <Stepper
            label="Length"
            hint="how long the song runs"
            value={timing.duration}
            step={15}
            min={15}
            max={1800}
            onChange={(v) => setTiming({ duration: v })}
            format={asClock}
          />
          <Stepper
            label="Start delay"
            hint="quiet time before it starts moving"
            value={timing.delay}
            max={60}
            onChange={(v) => setTiming({ delay: v })}
            format={(v) => `${v}s`}
          />
          <Stepper
            label="Text size"
            value={Math.round(fontScale * 10)}
            min={6}
            max={25}
            onChange={(v) => onFontScale(v / 10)}
            format={(v) => `${v * 10}%`}
          />
          <button
            className="btn btn-wide"
            onClick={() => set({ transpose: 0, capo: writtenCapo })}
          >
            Back to how it was written
          </button>
        </div>
      )}

      <div
        className="sheet"
        ref={sheetRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (touch.current = null)}
      >
        {sheet}
        <div className="sheet-end" />
      </div>

      {phase === 'waiting' && countdown > 0 && (
        <div className="countdown" aria-live="off">
          {countdown}
        </div>
      )}

      <div className="playbar">
        <button
          className="btn btn-play"
          onClick={() => scroll.changeSpeed(-0.05)}
          aria-label="Slower"
        >
          Slower
        </button>
        <button
          className="btn btn-middle"
          onClick={scroll.start}
        >
          {phase === 'idle' ? 'Start' : 'Restart'}
        </button>
        <button
          className="btn btn-play"
          onClick={() => scroll.changeSpeed(0.05)}
          aria-label="Faster"
        >
          Faster
        </button>
      </div>
    </div>
  );
}
