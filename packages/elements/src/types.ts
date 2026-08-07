import type { ZodTypeAny } from "zod";
import type { PathSet } from "@livery-lab/schema";

export type ElementCategory =
  | "slash"
  | "chevron"
  | "stripe"
  | "banner"
  | "badge"
  | "text"
  | "geometric";

/**
 * A parametric SVG path generator — the vocabulary the AI composes with.
 * Spec: rc-livery-lab-build-spec.md §2.2.
 *
 * Every generator:
 *  - emits closed subpaths only (fill-only, no strokes)
 *  - computes minFeatureMm from the geometry it actually built, not from params
 *  - is deterministic given (params, seed)
 *  - returns geometry in millimetres, in its own local/panel space (the
 *    geometry engine's transform() stage positions it via xMm/yMm/rotationDeg)
 */
export interface ElementDef<Params = any> {
  id: string;
  category: ElementCategory;
  /** Zod schema validating (and defaulting) this element's params. */
  params: ZodTypeAny;
  generate(p: Params): PathSet;
  /** Below this feature size, geometry violates the 1.2mm cut-safety rule. */
  minSizeMm: number;
  supportsText: boolean;
  tags: string[];
}

export type InferParams<E> = E extends ElementDef<infer P> ? P : never;
