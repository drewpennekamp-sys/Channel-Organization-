import type { Polygon } from "../clipper.js";
import type { Sheet } from "../types.js";
import { MAT_WIDTH_MM, MAT_HEIGHT_MM } from "../nest.js";

/** 96dpi CSS px-per-mm, per the Cricut-safe export checklist (§3.5). */
export const MM_TO_PX = 3.7795275591;

function fmt(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? "0" : r.toString();
}

/** Serialize a set of polygons (outer rings + holes, clipper convention) as one <path> using evenodd fill. */
export function polygonsToPathD(polygons: Polygon[]): string {
  return polygons
    .map((poly) => {
      if (poly.length === 0) return "";
      const [first, ...rest] = poly;
      const segs = rest.map((p) => `L${fmt(p.x)},${fmt(p.y)}`).join(" ");
      return `M${fmt(first!.x)},${fmt(first!.y)} ${segs} Z`;
    })
    .filter(Boolean)
    .join(" ");
}

interface SvgLayer {
  id: string;
  fillHex: string;
  polygonsList: Polygon[][];
  dataRole?: string;
}

function svgDocument(widthMm: number, heightMm: number, layers: SvgLayer[]): string {
  const widthPx = fmt(widthMm * MM_TO_PX);
  const heightPx = fmt(heightMm * MM_TO_PX);
  const groups = layers
    .map((layer) => {
      const paths = layer.polygonsList
        .filter((polys) => polys.length > 0)
        .map((polys) => `<path fill-rule="evenodd" d="${polygonsToPathD(polys)}"/>`)
        .join("");
      const roleAttr = layer.dataRole ? ` data-role="${layer.dataRole}"` : "";
      return `<g id="${layer.id}" fill="${layer.fillHex}"${roleAttr}>${paths}</g>`;
    })
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" ` +
    `width="${fmt(widthMm)}mm" height="${fmt(heightMm)}mm" ` +
    `viewBox="0 0 ${widthPx} ${heightPx}">${groups}</svg>`
  );
}

/**
 * One colour's cut sheet — every checklist item in §3.5 applies: no
 * strokes, no transforms, no text/image/clipPath/mask/filter, absolute
 * path commands at 3 decimal places, mm document units, one <g fill>
 * layer per colour (here: the cut colour plus a registration layer).
 */
export function exportColourSheetSvg(sheet: Sheet, colourHex: string): string {
  // Pieces are already normalized to (0,0)-relative local space and placed
  // via xMm/yMm as their local-origin offset on the sheet, so the on-sheet
  // coordinate of every point is simply (local + xMm, local + yMm).
  const cutLayerPolys = sheet.pieces.map((p) => translatePieceToSheet(p.piece.fillPolygons, p.xMm, p.yMm));
  const registrationPolys = sheet.pieces.map((p) => p.registrationMarks);
  const framePolys = sheet.pieces.map((p) => p.frameOutline);

  return svgDocument(sheet.widthMm, sheet.heightMm, [
    { id: `layer-${sheet.colourKey}`, fillHex: colourHex, polygonsList: cutLayerPolys },
    { id: "layer-registration", fillHex: "#FF00FF", polygonsList: registrationPolys, dataRole: "registration" },
    { id: "layer-frame", fillHex: "#00FFFF", polygonsList: framePolys, dataRole: "registration" },
  ]);
}

function translatePieceToSheet(polygons: Polygon[], xMm: number, yMm: number): Polygon[] {
  return polygons.map((poly) => poly.map((p) => ({ x: p.x + xMm, y: p.y + yMm })));
}

/**
 * All colours' sheets combined into one multi-layer reference file
 * (Design Space can import this directly and split it into per-colour
 * mats itself, per §3.5's note on how it splits on fill colour).
 */
export function exportMasterSvg(sheets: Sheet[], colourHexByKey: Record<string, string>): string {
  const widthMm = Math.max(MAT_WIDTH_MM, ...sheets.map((s) => s.widthMm));
  const heightMm = Math.max(MAT_HEIGHT_MM, ...sheets.map((s) => s.heightMm));

  const layers: SvgLayer[] = sheets.map((sheet) => ({
    id: `layer-${sheet.colourKey}-sheet${sheet.index}`,
    fillHex: colourHexByKey[sheet.colourKey] ?? "#000000",
    polygonsList: sheet.pieces.map((p) => translatePieceToSheet(p.piece.fillPolygons, p.xMm, p.yMm)),
  }));

  return svgDocument(widthMm, heightMm, layers);
}
