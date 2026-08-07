import type { PointMm } from "@livery-lab/schema";
import { differencePolygons, type Polygon } from "./clipper.js";
import { boundsOfPolygon, boundsUnion } from "./svg-path.js";
import type { Sheet } from "./types.js";

export const CROSS_ARM_LENGTH_MM = 6;
export const CROSS_ARM_WIDTH_MM = 1.5;
export const FRAME_THICKNESS_MM = 1;
const INBOARD_OFFSET_MM = 12;

/** A 6mm plus-shaped cross (1.5mm arm width), centred at `c`. */
function buildCross(c: PointMm): Polygon {
  const half = CROSS_ARM_LENGTH_MM / 2;
  const w = CROSS_ARM_WIDTH_MM / 2;
  return [
    { x: c.x - w, y: c.y - half },
    { x: c.x + w, y: c.y - half },
    { x: c.x + w, y: c.y - w },
    { x: c.x + half, y: c.y - w },
    { x: c.x + half, y: c.y + w },
    { x: c.x + w, y: c.y + w },
    { x: c.x + w, y: c.y + half },
    { x: c.x - w, y: c.y + half },
    { x: c.x - w, y: c.y + w },
    { x: c.x - half, y: c.y + w },
    { x: c.x - half, y: c.y - w },
    { x: c.x - w, y: c.y - w },
  ];
}

function rect(x0: number, y0: number, x1: number, y1: number): Polygon {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/**
 * Stage 9: add the 4 registration crosses + 1mm frame outline to every
 * nested piece, in SHEET coordinates (i.e. after nesting has decided
 * where the piece landed and whether it was rotated). Marks are
 * asymmetric — 3 at corners, 1 offset 12mm inboard — so a flipped layer
 * is immediately obvious when aligning masks on the body by eye (§3.3).
 */
export async function addRegistrationMarks(sheets: Sheet[]): Promise<void> {
  for (const sheet of sheets) {
    for (const placed of sheet.pieces) {
      if (placed.piece.fillPolygons.length === 0) continue;
      const localBounds = placed.piece.fillPolygons.map(boundsOfPolygon).reduce(boundsUnion);
      const w = localBounds.maxX - localBounds.minX;
      const h = localBounds.maxY - localBounds.minY;
      const ox = placed.xMm - localBounds.minX;
      const oy = placed.yMm - localBounds.minY;

      const topLeft = { x: ox, y: oy };
      const topRight = { x: ox + w, y: oy };
      const bottomLeft = { x: ox, y: oy + h };
      // The 4th corner (bottom-right) is replaced by a mark offset
      // inboard, breaking the symmetry a plain 4-corner set would have.
      const inboard = {
        x: ox + w - INBOARD_OFFSET_MM,
        y: oy + h - INBOARD_OFFSET_MM,
      };

      placed.registrationMarks = [topLeft, topRight, bottomLeft, inboard].map(buildCross);

      const outer = rect(ox, oy, ox + w, oy + h);
      const inner = rect(
        ox + FRAME_THICKNESS_MM,
        oy + FRAME_THICKNESS_MM,
        ox + w - FRAME_THICKNESS_MM,
        oy + h - FRAME_THICKNESS_MM,
      );
      placed.frameOutline = await differencePolygons([outer], [inner]);
    }
  }
}
