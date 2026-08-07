import { z } from "zod";

/**
 * DesignSpec — the contract between the LLM and the geometry engine.
 * Spec: rc-livery-lab-build-spec.md §2.3
 *
 * The LLM never writes SVG or invents coordinates outside this shape; it
 * writes DesignSpec JSON and the deterministic geometry engine does the
 * rest. Structural validation lives here (self-contained checks that only
 * need the DesignSpec itself). Cross-referential checks against a BodyTemplate
 * and the element registry (rules 1-4, 6, 7 in §2.3) live in
 * @livery-lab/geometry, which is the first package that has both in scope.
 */

const HEX_COLOUR_RE = /^#[0-9A-Fa-f]{6}$/;

export const ColourSchema = z.object({
  name: z.string().min(1),
  hex: z.string().regex(HEX_COLOUR_RE, "hex must be a 6-digit #RRGGBB colour"),
  paintCode: z.string().optional(),
});
export type Colour = z.infer<typeof ColourSchema>;

/** Palette is keyed by an arbitrary colour key ("base", "c1", "c2", ...). */
export const PaletteSchema = z.record(z.string().min(1), ColourSchema);
export type Palette = z.infer<typeof PaletteSchema>;

export const PlacementSchema = z.object({
  id: z.string().min(1),
  panel: z.string().min(1),
  element: z.string().min(1),
  colour: z.string().min(1),
  /** Element-specific params — validated against that element's own zod schema. */
  params: z.record(z.string(), z.unknown()).default({}),
  xMm: z.number(),
  yMm: z.number(),
  rotationDeg: z.number().default(0),
  mirror: z.boolean().default(false),
});
export type Placement = z.infer<typeof PlacementSchema>;

/** "side-left→side-right" style pair, applied to the whole placement set for that panel. */
export const AutoMirrorEntrySchema = z
  .string()
  .regex(/^.+→.+$/, 'autoMirror entries must be "sourcePanel→targetPanel"');

export const DesignSpecSchema = z
  .object({
    version: z.literal(1),
    bodyId: z.string().min(1),
    name: z.string().min(1),
    palette: PaletteSchema,
    /** Index 0 sprayed FIRST — for inside-Lexan, first-sprayed is most visible. */
    paintOrder: z.array(z.string().min(1)).min(1),
    placements: z.array(PlacementSchema).min(1),
    autoMirror: z.array(AutoMirrorEntrySchema).default([]),
    rationale: z.string().optional(),
  })
  .superRefine((spec, ctx) => {
    const paletteKeys = Object.keys(spec.palette);
    const paletteKeySet = new Set(paletteKeys);

    // Rule 5: paintOrder contains every palette key exactly once.
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const key of spec.paintOrder) {
      if (seen.has(key)) duplicates.add(key);
      seen.add(key);
    }
    if (duplicates.size > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `paintOrder repeats colour key(s): ${[...duplicates].join(", ")}`,
        path: ["paintOrder"],
      });
    }
    const unknownInPaintOrder = spec.paintOrder.filter((k) => !paletteKeySet.has(k));
    if (unknownInPaintOrder.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `paintOrder references colour key(s) not in palette: ${unknownInPaintOrder.join(", ")}`,
        path: ["paintOrder"],
      });
    }
    const missingFromPaintOrder = paletteKeys.filter((k) => !seen.has(k));
    if (missingFromPaintOrder.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `paintOrder is missing palette colour key(s): ${missingFromPaintOrder.join(", ")}`,
        path: ["paintOrder"],
      });
    }

    // Every placement.colour must exist in the palette.
    spec.placements.forEach((placement, i) => {
      if (!paletteKeySet.has(placement.colour)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `placements[${i}] ("${placement.id}") references unknown colour "${placement.colour}"`,
          path: ["placements", i, "colour"],
        });
      }
    });

    // Placement ids must be unique.
    const placementIds = new Set<string>();
    spec.placements.forEach((placement, i) => {
      if (placementIds.has(placement.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `placements[${i}] duplicates id "${placement.id}"`,
          path: ["placements", i, "id"],
        });
      }
      placementIds.add(placement.id);
    });
  });
export type DesignSpec = z.infer<typeof DesignSpecSchema>;
