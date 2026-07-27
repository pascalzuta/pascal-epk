import { useEffect } from 'react';

// Keeps the screen awake while a song is open. Safari re-locks the screen when
// the app goes to the background, so the lock is taken again on the way back.
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;

    let lock = null;
    let dropped = false;

    const acquire = async () => {
      if (dropped || document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        // Denied, e.g. very low battery. The song still works, the screen
        // just dims as usual.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      dropped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      lock?.release?.().catch(() => {});
    };
  }, [active]);
}
