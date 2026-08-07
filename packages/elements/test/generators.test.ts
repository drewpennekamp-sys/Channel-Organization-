import { describe, expect, it } from "vitest";
import { generateSlashTear, SlashTearParams } from "../src/generators/slash-tear.js";
import { generateChevronArrow, ChevronArrowParams } from "../src/generators/chevron-arrow.js";
import { generateStripeJagged, StripeJaggedParams } from "../src/generators/stripe-jagged.js";
import { generateTextBlock, TextBlockParams } from "../src/generators/text-block.js";
import { generateBannerCurved, BannerCurvedParams } from "../src/generators/banner-curved.js";
import { generateRibbonAwareness, RibbonAwarenessParams } from "../src/generators/ribbon-awareness.js";
import { listElements, getElement, requireElement } from "../src/registry.js";

function expectClosedSubpaths(fills: string[]) {
  expect(fills.length).toBeGreaterThan(0);
  for (const d of fills) {
    expect(d.trimStart().startsWith("M")).toBe(true);
    expect(d.trimEnd().endsWith("Z")).toBe(true);
    // No relative (lowercase) path commands anywhere in the subpath.
    expect(d).not.toMatch(/(?:^|\s)[mlcqzhvast](?=[\d.\-])/);
  }
}

describe("registry", () => {
  it("lists exactly the 6 v1 elements", () => {
    const ids = listElements()
      .map((e) => e.id)
      .sort();
    expect(ids).toEqual(
      ["banner-curved", "chevron-arrow", "ribbon-awareness", "slash-tear", "stripe-jagged", "text-block"].sort(),
    );
  });

  it("requireElement throws on unknown id", () => {
    expect(() => requireElement("does-not-exist")).toThrow();
    expect(getElement("does-not-exist")).toBeUndefined();
  });
});

describe("slash-tear", () => {
  const params = SlashTearParams.parse({ lengthMm: 120, widthMm: 18, jaggedness: 0.7, seed: 4412 });

  it("emits one closed subpath with real minFeatureMm", () => {
    const result = generateSlashTear(params);
    expect(result.fills).toHaveLength(1);
    expectClosedSubpaths(result.fills);
    expect(result.minFeatureMm).toBeGreaterThanOrEqual(0);
    expect(result.minFeatureMm).toBeLessThanOrEqual(params.widthMm);
  });

  it("is deterministic given the same params and seed", () => {
    const a = generateSlashTear(params);
    const b = generateSlashTear(params);
    expect(a.fills).toEqual(b.fills);
    expect(a.minFeatureMm).toBe(b.minFeatureMm);
  });

  it("produces different geometry for a different seed", () => {
    const a = generateSlashTear(params);
    const b = generateSlashTear({ ...params, seed: 999 });
    expect(a.fills).not.toEqual(b.fills);
  });

  it("rejects params below the schema floor", () => {
    expect(() => SlashTearParams.parse({ lengthMm: 1, widthMm: 18 })).toThrow();
  });
});

describe("chevron-arrow", () => {
  it("emits two closed subpaths (two arms) whose thickness matches minFeatureMm", () => {
    const params = ChevronArrowParams.parse({ armLengthMm: 90, angleDeg: 60, thicknessMm: 12 });
    const result = generateChevronArrow(params);
    expect(result.fills).toHaveLength(2);
    expectClosedSubpaths(result.fills);
    expect(result.minFeatureMm).toBe(12);
  });
});

describe("stripe-jagged", () => {
  it("emits a single closed ribbon with min width below the nominal width (jagged edges bite in)", () => {
    const params = StripeJaggedParams.parse({ lengthMm: 300, widthMm: 40, teeth: 8, seed: 7 });
    const result = generateStripeJagged(params);
    expect(result.fills).toHaveLength(1);
    expectClosedSubpaths(result.fills);
    expect(result.minFeatureMm).toBeGreaterThan(0);
    expect(result.minFeatureMm).toBeLessThan(params.widthMm);
  });
});

describe("text-block", () => {
  it("converts glyphs to real closed paths, never <text>", () => {
    const params = TextBlockParams.parse({ text: "CINCINNATI", sizeMm: 22 });
    const result = generateTextBlock(params);
    expectClosedSubpaths(result.fills);
    expect(result.fills.join("")).not.toMatch(/<text/i);
  });

  it("emits multiple subpaths for a letter with a counter (hole)", () => {
    const params = TextBlockParams.parse({ text: "O", sizeMm: 40 });
    const result = generateTextBlock(params);
    // "O" is an outer contour + an inner counter contour.
    expect(result.fills.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects text below the 12mm cap-height floor", () => {
    expect(() => TextBlockParams.parse({ text: "hi", sizeMm: 8 })).toThrow();
  });

  it("is deterministic", () => {
    const params = TextBlockParams.parse({ text: "DRIFT", sizeMm: 30 });
    expect(generateTextBlock(params).fills).toEqual(generateTextBlock(params).fills);
  });
});

describe("banner-curved", () => {
  it("lays text on an arc as closed subpaths", () => {
    const params = BannerCurvedParams.parse({ text: "BEARCAT", radiusMm: 150, heightMm: 20 });
    const result = generateBannerCurved(params);
    expectClosedSubpaths(result.fills);
  });
});

describe("ribbon-awareness", () => {
  it("emits two overlapping bands as closed subpaths", () => {
    const params = RibbonAwarenessParams.parse({ heightMm: 60, tailStyle: "notched" });
    const result = generateRibbonAwareness(params);
    expect(result.fills).toHaveLength(2);
    expectClosedSubpaths(result.fills);
    expect(result.minFeatureMm).toBeCloseTo(60 * 0.16, 5);
  });

  it("supports the pointed tail style too", () => {
    const params = RibbonAwarenessParams.parse({ heightMm: 60, tailStyle: "pointed" });
    const result = generateRibbonAwareness(params);
    expect(result.fills).toHaveLength(2);
    expectClosedSubpaths(result.fills);
  });
});
