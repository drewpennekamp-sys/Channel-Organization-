#!/usr/bin/env tsx
/**
 * Emits a calibration SVG with horizontal bars at 0.8 / 1.0 / 1.2 / 1.5 /
 * 2.0mm width, each labelled, so you can cut it on your actual Cricut and
 * see which widths weed cleanly — the real answer to "what is my
 * cutter's true minimum", which is what MIN_CUT_WIDTH_MM in
 * packages/geometry/src/validate.ts is supposed to encode.
 *
 * Usage: pnpm cut-test-sheet [output-path]  (defaults to ./output/cut-test-sheet.svg)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { generateTextBlock, TextBlockParams } from "@livery-lab/elements";
import { parsePath, splitSubpaths, flattenSubpathToPolygon, translatePolygon } from "@livery-lab/geometry";
import { polygonsToPathD, MM_TO_PX } from "@livery-lab/geometry";
import { assertCricutSafe } from "@livery-lab/geometry";

const TEST_WIDTHS_MM = [0.8, 1.0, 1.2, 1.5, 2.0];
const BAR_LENGTH_MM = 70;
const ROW_PITCH_MM = 20;
const LABEL_SIZE_MM = 12;
const MARGIN_MM = 15;

function barPolygon(widthMm: number, x0: number, y0: number) {
  return [
    { x: x0, y: y0 },
    { x: x0 + BAR_LENGTH_MM, y: y0 },
    { x: x0 + BAR_LENGTH_MM, y: y0 + widthMm },
    { x: x0, y: y0 + widthMm },
  ];
}

function labelPolygons(text: string, x0: number, y0: number) {
  const pathSet = generateTextBlock(TextBlockParams.parse({ text, sizeMm: LABEL_SIZE_MM }));
  return pathSet.fills.flatMap((d) => {
    const subpaths = splitSubpaths(parsePath(d));
    return subpaths.map((sp) => translatePolygon(flattenSubpathToPolygon(sp), x0, y0));
  });
}

function buildCalibrationSvg(): string {
  const allPolygons: { x: number; y: number }[][] = [];

  TEST_WIDTHS_MM.forEach((widthMm, i) => {
    const y0 = MARGIN_MM + i * ROW_PITCH_MM;
    allPolygons.push(barPolygon(widthMm, MARGIN_MM, y0));
    // Baseline for the label sits roughly level with the bar's vertical centre.
    allPolygons.push(...labelPolygons(`${widthMm.toFixed(1)}mm`, MARGIN_MM + BAR_LENGTH_MM + 10, y0 + widthMm / 2 + LABEL_SIZE_MM * 0.35));
  });

  const widthMm = MARGIN_MM * 2 + BAR_LENGTH_MM + 10 + 40;
  const heightMm = MARGIN_MM * 2 + TEST_WIDTHS_MM.length * ROW_PITCH_MM;
  const widthPx = (widthMm * MM_TO_PX).toFixed(3);
  const heightPx = (heightMm * MM_TO_PX).toFixed(3);

  const d = polygonsToPathD(allPolygons);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${widthMm}mm" height="${heightMm}mm" ` +
    `viewBox="0 0 ${widthPx} ${heightPx}">` +
    `<g id="layer-calibration" fill="#111111"><path fill-rule="evenodd" d="${d}"/></g></svg>`
  );
}

function main() {
  const outPath = resolve(process.argv[2] ?? "output/cut-test-sheet.svg");
  const svg = buildCalibrationSvg();
  assertCricutSafe(svg, "cut-test-sheet.svg");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, svg, "utf-8");
  console.log(`Wrote ${outPath}`);
  console.log(`Bars: ${TEST_WIDTHS_MM.map((w) => `${w}mm`).join(", ")} — cut this, weed it, and see which widths actually survive on your machine.`);
}

main();
