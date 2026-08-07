// Same CJS/ESM interop issue as opentype.js — see util/font.ts in
// @livery-lab/elements for the full explanation. Value import must be
// default; the namespace import is kept around for its types only.
import makerjs from "makerjs";
import type * as MakerJs from "makerjs";
import type { Polygon } from "../clipper.js";
import type { Sheet } from "../types.js";

/**
 * DXF export via maker.js, mm-native (§3.6). One layer for the cut
 * colour (MASK_{COLOUR}) and one REGISTRATION layer for the crosses +
 * frame outline. Curves/arcs were already flattened to polylines back in
 * svg-path.ts's flattenSubpathToPolygon — that uses a fixed segment count
 * rather than an adaptive 0.05mm chord-tolerance solve, which is a
 * reasonable Phase 1 approximation (our own generators' curves are small
 * relative to panel size) but is worth tightening if a design ever puts a
 * large-radius arc through this pipeline.
 */
function polygonToModel(polygon: Polygon, layer: string): MakerJs.IModel {
  const paths: MakerJs.IPathMap = {};
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    paths[`seg${i}`] = { type: "line", origin: [a.x, a.y], end: [b.x, b.y], layer } as MakerJs.IPathLine;
  }
  return { paths, layer };
}

export function exportSheetDxf(sheet: Sheet): string {
  const models: MakerJs.IModelMap = {};
  let idx = 0;
  const maskLayer = `MASK_${sheet.colourKey.toUpperCase()}`;

  for (const placed of sheet.pieces) {
    for (const poly of placed.piece.fillPolygons) {
      const translated = poly.map((p) => ({ x: p.x + placed.xMm, y: p.y + placed.yMm }));
      models[`cut${idx++}`] = polygonToModel(translated, maskLayer);
    }
    for (const poly of placed.registrationMarks) {
      models[`reg${idx++}`] = polygonToModel(poly, "REGISTRATION");
    }
    for (const poly of placed.frameOutline) {
      models[`frame${idx++}`] = polygonToModel(poly, "REGISTRATION");
    }
  }

  const doc: MakerJs.IModel = { models, units: makerjs.unitType.Millimeter };
  return makerjs.exporter.toDXF(doc, { units: makerjs.unitType.Millimeter, accuracy: 0.001 });
}
