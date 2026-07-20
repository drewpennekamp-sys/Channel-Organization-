'use client';

import { useEffect, useRef } from 'react';

/** Calls `callback` on a fixed interval, always invoking its latest closure. */
export function usePoll(callback: () => void, intervalSeconds: number, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled || intervalSeconds <= 0) return;
    const id = setInterval(() => callbackRef.current(), intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [intervalSeconds, enabled]);
}
