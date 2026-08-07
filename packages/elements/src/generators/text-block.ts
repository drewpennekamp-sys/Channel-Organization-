import { z } from "zod";
import type { PathSet } from "@livery-lab/schema";
import type { ElementDef } from "../types.js";
import { loadFont, layoutTextStraight } from "../util/font.js";

/**
 * Converted-to-paths text. NEVER emits an SVG <text> element — Cricut
 * Design Space (and the cutter) only understands paths. Below ~12mm cap
 * height, letter counters (the holes in "e", "a", "o"...) start violating
 * the 1.2mm min-cut-width rule, so we enforce a hard floor here rather
 * than silently producing garbage the customer discovers on the mat.
 */
export const TextBlockParams = z.object({
  text: z.string().min(1).max(40),
  /** Only the bundled default font is available in Phase 1. */
  font: z.literal("default").default("default"),
  sizeMm: z.number().min(12).max(200),
  /** Reserved for a future stroke-outline variant; Phase 1 is fill-only. */
  outline: z.literal(false).default(false),
});
export type TextBlockParams = z.infer<typeof TextBlockParams>;

export function generateTextBlock(p: TextBlockParams): PathSet {
  const font = loadFont();
  const { subpaths, bbox } = layoutTextStraight(font, p.text, p.sizeMm);
  if (subpaths.length === 0) {
    throw new Error(`text-block: "${p.text}" produced no visible glyph geometry`);
  }
  // Approximate stroke width for a bold sans at this size — the
  // authoritative check is the geometry pipeline's morphological min-width
  // validator run on the unioned, rendered shape; this is a fast estimate
  // used for early feedback / the AI repair loop.
  const minFeatureMm = p.sizeMm * 0.08;
  const width = bbox.x2 - bbox.x1;
  const height = bbox.y2 - bbox.y1;
  if (width <= 0 || height <= 0) {
    throw new Error(`text-block: "${p.text}" has zero-area bounding box`);
  }
  return { fills: subpaths, minFeatureMm };
}

export const textBlockElement: ElementDef<TextBlockParams> = {
  id: "text-block",
  category: "text",
  params: TextBlockParams,
  generate: generateTextBlock,
  minSizeMm: 12,
  supportsText: true,
  tags: ["clean", "sponsor", "number", "any"],
};
