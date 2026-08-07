import { z } from "zod";
import type { PathSet, PointMm } from "@livery-lab/schema";
import type { ElementDef } from "../types.js";
import { minStationWidth, ribbonPolygonPath } from "../util/path.js";
import { mulberry32, randRange } from "../util/prng.js";

/**
 * The core "claw rip" shape: a tapered slash, thin at the tip and belling
 * out toward one end, with optionally jagged (torn-looking) edges.
 * Built as a single closed ribbon polygon along a straight spine.
 */
export const SlashTearParams = z.object({
  lengthMm: z.number().min(15).max(400),
  widthMm: z.number().min(4).max(150),
  /** 0 = smooth edges, 1 = heavily torn/jagged. */
  jaggedness: z.number().min(0).max(1).default(0.4),
  seed: z.number().int().default(1),
  /** Number of stations along the spine — higher = smoother taper curve. */
  resolution: z.number().int().min(8).max(80).default(32),
});
export type SlashTearParams = z.infer<typeof SlashTearParams>;

function widthEnvelope(t: number): number {
  // Belly peaks near t=0.32 (off-centre, closer to the blunt end) then
  // tapers to a sharp point at t=1 — reads as motion/speed rather than a
  // symmetric leaf shape.
  const belly = 0.32;
  if (t <= belly) {
    return Math.sin((Math.PI / 2) * (t / belly));
  }
  const tail = (t - belly) / (1 - belly);
  return Math.cos((Math.PI / 2) * tail);
}

export function generateSlashTear(p: SlashTearParams): PathSet {
  const rng = mulberry32(p.seed);
  const n = p.resolution;
  const maxJitterMm = Math.min(p.widthMm, p.lengthMm) * 0.06 * p.jaggedness;

  const left: PointMm[] = [];
  const right: PointMm[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = t * p.lengthMm;
    const halfWidth = (p.widthMm / 2) * widthEnvelope(t);
    // Cap jitter to a fraction of the local half-width so edges never cross
    // near the tapered tips (which would self-intersect the polygon).
    const jitterCap = Math.min(maxJitterMm, halfWidth * 0.7);
    const jitter = randRange(rng, -jitterCap, jitterCap);
    const jitter2 = randRange(rng, -jitterCap, jitterCap);
    left.push({ x, y: -halfWidth - jitter });
    right.push({ x, y: halfWidth + jitter2 });
  }

  const fills = [ribbonPolygonPath(left, right)];
  // Exclude the very tip stations from the width measurement: both ends
  // are DELIBERATELY tapered to a converging point (that's what makes it
  // read as a slash/claw), and a single converging vertex isn't a "thin
  // sliver" in the cut-safety sense — only a sustained narrow run is. The
  // real, authoritative min-width check (morphological open on the final
  // unioned shape) happens downstream in the geometry pipeline; this is
  // just the element's own fast self-report.
  const interiorStart = Math.max(1, Math.round(n * 0.12));
  const interiorEnd = Math.min(n - 1, Math.round(n * 0.88));
  const minFeatureMm = minStationWidth(
    left.slice(interiorStart, interiorEnd + 1),
    right.slice(interiorStart, interiorEnd + 1),
  );
  return { fills, minFeatureMm };
}

export const slashTearElement: ElementDef<SlashTearParams> = {
  id: "slash-tear",
  category: "slash",
  params: SlashTearParams,
  generate: generateSlashTear,
  minSizeMm: 1.2,
  supportsText: false,
  tags: ["aggressive", "motorsport", "torn", "motion"],
};
