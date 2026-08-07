import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadBodyTemplate, BodyTemplateError, parseBodyTemplate } from "../src/loader.js";
import { resolvePanel } from "../src/panel.js";

const CAMARO_PATH = fileURLToPath(
  new URL("../../../content/bodies/protoform-1567-00.btf.json", import.meta.url),
);

function readCamaro(): unknown {
  return JSON.parse(readFileSync(CAMARO_PATH, "utf-8"));
}

describe("loadBodyTemplate — protoform-1567-00 fixture", () => {
  it("loads and validates the real Camaro fixture", () => {
    const body = loadBodyTemplate(readCamaro());
    expect(body.id).toBe("protoform-1567-00");
    expect(body.dimensionsMm.length).toBe(489);
    expect(body.status).toBe("draft");
  });

  it("resolves side-right as a mirror of side-left with identical dims", () => {
    const body = loadBodyTemplate(readCamaro());
    const left = resolvePanel(body, "side-left");
    const right = resolvePanel(body, "side-right");
    expect(right.isMirror).toBe(true);
    expect(right.sourcePanelId).toBe("side-left");
    expect(right.widthMm).toBe(left.widthMm);
    expect(right.heightMm).toBe(left.heightMm);
    expect(right.outline).toBe(left.outline);
  });

  it("rejects a BTF with a mirrorOf pointing at a nonexistent panel", () => {
    const body = readCamaro() as any;
    body.panels.push({ id: "spoiler", mirrorOf: "does-not-exist" });
    expect(() => loadBodyTemplate(body)).toThrow(BodyTemplateError);
  });

  it("rejects chained mirrors", () => {
    const body = readCamaro() as any;
    body.panels.push({ id: "side-right-2", mirrorOf: "side-right" });
    expect(() => loadBodyTemplate(body)).toThrow(/chained mirrors/);
  });

  it("parseBodyTemplate does structural-only validation (no semantic check)", () => {
    const body = readCamaro() as any;
    body.panels.push({ id: "ghost", mirrorOf: "nope" });
    // Structurally fine (mirror panels only need id + mirrorOf) even though
    // the mirror target doesn't exist.
    expect(() => parseBodyTemplate(body)).not.toThrow();
  });
});
