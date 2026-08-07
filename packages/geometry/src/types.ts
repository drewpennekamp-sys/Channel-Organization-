import type { Polygon } from "./clipper.js";

/** A single fill region positioned in a panel's own mm coordinate space, post rotate/translate/mirror. */
export interface PositionedFill {
  placementId: string;
  panelId: string;
  colourKey: string;
  elementId: string;
  polygon: Polygon;
  /** minFeatureMm reported by the element generator, before union with anything else. */
  sourceMinFeatureMm: number;
}

/** All the same-colour geometry that lands on one panel — one physical cut mask. */
export interface Piece {
  id: string;
  panelId: string;
  colourKey: string;
  panelWidthMm: number;
  panelHeightMm: number;
  /** Union'd fill polygons (outer rings + holes, clipper convention) — mutated through validate/bridge/mirror. */
  fillPolygons: Polygon[];
  contributingPlacementIds: string[];
  issues: ValidationIssue[];
  bridgesAdded: number;
  needsManualAttention: boolean;
}

export type ValidationIssueType =
  | "min-width"
  | "gap"
  | "floating-island"
  | "panel-margin"
  | "node-count"
  | "sheet-fit";

export interface ValidationIssue {
  type: ValidationIssueType;
  pieceId: string;
  message: string;
  /** Plain-language explanation suitable for surfacing directly to a customer (§ Designer step 3). */
  plainLanguage: string;
}

export interface PlacedPiece {
  piece: Piece;
  sheetIndex: number;
  xMm: number;
  yMm: number;
  rotated: boolean;
  /** Registration crosses + frame outline, in SHEET coordinates, added post-nest. */
  registrationMarks: Polygon[];
  frameOutline: Polygon[];
}

export interface Sheet {
  index: number;
  colourKey: string | "economy";
  widthMm: number;
  heightMm: number;
  pieces: PlacedPiece[];
}
