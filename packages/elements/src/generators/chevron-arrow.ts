import { z } from "zod";
import type { PathSet, PointMm } from "@livery-lab/schema";
import type { ElementDef } from "../types.js";
import { deg2rad, ribbonPolygonPath } from "../util/path.js";
import { mulberry32, randRange } from "../util/prng.js";

/**
 * A pointed arrow/chevron: two straight thick arms meeting at an apex,
 * splayed at `angleDeg` from the centreline. Apex is at local (0,0)
 * pointing in +x; arms extend back toward -x.
 */
export const ChevronArrowParams = z.object({
  armLengthMm: z.number().min(15).max(300),
  /** Full angle between the two arms, in degrees (e.g. 60 = a tight arrow). */
  angleDeg: z.number().min(10).max(150).default(60),
  thicknessMm: z.number().min(1.5).max(80),
  /** Give the outer edges a torn/jagged treatment instead of a clean cut. */
  jagged: z.boolean().default(false),
  seed: z.number().int().default(1),
});
export type ChevronArrowParams = z.infer<typeof ChevronArrowParams>;

function buildArm(armLengthMm: number, thicknessMm: number, armAngleDeg: number, jagged: boolean, rng: () => number): PathSet["fills"][number] {
  // Arm spine runs from the apex (0,0) out to (armLengthMm, 0) before
  // rotation; thickness is applied perpendicular to that spine, then the
  // whole arm is rotated by armAngleDeg around the apex.
  const half = thicknessMm / 2;
  const n = 12;
  const maxJitter = jagged ? thicknessMm * 0.12 : 0;

  const top: PointMm[] = [];
  const bottom: PointMm[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = t * armLengthMm;
    // Taper the last 15% toward the apex to a near-point so arms read as
    // an arrow, not a blunt fork.
    const tipTaper = t < 0.15 ? t / 0.15 : 1;
    const jitter = i === 0 ? 0 : randRange(rng, -maxJitter, maxJitter);
    top.push({ x, y: -half * tipTaper - jitter });
    bottom.push({ x, y: half * tipTaper + jitter });
  }

  const rot = deg2rad(armAngleDeg);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const rotate = (pt: PointMm): PointMm => ({ x: pt.x * cos - pt.y * sin, y: pt.x * sin + pt.y * cos });

  return ribbonPolygonPath(top.map(rotate), bottom.map(rotate));
}

export function generateChevronArrow(p: ChevronArrowParams): PathSet {
  const rng = mulberry32(p.seed);
  const armAngle = p.angleDeg / 2;

  const fills = [
    buildArm(p.armLengthMm, p.thicknessMm, armAngle, p.jagged, rng),
    buildArm(p.armLengthMm, p.thicknessMm, -armAngle, p.jagged, rng),
  ];

  // Real min feature width is the arm thickness at its narrowest
  // (non-tapered) cross-section, i.e. away from the apex taper.
  const minFeatureMm = p.thicknessMm;
  return { fills, minFeatureMm };
}

export const chevronArrowElement: ElementDef<ChevronArrowParams> = {
  id: "chevron-arrow",
  category: "chevron",
  params: ChevronArrowParams,
  generate: generateChevronArrow,
  minSizeMm: 1.2,
  supportsText: false,
  tags: ["aggressive", "motorsport", "clean", "arrow"],
};
