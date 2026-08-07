/**
 * Shared geometry primitives used across @livery-lab/elements and
 * @livery-lab/geometry. Kept dependency-free (no zod) since these are
 * runtime values produced by generators, not user input to validate.
 */

/**
 * The output of an element generator: one or more closed-subpath fill
 * regions (SVG path `d` strings, absolute commands, in millimetres, in
 * panel space with the panel's own origin at top-left) plus the smallest
 * feature width actually present in that geometry.
 *
 * `fills` are independent shapes of the SAME colour — a generator that
 * wants a two-colour effect must be represented as two placements, not
 * two entries here.
 */
export interface PathSet {
  /** Closed-subpath SVG path data strings ("M...Z"), fill-only, no strokes. */
  fills: string[];
  /** Smallest feature width found in this geometry, in mm. Computed, not guessed. */
  minFeatureMm: number;
}

/** A 2D point in millimetres. */
export interface PointMm {
  x: number;
  y: number;
}

/** An axis-aligned bounding box in millimetres, panel space. */
export interface BoundsMm {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
