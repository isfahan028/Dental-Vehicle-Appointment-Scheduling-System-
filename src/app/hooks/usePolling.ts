import { useEffect, useRef } from 'react';

/**
 * Call `callback` on a fixed interval, and also whenever the tab regains focus
 * or becomes visible again. The interval is paused while the tab is hidden so
 * background tabs don't keep hitting the API.
 *
 * Used for data that doesn't justify a Realtime channel (the vehicle / service
 * catalogue), where a short delay before an update shows is acceptable.
 */
export function usePolling(
  callback: () => void,
  { intervalMs = 30_000, enabled = true }: { intervalMs?: number; enabled?: boolean } = {},
) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (document.visibilityState === 'visible') callbackRef.current();
    };

    const id = setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') callbackRef.current();
    };
    window.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      clearInterval(id);
      window.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [intervalMs, enabled]);
}
