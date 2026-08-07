import type { PointMm } from "@livery-lab/schema";
import type { Polygon } from "./clipper.js";
import { polygonArea } from "./clipper.js";

/** Standard ray-casting point-in-polygon test. Boundary is treated as outside. */
export function isPointInPolygon(point: PointMm, polygon: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    const intersects =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Area-weighted centroid (true polygon centroid, not a vertex average). */
function centroid(polygon: Polygon): PointMm {
  let cx = 0;
  let cy = 0;
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const p0 = polygon[i]!;
    const p1 = polygon[(i + 1) % polygon.length]!;
    const cross = p0.x * p1.y - p1.x * p0.y;
    area += cross;
    cx += (p0.x + p1.x) * cross;
    cy += (p0.y + p1.y) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-9) {
    // Degenerate polygon — fall back to a plain vertex average.
    const n = polygon.length || 1;
    const avg = polygon.reduce((acc, p) => ({ x: acc.x + p.x / n, y: acc.y + p.y / n }), { x: 0, y: 0 });
    return avg;
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

/**
 * Find a point guaranteed (best-effort) to lie inside `polygon`. Used for
 * containment/nesting-depth tests, not for anything that needs to be
 * exact for adversarial concave shapes — our own generators produce
 * reasonably well-behaved geometry.
 */
export function findInteriorPoint(polygon: Polygon): PointMm {
  const c = centroid(polygon);
  if (isPointInPolygon(c, polygon)) return c;
  for (let i = 0; i < polygon.length; i++) {
    const prev = polygon[(i - 1 + polygon.length) % polygon.length]!;
    const cur = polygon[i]!;
    const next = polygon[(i + 1) % polygon.length]!;
    const mid = { x: (prev.x + cur.x + next.x) / 3, y: (prev.y + cur.y + next.y) / 3 };
    if (isPointInPolygon(mid, polygon)) return mid;
  }
  return c; // last resort — may be wrong for pathological shapes.
}

/**
 * Nesting depth of each polygon in a set: how many OTHER polygons in the
 * same set contain it (via a representative interior point). Depth 0 =
 * outer boundary, 1 = hole, 2 = a solid "island" sitting inside a hole,
 * per §3.2's floating-island rule ("even nesting depth >= 2").
 */
export function computeNestingDepths(polygons: Polygon[]): number[] {
  const points = polygons.map(findInteriorPoint);
  return polygons.map((_, i) => {
    let depth = 0;
    for (let j = 0; j < polygons.length; j++) {
      if (i === j) continue;
      if (isPointInPolygon(points[i]!, polygons[j]!)) depth++;
    }
    return depth;
  });
}

/** Count polygons at depth 0 (true outer boundaries) — used by the gap-width check to detect merges. */
export function countOuterComponents(polygons: Polygon[]): number {
  if (polygons.length === 0) return 0;
  return computeNestingDepths(polygons).filter((d) => d === 0).length;
}

export function netSignedArea(polygons: Polygon[]): number {
  return polygons.reduce((sum, p) => sum + polygonArea(p), 0);
}
