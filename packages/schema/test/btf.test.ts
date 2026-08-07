import { describe, expect, it } from "vitest";
import { BodyTemplateSchema } from "../src/btf.js";

const baseDims = {
  length: 489,
  widthFront: 195,
  widthRear: 195,
  height: 112,
  wheelbase: 272,
  frontOverhang: 80,
  rearOverhang: 137,
  trackWidth: 195,
  roofWidth: 183,
};

function makeBody(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "protoform-1567-00",
    manufacturer: "PROTOform",
    name: "1971 Chevrolet Camaro Z28",
    partNumber: "1567-00",
    scale: "1/10",
    class: "on-road",
    dimensionsMm: baseDims,
    bodyWeightG: 160,
    material: "clear-polycarbonate",
    panels: [
      {
        id: "side-left",
        label: "Left side",
        widthMm: 489,
        heightMm: 112,
        outline: "M0,0 L489,0 L489,112 L0,112 Z",
        curvature: "low",
      },
      { id: "side-right", mirrorOf: "side-left" },
    ],
    views: [],
    status: "draft",
    ...overrides,
  };
}

describe("BodyTemplateSchema", () => {
  it("accepts a well-formed BTF with a mirror panel", () => {
    const result = BodyTemplateSchema.safeParse(makeBody());
    expect(result.success).toBe(true);
  });

  it("rejects a non-mirror panel missing an outline", () => {
    const body = makeBody({
      panels: [
        { id: "hood", widthMm: 195, heightMm: 140, curvature: "medium" },
      ],
    });
    const result = BodyTemplateSchema.safeParse(body);
    expect(result.success).toBe(false);
  });

  it("rejects a panel that mirrors itself", () => {
    const body = makeBody({
      panels: [{ id: "side-left", mirrorOf: "side-left" }],
    });
    const result = BodyTemplateSchema.safeParse(body);
    expect(result.success).toBe(false);
  });

  it("allows a mirror panel to omit geometry entirely", () => {
    const body = makeBody();
    const result = BodyTemplateSchema.safeParse(body);
    expect(result.success).toBe(true);
    if (result.success) {
      const mirror = result.data.panels.find((p) => p.id === "side-right");
      expect(mirror?.outline).toBeUndefined();
      expect(mirror?.mirrorOf).toBe("side-left");
    }
  });
});
