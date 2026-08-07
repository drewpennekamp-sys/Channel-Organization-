import { boundsOfPolygon, boundsUnion } from "./svg-path.js";
import type { BoundsMm } from "@livery-lab/schema";
import type { Piece, Sheet, PlacedPiece, ValidationIssue } from "./types.js";

export const MAT_WIDTH_MM = 304.8; // 12in
export const MAT_HEIGHT_MM = 609.6; // 24in
export const SAFE_WIDTH_MM = 290;
export const SAFE_HEIGHT_MM = 590;
export const GUTTER_MM = 3;
/** Extra clearance reserved around each piece's own bbox for the registration marks added in stage 9. */
const REGISTRATION_PADDING_MM = 4;

interface Shelf {
  yOffset: number;
  height: number;
  xCursor: number;
}

function pieceBounds(piece: Piece): BoundsMm {
  return piece.fillPolygons.map(boundsOfPolygon).reduce(boundsUnion);
}

function paddedDims(piece: Piece): { w: number; h: number } {
  const b = pieceBounds(piece);
  return {
    w: b.maxX - b.minX + REGISTRATION_PADDING_MM * 2,
    h: b.maxY - b.minY + REGISTRATION_PADDING_MM * 2,
  };
}

/** Try to place a piece of size `dims` into an existing shelf, or start a new one. Mutates `shelves` only on success. */
function tryPlace(shelves: Shelf[], dims: { w: number; h: number }): { x: number; y: number } | null {
  if (dims.w > SAFE_WIDTH_MM) return null;
  for (const shelf of shelves) {
    if (dims.h <= shelf.height && shelf.xCursor + GUTTER_MM + dims.w <= SAFE_WIDTH_MM) {
      const x = shelf.xCursor + GUTTER_MM;
      const y = shelf.yOffset;
      shelf.xCursor = x + dims.w;
      return { x, y };
    }
  }
  const last = shelves[shelves.length - 1];
  const yOffset = last ? last.yOffset + last.height + GUTTER_MM : 0;
  if (yOffset + dims.h > SAFE_HEIGHT_MM) return null;
  shelves.push({ yOffset, height: dims.h, xCursor: dims.w });
  return { x: 0, y: yOffset };
}

function rotatePiecePolygons(piece: Piece): void {
  // 90deg rotation about the piece's own bbox min corner, then re-normalize to (0,0)-relative.
  const b = pieceBounds(piece);
  piece.fillPolygons = piece.fillPolygons.map((poly) =>
    poly.map((p) => ({ x: p.y - b.minY, y: b.maxX - p.x })),
  );
}

function normalizeToOrigin(piece: Piece): void {
  const b = pieceBounds(piece);
  piece.fillPolygons = piece.fillPolygons.map((poly) => poly.map((p) => ({ x: p.x - b.minX, y: p.y - b.minY })));
}

export interface NestResult {
  sheets: Sheet[];
  issues: ValidationIssue[];
}

/**
 * Stage 8: bounding-box first-fit-decreasing nesting onto a 12x24in mat
 * with 90-degree rotation and a 3mm gutter. One sheet per colour by
 * default; pass `economyMode: true` to pack every colour onto shared
 * sheets instead (distinguished later by fill colour in the SVG).
 */
export function nestPieces(pieces: Piece[], opts: { economyMode?: boolean } = {}): NestResult {
  const issues: ValidationIssue[] = [];
  const groups = new Map<string, Piece[]>();
  if (opts.economyMode) {
    groups.set("economy", pieces);
  } else {
    for (const piece of pieces) {
      const arr = groups.get(piece.colourKey);
      if (arr) arr.push(piece);
      else groups.set(piece.colourKey, [piece]);
    }
  }

  const sheets: Sheet[] = [];

  for (const [colourKey, groupPieces] of groups) {
    // Normalize each piece to its own (0,0)-relative local space first so
    // nesting math doesn't have to account for wherever the panel put it.
    for (const piece of groupPieces) normalizeToOrigin(piece);

    const sorted = [...groupPieces].sort((a, b) => paddedDims(b).h - paddedDims(a).h);

    let sheetIndex = 1;
    let shelves: Shelf[] = [];
    let currentSheet: Sheet = { index: sheetIndex, colourKey, widthMm: MAT_WIDTH_MM, heightMm: MAT_HEIGHT_MM, pieces: [] };
    sheets.push(currentSheet);

    for (const piece of sorted) {
      const dims = paddedDims(piece);
      let rotated = false;
      let placement = tryPlace(shelves, dims);
      if (!placement) {
        const rotDims = { w: dims.h, h: dims.w };
        placement = tryPlace(shelves, rotDims);
        if (placement) rotated = true;
      }
      if (!placement) {
        sheetIndex++;
        shelves = [];
        currentSheet = { index: sheetIndex, colourKey, widthMm: MAT_WIDTH_MM, heightMm: MAT_HEIGHT_MM, pieces: [] };
        sheets.push(currentSheet);
        placement = tryPlace(shelves, dims);
        if (!placement) {
          const rotDims = { w: dims.h, h: dims.w };
          placement = tryPlace(shelves, rotDims);
          rotated = !!placement;
        }
      }
      if (!placement) {
        issues.push({
          type: "sheet-fit",
          pieceId: piece.id,
          message: `${piece.id}: ${dims.w.toFixed(1)}x${dims.h.toFixed(1)}mm (with registration padding) does not fit the ${SAFE_WIDTH_MM}x${SAFE_HEIGHT_MM}mm safe area in either orientation.`,
          plainLanguage: `This piece is too big for a single mat — split it into smaller placements.`,
        });
        continue;
      }

      if (rotated) rotatePiecePolygons(piece);
      const placed: PlacedPiece = {
        piece,
        sheetIndex: currentSheet.index,
        xMm: placement.x + REGISTRATION_PADDING_MM,
        yMm: placement.y + REGISTRATION_PADDING_MM,
        rotated,
        registrationMarks: [],
        frameOutline: [],
      };
      currentSheet.pieces.push(placed);
    }
  }

  return { sheets, issues };
}
