'use client';

import { useEffect, useRef } from 'react';

/**
 * Calls `callback` on a fixed interval, always invoking its latest closure.
 * Also fires once immediately on mount — `setInterval` alone waits a full
 * interval before the first call, which is too slow for "make sure what's
 * on screen matches the server" on page load.
 */
export function usePoll(callback: () => void, intervalSeconds: number, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;
    callbackRef.current();
    if (intervalSeconds <= 0) return;
    const id = setInterval(() => callbackRef.current(), intervalSeconds * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalSeconds, enabled]);
}
