'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Card photo with a graceful fallback: if `src` is missing, or the image
 * fails to load (a stale path, an expired Blob URL), show the sport emoji
 * instead of a broken-image glyph bleeding into the layout.
 *
 * `onError` alone isn't enough here: on a fast local network the image can
 * finish failing (a load/error event that doesn't bubble) before React
 * finishes hydrating and attaches that listener, so the failure is missed
 * and a broken-image glyph renders permanently. The mount-time check below
 * catches that case too — `img.complete && naturalWidth === 0` is true both
 * right after a fast failure and once one happens later.
 */
export function CardThumb({ src, alt, emoji }: { src: string | null; alt: string; emoji: string }) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setFailed(false);
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setFailed(true);
    }
  }, [src]);

  if (!src || failed) return <>{emoji}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={imgRef} src={src} alt={alt} onError={() => setFailed(true)} />
  );
}
