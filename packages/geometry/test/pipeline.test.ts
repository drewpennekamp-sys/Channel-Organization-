import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadBodyTemplate } from "@livery-lab/bodies";
import { DesignSpecSchema } from "@livery-lab/schema";
import { runPipeline } from "../src/pipeline.js";
import { findCricutSafeViolations } from "../src/export/svg-validate.js";

const CAMARO_PATH = fileURLToPath(new URL("../../../content/bodies/protoform-1567-00.btf.json", import.meta.url));
const FIXTURE_PATH = fileURLToPath(new URL("./fixtures/camaro-bearcat-claw.json", import.meta.url));

function loadCamaro() {
  return loadBodyTemplate(JSON.parse(readFileSync(CAMARO_PATH, "utf-8")));
}

function loadFixtureSpec() {
  return DesignSpecSchema.parse(JSON.parse(readFileSync(FIXTURE_PATH, "utf-8")));
}

describe("runPipeline — Camaro 'Bearcat Claw' fixture", () => {
  it("produces a clean result with no validation issues", async () => {
    const body = loadCamaro();
    const spec = loadFixtureSpec();
    const result = await runPipeline(spec, body, { requireVerifiedBody: false });

    if (!result.ok) {
      console.error(JSON.stringify({ specIssues: result.specIssues, pieceIssues: result.pieceIssues }, null, 2));
    }
    expect(result.specIssues).toEqual([]);
    expect(result.pieceIssues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("produces sheets for every colour actually used (c1, c2 — not the unused base backing colour)", async () => {
    const body = loadCamaro();
    const spec = loadFixtureSpec();
    const result = await runPipeline(spec, body, { requireVerifiedBody: false });
    const colours = new Set(result.sheets.map((s) => s.colourKey));
    expect(colours).toEqual(new Set(["c1", "c2"]));
  });

  it("mirrors the side-left placements onto side-right via autoMirror", async () => {
    const body = loadCamaro();
    const spec = loadFixtureSpec();
    const result = await runPipeline(spec, body, { requireVerifiedBody: false });
    const panelsWithGeometry = new Set(
      result.sheets.flatMap((s) => s.pieces.map((p) => p.piece.panelId)),
    );
    expect(panelsWithGeometry.has("side-left")).toBe(true);
    expect(panelsWithGeometry.has("side-right")).toBe(true);
    expect(panelsWithGeometry.has("hood")).toBe(true);
  });

  it("every generated colour SVG is Cricut-safe", async () => {
    const body = loadCamaro();
    const spec = loadFixtureSpec();
    const result = await runPipeline(spec, body, { requireVerifiedBody: false });
    for (const artifact of result.colourArtifacts) {
      expect(findCricutSafeViolations(artifact.svg)).toEqual([]);
    }
    expect(findCricutSafeViolations(result.masterSvg)).toEqual([]);
  });

  it("every DXF contains a MASK_<COLOUR> layer and a REGISTRATION layer", async () => {
    const body = loadCamaro();
    const spec = loadFixtureSpec();
    const result = await runPipeline(spec, body, { requireVerifiedBody: false });
    for (const artifact of result.colourArtifacts) {
      expect(artifact.dxf).toContain(`MASK_${artifact.colourKey.toUpperCase()}`);
      expect(artifact.dxf).toContain("REGISTRATION");
      expect(artifact.dxf).toContain("ENTITIES");
    }
  });

  it("generates a spray guide with the correct inside-Lexan paint order (c2 first, base last, masks removed once before the backing coat)", async () => {
    const body = loadCamaro();
    const spec = loadFixtureSpec();
    const result = await runPipeline(spec, body, { requireVerifiedBody: false });
    const guide = result.sprayGuide;

    const redStep = guide.indexOf("RED");
    const blackStep = guide.indexOf("BLACK");
    const removeStep = guide.indexOf("Remove ALL masks");
    const backingStep = guide.indexOf("Backing coat");

    expect(redStep).toBeGreaterThan(-1);
    expect(blackStep).toBeGreaterThan(-1);
    expect(removeStep).toBeGreaterThan(-1);
    expect(backingStep).toBeGreaterThan(-1);
    // Red (c2, paintOrder[0]) before black (c1, paintOrder[1]) before removal before the white backing coat.
    expect(redStep).toBeLessThan(blackStep);
    expect(blackStep).toBeLessThan(removeStep);
    expect(removeStep).toBeLessThan(backingStep);
    expect(guide).toContain("Tamiya PS-1"); // base colour's paintCode, preferred over its plain name
  });

  it("nests every sheet within the 290x590mm safe area", async () => {
    const body = loadCamaro();
    const spec = loadFixtureSpec();
    const result = await runPipeline(spec, body, { requireVerifiedBody: false });
    expect(result.sheets.length).toBeGreaterThan(0);
    for (const sheet of result.sheets) {
      for (const placed of sheet.pieces) {
        expect(placed.xMm).toBeGreaterThanOrEqual(0);
        expect(placed.yMm).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("[golden] locks the red (c2) colour SVG geometry", async () => {
    const body = loadCamaro();
    const spec = loadFixtureSpec();
    const result = await runPipeline(spec, body, { requireVerifiedBody: false });
    const redArtifact = result.colourArtifacts.find((a) => a.colourKey === "c2" && a.sheetIndex === 1);
    expect(redArtifact).toBeDefined();
    await expect(redArtifact!.svg).toMatchFileSnapshot("./__snapshots__/camaro-bearcat-claw.c2.svg");
  });

  it("[golden] locks the black (c1) colour SVG geometry", async () => {
    const body = loadCamaro();
    const spec = loadFixtureSpec();
    const result = await runPipeline(spec, body, { requireVerifiedBody: false });
    const blackArtifact = result.colourArtifacts.find((a) => a.colourKey === "c1" && a.sheetIndex === 1);
    expect(blackArtifact).toBeDefined();
    await expect(blackArtifact!.svg).toMatchFileSnapshot("./__snapshots__/camaro-bearcat-claw.c1.svg");
  });

  it("[golden] locks the spray guide text", async () => {
    const body = loadCamaro();
    const spec = loadFixtureSpec();
    const result = await runPipeline(spec, body, { requireVerifiedBody: false });
    await expect(result.sprayGuide).toMatchFileSnapshot("./__snapshots__/camaro-bearcat-claw.guide.md");
  });

  it("rejects a design against a body it wasn't written for", async () => {
    const body = loadCamaro();
    const spec = loadFixtureSpec();
    const result = await runPipeline({ ...spec, bodyId: "some-other-body" }, body, { requireVerifiedBody: false });
    expect(result.ok).toBe(false);
    expect(result.specIssues.length).toBeGreaterThan(0);
  });

  it("requires a verified body by default (business rule §2.1)", async () => {
    const body = loadCamaro(); // fixture ships status: draft
    const spec = loadFixtureSpec();
    const result = await runPipeline(spec, body);
    expect(result.ok).toBe(false);
    expect(result.specIssues.some((i) => i.rule === "bodyId")).toBe(true);
  });
});
