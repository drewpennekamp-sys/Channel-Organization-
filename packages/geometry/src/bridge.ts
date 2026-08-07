import type { PointMm } from "@livery-lab/schema";
import { unionPolygons, type Polygon } from "./clipper.js";
import { computeNestingDepths } from "./topology.js";
import type { Piece, ValidationIssue } from "./types.js";

export const BRIDGE_WIDTH_MM = 1.5;
export const MAX_BRIDGES_PER_PIECE = 3;
/** Candidates within this fraction of the global minimum distance are considered ties, broken by axis preference. */
const TIE_TOLERANCE = 0.15;

function isIsland(depth: number): boolean {
  return depth >= 2 && depth % 2 === 0;
}

function nearestPointPair(a: Polygon, b: Polygon): { pa: PointMm; pb: PointMm; dist: number } {
  let best = { pa: a[0]!, pb: b[0]!, dist: Infinity };
  for (const pa of a) {
    for (const pb of b) {
      const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      if (d < best.dist) best = { pa, pb, dist: d };
    }
  }
  return best;
}

function buildBridgeRect(pa: PointMm, pb: PointMm): Polygon {
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy * (BRIDGE_WIDTH_MM / 2);
  const py = ux * (BRIDGE_WIDTH_MM / 2);
  // Extend a hair past each endpoint so the union reliably welds rather
  // than just touching at a single point (which clipper can leave as a
  // "weakly simple" seam instead of a true merge).
  const ext = 0.25;
  const ax = pa.x - ux * ext;
  const ay = pa.y - uy * ext;
  const bx = pb.x + ux * ext;
  const by = pb.y + uy * ext;
  return [
    { x: ax + px, y: ay + py },
    { x: bx + px, y: by + py },
    { x: bx - px, y: by - py },
    { x: ax - px, y: ay - py },
  ];
}

/**
 * Stage 6: detect floating islands (a solid shape at even nesting depth
 * >= 2, e.g. a piece fully enclosed by a hole with no connection to the
 * frame) and auto-insert a 1.5mm bridge to the nearest non-island
 * boundary of the same colour, welding them via union. Capped at
 * MAX_BRIDGES_PER_PIECE — pieces that still have a floating island after
 * that are flagged `needsManualAttention` instead of bridged further.
 */
export async function bridgeFloatingIslands(piece: Piece, preferVerticalAxis: boolean): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  for (let attempt = 0; attempt < MAX_BRIDGES_PER_PIECE; attempt++) {
    const depths = computeNestingDepths(piece.fillPolygons);
    const islandIdx = depths.findIndex((d) => isIsland(d));
    if (islandIdx === -1) break;

    const island = piece.fillPolygons[islandIdx]!;
    const candidates = piece.fillPolygons
      .map((poly, i) => ({ poly, i }))
      .filter(({ i }) => i !== islandIdx && !isIsland(depths[i]!));

    if (candidates.length === 0) break; // nothing to bridge to (shouldn't happen if there's a depth-0 outer)

    const pairs = candidates.map(({ poly }) => nearestPointPair(island, poly));
    const minDist = Math.min(...pairs.map((p) => p.dist));
    const tied = pairs.filter((p) => p.dist <= minDist * (1 + TIE_TOLERANCE));

    const axisScore = (p: { pa: PointMm; pb: PointMm }) => {
      const dx = Math.abs(p.pb.x - p.pa.x);
      const dy = Math.abs(p.pb.y - p.pa.y);
      // Higher score = more aligned with the preferred (low-visibility) axis.
      return preferVerticalAxis ? dy - dx : dx - dy;
    };
    tied.sort((a, b) => axisScore(b) - axisScore(a));
    const chosen = tied[0]!;

    const bridgeRect = buildBridgeRect(chosen.pa, chosen.pb);
    piece.fillPolygons = await unionPolygons([...piece.fillPolygons, bridgeRect]);
    piece.bridgesAdded++;
  }

  const finalDepths = computeNestingDepths(piece.fillPolygons);
  if (finalDepths.some((d) => isIsland(d))) {
    piece.needsManualAttention = true;
    issues.push({
      type: "floating-island",
      pieceId: piece.id,
      message: `${piece.id}: a floating island remains after ${piece.bridgesAdded} bridge attempt(s) (cap ${MAX_BRIDGES_PER_PIECE}).`,
      plainLanguage: `A piece of this design would fall out when weeded and needs a manual bridge — flagged for review before cutting.`,
    });
  }

  return issues;
}
