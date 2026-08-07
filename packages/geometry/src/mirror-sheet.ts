import type { Piece } from "./types.js";

/**
 * Stage 7: mirror every piece horizontally about its own panel width.
 * Unconditional — every mask cut by this pipeline is applied to the
 * INSIDE of a clear Lexan body, so it must be a mirror image of what the
 * customer sees from outside. Getting this backwards is the single most
 * common mistake in the hobby; it's not optional here.
 */
export function mirrorSheet(pieces: Piece[]): void {
  for (const piece of pieces) {
    piece.fillPolygons = piece.fillPolygons.map((polygon) =>
      polygon.map((p) => ({ x: piece.panelWidthMm - p.x, y: p.y })),
    );
  }
}
