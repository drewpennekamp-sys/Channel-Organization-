import type { BodyTemplate, DesignSpec } from "@livery-lab/schema";
import { validateDesignSpec, type SpecValidationIssue } from "./validate-spec.js";
import { resolveAndTransform } from "./resolve.js";
import { getPanelGeometry, type PanelGeometry } from "./panel-geometry.js";
import { buildPieces } from "./pieces.js";
import { validatePieces } from "./validate.js";
import { bridgeFloatingIslands } from "./bridge.js";
import { mirrorSheet } from "./mirror-sheet.js";
import { nestPieces } from "./nest.js";
import { addRegistrationMarks } from "./registration.js";
import { exportColourSheetSvg, exportMasterSvg } from "./export/svg.js";
import { assertCricutSafe } from "./export/svg-validate.js";
import { exportSheetDxf } from "./export/dxf.js";
import { generateSprayGuide } from "./export/guide.js";
import type { Sheet, ValidationIssue } from "./types.js";

export interface PipelineOptions {
  /** Pack every colour onto shared sheets instead of one sheet per colour. */
  economyMode?: boolean;
  /** See SpecValidationOptions — false for Phase 1 CLI runs against the draft Camaro fixture. */
  requireVerifiedBody?: boolean;
}

export interface ColourArtifact {
  colourKey: string;
  sheetIndex: number;
  svg: string;
  dxf: string;
}

export interface PipelineResult {
  ok: boolean;
  specIssues: SpecValidationIssue[];
  pieceIssues: ValidationIssue[];
  sheets: Sheet[];
  colourArtifacts: ColourArtifact[];
  masterSvg: string;
  sprayGuide: string;
}

/**
 * The whole pipeline, §3.1 stages 1-10, end to end: DesignSpec + BodyTemplate
 * in, cut-ready SVG/DXF/spray-guide out. Runs the upfront DesignSpec checks
 * first and bails before touching the (much more expensive) geometry
 * engine if those fail — mirroring the "validate before render" rule in §2.3.
 */
export async function runPipeline(
  spec: DesignSpec,
  body: BodyTemplate,
  opts: PipelineOptions = {},
): Promise<PipelineResult> {
  const specIssues = validateDesignSpec(spec, body, { requireVerifiedBody: opts.requireVerifiedBody });
  if (specIssues.length > 0) {
    return { ok: false, specIssues, pieceIssues: [], sheets: [], colourArtifacts: [], masterSvg: "", sprayGuide: "" };
  }

  // Stages 1-2: resolve element geometry + position it in panel space (incl. autoMirror).
  const fills = resolveAndTransform(spec, body);

  const panelIds = new Set(fills.map((f) => f.panelId));
  const panelGeometry = new Map<string, PanelGeometry>();
  const panelDims = new Map<string, { widthMm: number; heightMm: number }>();
  for (const id of panelIds) {
    const geo = getPanelGeometry(body, id);
    panelGeometry.set(id, geo);
    panelDims.set(id, { widthMm: geo.widthMm, heightMm: geo.heightMm });
  }

  // Stages 3-4: group into cut pieces (one per panel x colour) + union.
  const pieces = await buildPieces(fills, panelDims);

  // Stage 5: min-width / gap / margin / node-count validation.
  const pieceIssues: ValidationIssue[] = await validatePieces(pieces, panelGeometry);

  // Stage 6: floating-island detection + auto-bridge.
  for (const piece of pieces) {
    const preferVerticalAxis = piece.panelId.includes("side");
    pieceIssues.push(...(await bridgeFloatingIslands(piece, preferVerticalAxis)));
  }

  // Stage 7: mirror every mask for inside-Lexan application.
  mirrorSheet(pieces);

  // Stage 8: nest onto 12x24in mats.
  const { sheets, issues: nestIssues } = nestPieces(pieces, { economyMode: opts.economyMode });
  pieceIssues.push(...nestIssues);

  // Stage 9: registration crosses + frame outline.
  await addRegistrationMarks(sheets);

  // Stage 10: export.
  const colourArtifacts: ColourArtifact[] = sheets.map((sheet) => {
    const hex = spec.palette[sheet.colourKey]?.hex ?? "#000000";
    const svg = exportColourSheetSvg(sheet, hex);
    assertCricutSafe(svg, `${sheet.colourKey}-sheet${sheet.index}`);
    return { colourKey: sheet.colourKey, sheetIndex: sheet.index, svg, dxf: exportSheetDxf(sheet) };
  });

  const colourHexByKey = Object.fromEntries(Object.entries(spec.palette).map(([k, v]) => [k, v.hex]));
  const masterSvg = exportMasterSvg(sheets, colourHexByKey);

  const maskFilesByColour: Record<string, string[]> = {};
  for (const sheet of sheets) {
    if (sheet.pieces.length === 0) continue;
    (maskFilesByColour[sheet.colourKey] ??= []).push(`mask-${sheet.colourKey}-sheet${sheet.index}.svg`);
  }
  const sprayGuide = generateSprayGuide(spec, { bodyName: body.name, maskFilesByColour });

  const hasBlockingIssues = pieceIssues.some((i) => i.type !== "sheet-fit"); // sheet-fit is reported but doesn't block artifact generation of other sheets
  return { ok: !hasBlockingIssues, specIssues: [], pieceIssues, sheets, colourArtifacts, masterSvg, sprayGuide };
}
