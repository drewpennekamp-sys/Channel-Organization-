import { z } from "zod";
import type { PathSet, PointMm } from "@livery-lab/schema";
import type { ElementDef } from "../types.js";
import { polygonPath } from "../util/path.js";

/**
 * The classic awareness ribbon: two bands crossing below a top loop,
 * fanning out into two tails. Built from a fixed unit template (two
 * 2-segment band spines) scaled uniformly by heightMm, so the silhouette
 * proportions stay consistent at any size.
 */
export const RibbonAwarenessParams = z.object({
  heightMm: z.number().min(15).max(250),
  tailStyle: z.enum(["pointed", "notched"]).default("notched"),
});
export type RibbonAwarenessParams = z.infer<typeof RibbonAwarenessParams>;

function sub(a: PointMm, b: PointMm): PointMm {
  return { x: a.x - b.x, y: a.y - b.y };
}
function add(a: PointMm, b: PointMm): PointMm {
  return { x: a.x + b.x, y: a.y + b.y };
}
function scale(a: PointMm, s: number): PointMm {
  return { x: a.x * s, y: a.y * s };
}
function normalize(a: PointMm): PointMm {
  const len = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / len, y: a.y / len };
}
function perp(a: PointMm): PointMm {
  return { x: -a.y, y: a.x };
}

/** Build one band (a 2-segment strip of constant thickness) as a closed polygon. */
function buildBand(
  p0: PointMm,
  p1: PointMm,
  p2: PointMm,
  thickness: number,
  tailStyle: "pointed" | "notched",
): string {
  const n1 = scale(normalize(perp(sub(p1, p0))), thickness / 2);
  const n2 = scale(normalize(perp(sub(p2, p1))), thickness / 2);

  const leftRail = [add(p0, n1), add(p1, n1), add(p1, n2), add(p2, n2)];
  const rightRail = [sub(p0, n1), sub(p1, n1), sub(p1, n2), sub(p2, n2)];
  const dir2 = normalize(sub(p2, p1));

  let points: PointMm[];
  if (tailStyle === "pointed") {
    const tip = add(p2, scale(dir2, thickness * 0.6));
    points = [...leftRail.slice(0, -1), tip, ...[...rightRail.slice(0, -1)].reverse()];
  } else {
    const notch = sub(p2, scale(dir2, thickness * 0.5));
    points = [...leftRail, notch, ...[...rightRail].reverse()];
  }
  return polygonPath(points);
}

export function generateRibbonAwareness(p: RibbonAwarenessParams): PathSet {
  const h = p.heightMm;
  const thickness = h * 0.16;

  // Unit template (fractions of heightMm), origin at top-left of the
  // element's bounding box. Band A sweeps top-left -> loop bend -> bottom-right
  // tail; Band B mirrors it, and the two overlap through the middle to read
  // as a crossed ribbon once unioned.
  const bandA: [PointMm, PointMm, PointMm] = [
    { x: 0.36 * h, y: 0.05 * h },
    { x: 0.5 * h, y: 0.24 * h },
    { x: 0.86 * h, y: 0.95 * h },
  ];
  const bandB: [PointMm, PointMm, PointMm] = [
    { x: 0.64 * h, y: 0.05 * h },
    { x: 0.5 * h, y: 0.24 * h },
    { x: 0.14 * h, y: 0.95 * h },
  ];

  const fills = [
    buildBand(bandA[0], bandA[1], bandA[2], thickness, p.tailStyle),
    buildBand(bandB[0], bandB[1], bandB[2], thickness, p.tailStyle),
  ];

  return { fills, minFeatureMm: thickness };
}

export const ribbonAwarenessElement: ElementDef<RibbonAwarenessParams> = {
  id: "ribbon-awareness",
  category: "badge",
  params: RibbonAwarenessParams,
  generate: generateRibbonAwareness,
  minSizeMm: 1.2,
  supportsText: false,
  tags: ["awareness", "badge", "clean"],
};
