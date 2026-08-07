import { offsetPolygons, differencePolygons, intersectPolygons } from "./clipper.js";
import { countOuterComponents, netSignedArea } from "./topology.js";
import type { Piece, ValidationIssue } from "./types.js";
import type { PanelGeometry } from "./panel-geometry.js";

export const MIN_CUT_WIDTH_MM = 1.2;
export const PANEL_MARGIN_MM = 3;
export const MAX_NODES_PER_LAYER = 1500;

const HALF_MIN_WIDTH = MIN_CUT_WIDTH_MM / 2; // 0.6mm, per §3.2's -0.6/+0.6 morphological opening

/**
 * Stage 5: min-width, gap, panel-margin, and node-count checks. Mutates
 * `piece.issues` and returns the same list flattened, so callers can
 * either inspect per-piece or the whole batch.
 */
export async function validatePieces(pieces: Piece[], panelGeometry: Map<string, PanelGeometry>): Promise<ValidationIssue[]> {
  const all: ValidationIssue[] = [];

  for (const piece of pieces) {
    piece.issues = [];
    if (piece.fillPolygons.length === 0) continue;

    await checkMinWidth(piece);
    await checkGap(piece);
    checkNodeCount(piece);
    const geo = panelGeometry.get(piece.panelId);
    if (geo) await checkPanelMargin(piece, geo);

    all.push(...piece.issues);
  }

  return all;
}

async function checkMinWidth(piece: Piece): Promise<void> {
  const opened = await offsetPolygons(await offsetPolygons(piece.fillPolygons, -HALF_MIN_WIDTH), HALF_MIN_WIDTH);
  const before = Math.abs(netSignedArea(piece.fillPolygons));
  const after = Math.abs(netSignedArea(opened));
  if (before <= 0) return;
  const lossRatio = (before - after) / before;
  if (lossRatio > 0.02) {
    piece.issues.push({
      type: "min-width",
      pieceId: piece.id,
      message: `${piece.id}: ${(lossRatio * 100).toFixed(1)}% of the shape area disappears under a ${MIN_CUT_WIDTH_MM}mm morphological open — some feature is thinner than ${MIN_CUT_WIDTH_MM}mm.`,
      plainLanguage: `Part of this design is thinner than ${MIN_CUT_WIDTH_MM}mm and won't cut cleanly on vinyl — thicken it or remove the thin detail.`,
    });
  }
}

async function checkGap(piece: Piece): Promise<void> {
  const before = countOuterComponents(piece.fillPolygons);
  if (before < 2) return; // nothing that could be "too close together"
  const grown = await offsetPolygons(piece.fillPolygons, HALF_MIN_WIDTH);
  const after = countOuterComponents(grown);
  if (after < before) {
    piece.issues.push({
      type: "gap",
      pieceId: piece.id,
      message: `${piece.id}: ${before} separate shapes merge into ${after} when grown by ${HALF_MIN_WIDTH}mm — a gap between them is narrower than ${MIN_CUT_WIDTH_MM}mm.`,
      plainLanguage: `Two shapes are placed too close together to weed cleanly — move them at least ${MIN_CUT_WIDTH_MM}mm apart.`,
    });
  }
}

function countNodes(piece: Piece): number {
  return piece.fillPolygons.reduce((sum, p) => sum + p.length, 0);
}

function checkNodeCount(piece: Piece): void {
  const nodes = countNodes(piece);
  if (nodes > MAX_NODES_PER_LAYER) {
    piece.issues.push({
      type: "node-count",
      pieceId: piece.id,
      message: `${piece.id}: ${nodes} nodes, over the ${MAX_NODES_PER_LAYER} limit for one colour layer.`,
      plainLanguage: `This layer is too detailed to cut reliably — simplify the design or split it across more elements.`,
    });
  }
}

async function checkPanelMargin(piece: Piece, geo: PanelGeometry): Promise<void> {
  const safeRegion = await differencePolygons([geo.outline], geo.cutouts);
  const inset = await offsetPolygons(safeRegion, -PANEL_MARGIN_MM);
  if (inset.length === 0) return; // panel too small to have any safe interior — nothing more we can say
  const within = await intersectPolygons(piece.fillPolygons, inset);
  const pieceArea = Math.abs(netSignedArea(piece.fillPolygons));
  const withinArea = Math.abs(netSignedArea(within));
  if (pieceArea > 0 && withinArea / pieceArea < 0.999) {
    piece.issues.push({
      type: "panel-margin",
      pieceId: piece.id,
      message: `${piece.id}: geometry extends outside the panel outline (minus cutouts) with a ${PANEL_MARGIN_MM}mm margin.`,
      plainLanguage: `Part of this design runs past the edge of the panel (or too close to a wheel arch cutout) — move it at least ${PANEL_MARGIN_MM}mm inside the panel.`,
    });
  }
}
