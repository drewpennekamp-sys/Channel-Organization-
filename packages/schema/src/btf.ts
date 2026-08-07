import { z } from "zod";

/**
 * Body Template Format (BTF) — one JSON file per supported RC body.
 * Spec: rc-livery-lab-build-spec.md §2.1
 *
 * This is measured data, not AI output. Every dimension and outline here
 * should trace back to a physical body or a manufacturer spec sheet.
 */

export const CurvatureLevelSchema = z.enum(["low", "medium", "high"]);
export type CurvatureLevel = z.infer<typeof CurvatureLevelSchema>;

export const BodyStatusSchema = z.enum(["draft", "verified"]);
export type BodyStatus = z.infer<typeof BodyStatusSchema>;

export const PanelCutoutSchema = z.object({
  id: z.string().min(1),
  /** SVG path data (subpath), in the same mm coordinate space as the panel outline. */
  d: z.string().min(1),
});
export type PanelCutout = z.infer<typeof PanelCutoutSchema>;

export const DimensionsMmSchema = z.object({
  length: z.number().positive(),
  widthFront: z.number().positive(),
  widthRear: z.number().positive(),
  height: z.number().positive(),
  wheelbase: z.number().positive(),
  frontOverhang: z.number().nonnegative(),
  rearOverhang: z.number().nonnegative(),
  trackWidth: z.number().positive(),
  roofWidth: z.number().positive(),
});
export type DimensionsMm = z.infer<typeof DimensionsMmSchema>;

/**
 * A flat, developable panel. Either a fully-specified panel (has its own
 * outline in mm, origin top-left) or a mirror reference to one — in which
 * case width/height/outline/curvature are inherited from the mirrored
 * panel at resolve time and must be omitted here.
 */
export const PanelSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().optional(),
    widthMm: z.number().positive().optional(),
    heightMm: z.number().positive().optional(),
    /** Closed SVG path (M...Z), the real outline — never a bounding rect. */
    outline: z.string().min(1).optional(),
    cutouts: z.array(PanelCutoutSchema).optional().default([]),
    curvature: CurvatureLevelSchema.optional(),
    /** Panel id this one mirrors, or null/omitted for a fully-specified panel. */
    mirrorOf: z.string().min(1).nullable().optional(),
  })
  .superRefine((panel, ctx) => {
    const isMirror = typeof panel.mirrorOf === "string" && panel.mirrorOf.length > 0;
    if (isMirror) {
      if (panel.mirrorOf === panel.id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Panel "${panel.id}" cannot mirror itself.`,
          path: ["mirrorOf"],
        });
      }
      return;
    }
    // Fully-specified panels must carry real geometry, not just an id.
    const required: Array<[keyof typeof panel, string]> = [
      ["widthMm", "widthMm"],
      ["heightMm", "heightMm"],
      ["outline", "outline"],
      ["curvature", "curvature"],
    ];
    for (const [key, path] of required) {
      if (panel[key] === undefined || panel[key] === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Panel "${panel.id}" is not a mirror (no mirrorOf) so "${path}" is required.`,
          path: [path],
        });
      }
    }
  });
export type Panel = z.infer<typeof PanelSchema>;

export const PanelMapEntrySchema = z.object({
  panel: z.string().min(1),
  /** CSS/SVG transform string composing this panel into the view illustration. */
  transform: z.string().optional(),
  /** Warp strategy id applied when compositing onto a curved view, or "none". */
  warp: z.string().optional(),
});
export type PanelMapEntry = z.infer<typeof PanelMapEntrySchema>;

export const BodyViewSchema = z.object({
  id: z.string().min(1),
  /** Path (relative to content root) to the clear-body line-art SVG for this view. */
  artwork: z.string().min(1),
  panelMap: z.array(PanelMapEntrySchema).min(1),
});
export type BodyView = z.infer<typeof BodyViewSchema>;

export const BodyTemplateSchema = z.object({
  id: z.string().min(1),
  manufacturer: z.string().min(1),
  name: z.string().min(1),
  partNumber: z.string().optional(),
  scale: z.string().min(1),
  class: z.string().min(1),
  dimensionsMm: DimensionsMmSchema,
  bodyWeightG: z.number().positive().optional(),
  material: z.string().min(1),
  panels: z.array(PanelSchema).min(1),
  views: z.array(BodyViewSchema).default([]),
  notes: z.string().optional(),
  status: BodyStatusSchema,
});
export type BodyTemplate = z.infer<typeof BodyTemplateSchema>;
