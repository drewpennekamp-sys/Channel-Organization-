import { z } from "zod";
import type { PathSet } from "@livery-lab/schema";
import type { ElementDef } from "../types.js";
import { loadFont, layoutTextOnArc } from "../util/font.js";

/**
 * Windshield-banner style curved text: a plate of text following a
 * circular arc, each glyph individually rotated to stay normal to the
 * curve. `heightMm` is the glyph size (same convention as text-block's
 * sizeMm); `radiusMm` is the arc radius the baseline follows.
 */
export const BannerCurvedParams = z.object({
  text: z.string().min(1).max(40),
  radiusMm: z.number().min(20).max(1000),
  heightMm: z.number().min(12).max(200),
  /** Hang the text below the arc line instead of riding on top of it. */
  invert: z.boolean().default(false),
});
export type BannerCurvedParams = z.infer<typeof BannerCurvedParams>;

export function generateBannerCurved(p: BannerCurvedParams): PathSet {
  const font = loadFont();
  const { subpaths, bbox } = layoutTextOnArc(font, p.text, p.heightMm, {
    radiusMm: p.radiusMm,
    invert: p.invert,
  });
  if (subpaths.length === 0) {
    throw new Error(`banner-curved: "${p.text}" produced no visible glyph geometry`);
  }
  if (!Number.isFinite(bbox.x1)) {
    throw new Error(`banner-curved: "${p.text}" has zero-area bounding box`);
  }
  const minFeatureMm = p.heightMm * 0.08;
  return { fills: subpaths, minFeatureMm };
}

export const bannerCurvedElement: ElementDef<BannerCurvedParams> = {
  id: "banner-curved",
  category: "banner",
  params: BannerCurvedParams,
  generate: generateBannerCurved,
  minSizeMm: 12,
  supportsText: true,
  tags: ["motorsport", "windshield", "curved"],
};
