import type { PointMm } from "@livery-lab/schema";

/** Round to 3 decimal places (matches the Cricut-safe export precision). */
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function fmt(n: number): string {
  return round3(n).toString();
}

/** Build a closed-subpath "M...L...Z" path from a point list. */
export function polygonPath(points: PointMm[]): string {
  if (points.length < 3) {
    throw new Error(`polygonPath needs at least 3 points, got ${points.length}`);
  }
  const [first, ...rest] = points;
  const segments = rest.map((p) => `L${fmt(p.x)},${fmt(p.y)}`);
  return `M${fmt(first!.x)},${fmt(first!.y)} ${segments.join(" ")} Z`;
}

export function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Rotate a point around (0,0) by `deg` degrees. */
export function rotatePoint(p: PointMm, deg: number): PointMm {
  const r = deg2rad(deg);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

export function translatePoint(p: PointMm, dx: number, dy: number): PointMm {
  return { x: p.x + dx, y: p.y + dy };
}

/** Euclidean distance between two points. */
export function dist(a: PointMm, b: PointMm): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Given parallel "left edge" and "right edge" station arrays describing a
 * ribbon-like shape (same length, station i on each edge corresponds to
 * the same position along the spine), compute the minimum local width —
 * this is what "minFeatureMm computed from actual geometry" means for
 * tapered/jagged shapes: measure it at each cross-section, don't echo
 * back a param.
 */
export function minStationWidth(left: PointMm[], right: PointMm[]): number {
  if (left.length !== right.length || left.length === 0) {
    throw new Error("minStationWidth requires equal-length, non-empty edge arrays");
  }
  let min = Infinity;
  for (let i = 0; i < left.length; i++) {
    min = Math.min(min, dist(left[i]!, right[i]!));
  }
  return min;
}

/** Build a closed polygon path by walking the left edge forward and the right edge backward. */
export function ribbonPolygonPath(left: PointMm[], right: PointMm[]): string {
  const points = [...left, ...[...right].reverse()];
  return polygonPath(points);
}
