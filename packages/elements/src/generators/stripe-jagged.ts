import { z } from "zod";
import type { PathSet, PointMm } from "@livery-lab/schema";
import type { ElementDef } from "../types.js";
import { minStationWidth, ribbonPolygonPath } from "../util/path.js";
import { mulberry32, randRange } from "../util/prng.js";

/**
 * A wide racing stripe with a hand-cut zigzag edge on both sides —
 * classic drift-livery "torn tape" stripe. Spine runs along +x, centred
 * on y=0, from x=0 to x=lengthMm.
 */
export const StripeJaggedParams = z.object({
  lengthMm: z.number().min(20).max(600),
  widthMm: z.number().min(4).max(200),
  /** Number of zigzag teeth along the length. */
  teeth: z.number().int().min(2).max(60).default(10),
  seed: z.number().int().default(1),
});
export type StripeJaggedParams = z.infer<typeof StripeJaggedParams>;

export function generateStripeJagged(p: StripeJaggedParams): PathSet {
  const rng = mulberry32(p.seed);
  const half = p.widthMm / 2;
  // Tooth amplitude: big enough to read as "torn", small enough to stay
  // well clear of the opposite edge.
  const amplitude = Math.min(half * 0.35, p.lengthMm / (p.teeth * 4));
  const stationsPerTooth = 2; // peak + valley
  const n = p.teeth * stationsPerTooth;

  const top: PointMm[] = [];
  const bottom: PointMm[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = t * p.lengthMm;
    // Triangle wave, endpoints pinned flat so the stripe has a clean start/end edge.
    const phase = (i % stationsPerTooth) === 0 ? -1 : 1;
    const pinned = i === 0 || i === n;
    const wobble = pinned ? 0 : phase * amplitude + randRange(rng, -amplitude * 0.15, amplitude * 0.15);
    top.push({ x, y: -half + wobble });
    bottom.push({ x, y: half - wobble * (pinned ? 0 : 0.85) });
  }

  const fills = [ribbonPolygonPath(top, bottom)];
  const minFeatureMm = minStationWidth(top, bottom);
  return { fills, minFeatureMm };
}

export const stripeJaggedElement: ElementDef<StripeJaggedParams> = {
  id: "stripe-jagged",
  category: "stripe",
  params: StripeJaggedParams,
  generate: generateStripeJagged,
  minSizeMm: 1.2,
  supportsText: false,
  tags: ["aggressive", "torn", "motorsport", "wide"],
};
