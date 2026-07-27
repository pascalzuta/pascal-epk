import { useCallback, useEffect, useRef, useState } from 'react';

// Drives the timed scroll.
//
// Press start and nothing happens for `delay` seconds. Then the page creeps
// downwards at one steady speed, worked out so that the last line arrives
// exactly as `duration` runs out. It moves a fraction of a pixel per frame
// rather than a line at a time, so there is nothing to jump or flicker.

const ANCHOR = 0.35; // the line you are singing sits about a third down the screen

export function useAutoScroll({ sheetRef, duration, delay }) {
  const [phase, setPhase] = useState('idle'); // idle | waiting | running | paused | done
  const [speed, setSpeed] = useState(1);
  const [elapsed, setElapsed] = useState(0);

  const frame = useRef(0);
  const position = useRef(0); // where we mean the scroll to be, to sub-pixel accuracy
  const applied = useRef(0); // what we last actually set, to spot you scrolling by hand
  const rate = useRef(0); // pixels per millisecond at normal speed
  const speedNow = useRef(1);
  const phaseNow = useRef('idle');
  const startedAt = useRef(0);
  const pausedAt = useRef(0);
  const lastFrame = useRef(0);
  const shownSecond = useRef(-1);

  const setPhaseOnce = useCallback((next) => {
    if (phaseNow.current === next) return;
    phaseNow.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    speedNow.current = speed;
  }, [speed]);

  const maxScroll = useCallback(() => {
    const el = sheetRef.current;
    return el ? Math.max(0, el.scrollHeight - el.clientHeight) : 0;
  }, [sheetRef]);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  }, []);

  const tick = useCallback(
    (now) => {
      const el = sheetRef.current;
      if (!el) return;

      const seconds = (now - startedAt.current) / 1000;
      // The clock only needs redrawing once a second, not sixty times.
      if (Math.floor(seconds) !== shownSecond.current) {
        shownSecond.current = Math.floor(seconds);
        setElapsed(seconds);
      }

      const since = now - lastFrame.current;
      lastFrame.current = now;

      if (seconds < delay) {
        setPhaseOnce('waiting');
        frame.current = requestAnimationFrame(tick);
        return;
      }
      setPhaseOnce('running');

      // If you dragged the page yourself, carry on from where you left it
      // rather than yanking it back.
      if (Math.abs(el.scrollTop - applied.current) > 2) position.current = el.scrollTop;

      position.current += rate.current * speedNow.current * since;

      const limit = maxScroll();
      if (position.current >= limit) {
        position.current = limit;
        el.scrollTop = limit;
        applied.current = el.scrollTop;
        setPhaseOnce('done');
        stop();
        return;
      }

      el.scrollTop = position.current;
      applied.current = el.scrollTop;
      frame.current = requestAnimationFrame(tick);
    },
    [delay, maxScroll, setPhaseOnce, sheetRef, stop],
  );

  // Always begins at the top, so this is both "start" and "start again" and
  // there is only ever one button to find without looking.
  const start = useCallback(() => {
    const el = sheetRef.current;
    if (!el) return;
    stop();
    el.scrollTop = 0;
    position.current = 0;
    applied.current = 0;
    // The whole song, spread evenly over the time left after the delay.
    rate.current = maxScroll() / (Math.max(1, duration - delay) * 1000);
    setSpeed(1);
    speedNow.current = 1;
    setElapsed(0);
    shownSecond.current = 0;
    setPhaseOnce(delay > 0 ? 'waiting' : 'running');
    startedAt.current = performance.now();
    lastFrame.current = startedAt.current;
    frame.current = requestAnimationFrame(tick);
  }, [duration, delay, maxScroll, setPhaseOnce, sheetRef, stop, tick]);

  const pause = useCallback(() => {
    stop();
    pausedAt.current = performance.now();
    setPhaseOnce('paused');
  }, [setPhaseOnce, stop]);

  const resume = useCallback(() => {
    const now = performance.now();
    startedAt.current += now - pausedAt.current;
    lastFrame.current = now;
    setPhaseOnce(elapsed < delay ? 'waiting' : 'running');
    frame.current = requestAnimationFrame(tick);
  }, [delay, elapsed, setPhaseOnce, tick]);

  // One tap: move on by exactly one line, straight away, and keep going from
  // there at the same speed.
  const nextLine = useCallback(() => {
    const el = sheetRef.current;
    if (!el) return;
    const anchor = el.clientHeight * ANCHOR;
    const here = el.scrollTop + anchor;
    const limit = maxScroll();

    let target = null;
    for (const line of el.querySelectorAll('[data-line]')) {
      if (line.offsetTop > here + 2) {
        target = line.offsetTop - anchor;
        break;
      }
    }
    // Past the last line, just go to the bottom.
    el.scrollTop = Math.max(0, Math.min(target ?? limit, limit));
    position.current = el.scrollTop;
    applied.current = el.scrollTop;
  }, [maxScroll, sheetRef]);

  const changeSpeed = useCallback((by) => {
    setSpeed((s) => Math.min(3, Math.max(0.25, Math.round((s + by) * 100) / 100)));
  }, []);

  useEffect(() => stop, [stop]);

  return {
    phase,
    speed,
    elapsed,
    start,
    pause,
    resume,
    nextLine,
    changeSpeed,
  };
}
