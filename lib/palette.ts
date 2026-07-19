export const ACCENT_PALETTE = [
  '#f97316', // orange
  '#22d3ee', // cyan
  '#a78bfa', // violet
  '#fb7185', // rose
  '#34d399', // emerald
  '#facc15', // amber
] as const;

export function nextAccentColor(usedColors: string[]): string {
  const counts = new Map<string, number>(ACCENT_PALETTE.map((c) => [c, 0]));
  for (const color of usedColors) {
    if (counts.has(color)) counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  const unused = ACCENT_PALETTE.find((c) => (counts.get(c) ?? 0) === 0);
  if (unused) return unused;
  // all colors used at least once: pick the least-used one, tie-break by palette order
  let best: string = ACCENT_PALETTE[0];
  let bestCount = Infinity;
  for (const c of ACCENT_PALETTE) {
    const n = counts.get(c) ?? 0;
    if (n < bestCount) {
      bestCount = n;
      best = c;
    }
  }
  return best;
}
