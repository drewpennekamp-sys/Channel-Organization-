import * as clipperLib from "js-angusj-clipper";
import type { PointMm } from "@livery-lab/schema";

/**
 * Clipper works in integer coordinates. We scale mm by this factor before
 * handing polygons to it and divide back on the way out — 1000x gives
 * 0.001mm (1 micron) precision, comfortably finer than anything a vinyl
 * blade or the Cricut's positional accuracy can resolve.
 */
export const CLIPPER_SCALE = 1000;

let instancePromise: Promise<clipperLib.ClipperLibWrapper> | null = null;

/** Lazily load (once) and cache the native Clipper WASM instance. */
export function getClipper(): Promise<clipperLib.ClipperLibWrapper> {
  if (!instancePromise) {
    instancePromise = clipperLib.loadNativeClipperLibInstanceAsync(
      clipperLib.NativeClipperLibRequestedFormat.WasmWithAsmJsFallback,
    );
  }
  return instancePromise;
}

export type Polygon = PointMm[];

function toClipperPath(points: Polygon): clipperLib.IntPoint[] {
  return points.map((p) => ({
    x: Math.round(p.x * CLIPPER_SCALE),
    y: Math.round(p.y * CLIPPER_SCALE),
  }));
}

function fromClipperPath(path: clipperLib.ReadonlyPath): Polygon {
  return path.map((p) => ({ x: p.x / CLIPPER_SCALE, y: p.y / CLIPPER_SCALE }));
}

/**
 * Union a set of same-colour polygons into the minimal non-overlapping
 * shape set (pipeline stage 4 — "union overlapping same-colour shapes").
 * Uses NonZero fill so a generator's own overlapping subpaths (e.g. two
 * chevron arms) merge cleanly, and glyph counters (the hole in "O") stay
 * holes rather than getting filled in.
 */
export async function unionPolygons(polygons: Polygon[]): Promise<Polygon[]> {
  if (polygons.length === 0) return [];
  const clipper = await getClipper();
  const result = clipper.clipToPaths({
    clipType: clipperLib.ClipType.Union,
    subjectFillType: clipperLib.PolyFillType.NonZero,
    subjectInputs: [{ data: polygons.map(toClipperPath), closed: true }],
  });
  return result.map(fromClipperPath);
}

/** Subtract `clip` polygons from `subject` polygons (used for outline-minus-cutouts margin checks). */
export async function differencePolygons(subject: Polygon[], clip: Polygon[]): Promise<Polygon[]> {
  if (subject.length === 0) return [];
  if (clip.length === 0) return subject;
  const clipper = await getClipper();
  const result = clipper.clipToPaths({
    clipType: clipperLib.ClipType.Difference,
    subjectFillType: clipperLib.PolyFillType.NonZero,
    subjectInputs: [{ data: subject.map(toClipperPath), closed: true }],
    clipInputs: [{ data: clip.map(toClipperPath) }],
  });
  return result.map(fromClipperPath);
}

/** Intersect `a` with `b` — used to test "does this shape stay inside this region". */
export async function intersectPolygons(a: Polygon[], b: Polygon[]): Promise<Polygon[]> {
  if (a.length === 0 || b.length === 0) return [];
  const clipper = await getClipper();
  const result = clipper.clipToPaths({
    clipType: clipperLib.ClipType.Intersection,
    subjectFillType: clipperLib.PolyFillType.NonZero,
    subjectInputs: [{ data: a.map(toClipperPath), closed: true }],
    clipInputs: [{ data: b.map(toClipperPath) }],
  });
  return result.map(fromClipperPath);
}

/**
 * Offset (inflate/deflate) a set of polygons by `deltaMm`. This is the
 * morphological-opening primitive: offsetting by -0.6mm then +0.6mm and
 * seeing what geometry disappeared is exactly how the min-cut-width
 * validator (§3.2) detects sub-1.2mm features.
 */
export async function offsetPolygons(
  polygons: Polygon[],
  deltaMm: number,
  opts: { joinType?: clipperLib.JoinType; endType?: clipperLib.EndType } = {},
): Promise<Polygon[]> {
  if (polygons.length === 0) return [];
  const clipper = await getClipper();
  const result = clipper.offsetToPaths({
    delta: deltaMm * CLIPPER_SCALE,
    offsetInputs: [
      {
        data: polygons.map(toClipperPath),
        joinType: opts.joinType ?? clipperLib.JoinType.Round,
        endType: opts.endType ?? clipperLib.EndType.ClosedPolygon,
      },
    ],
    arcTolerance: 0.01 * CLIPPER_SCALE,
  });
  return (result ?? []).map(fromClipperPath);
}

/** Signed area (mm^2) via the shoelace formula — positive = outer/CW-in-y-down, negative = hole. */
export function polygonArea(points: Polygon): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}
