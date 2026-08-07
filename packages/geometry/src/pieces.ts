import { unionPolygons } from "./clipper.js";
import type { PositionedFill, Piece } from "./types.js";

/**
 * Stage 3 (groupByColour, further bucketed by panel — a cut PIECE is
 * "everything of one colour on one panel", the real-world unit you cut
 * as one mask) + stage 4 (boolean union of same-colour overlapping
 * shapes within that piece).
 */
export async function buildPieces(
  fills: PositionedFill[],
  panelDims: Map<string, { widthMm: number; heightMm: number }>,
): Promise<Piece[]> {
  const buckets = new Map<string, PositionedFill[]>();
  for (const fill of fills) {
    const key = `${fill.panelId}::${fill.colourKey}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(fill);
    else buckets.set(key, [fill]);
  }

  const pieces: Piece[] = [];
  for (const [key, bucketFills] of buckets) {
    const [panelId, colourKey] = key.split("::") as [string, string];
    const dims = panelDims.get(panelId);
    if (!dims) throw new Error(`buildPieces: no panel dimensions supplied for panel "${panelId}"`);

    const unioned = await unionPolygons(bucketFills.map((f) => f.polygon));
    pieces.push({
      id: key,
      panelId,
      colourKey,
      panelWidthMm: dims.widthMm,
      panelHeightMm: dims.heightMm,
      fillPolygons: unioned,
      contributingPlacementIds: [...new Set(bucketFills.map((f) => f.placementId))],
      issues: [],
      bridgesAdded: 0,
      needsManualAttention: false,
    });
  }
  return pieces;
}
