import { describe, expect, it } from "vitest";
import { DesignSpecSchema } from "../src/design-spec.js";

function makeSpec(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    version: 1,
    bodyId: "protoform-1567-00",
    name: "Bearcat Claw",
    palette: {
      base: { name: "White", hex: "#FFFFFF", paintCode: "Tamiya PS-1" },
      c1: { name: "Black", hex: "#111111", paintCode: "Tamiya PS-5" },
      c2: { name: "Red", hex: "#C8102E", paintCode: "Tamiya PS-34" },
    },
    paintOrder: ["c2", "c1", "base"],
    placements: [
      {
        id: "p1",
        panel: "side-left",
        element: "slash-tear",
        colour: "c1",
        params: { lengthMm: 120, widthMm: 18, jaggedness: 0.7, seed: 4412 },
        xMm: 210,
        yMm: 34,
        rotationDeg: -12,
      },
    ],
    autoMirror: ["side-left→side-right"],
    ...overrides,
  };
}

describe("DesignSpecSchema", () => {
  it("accepts a well-formed spec", () => {
    const result = DesignSpecSchema.safeParse(makeSpec());
    expect(result.success).toBe(true);
  });

  it("rejects paintOrder missing a palette key", () => {
    const result = DesignSpecSchema.safeParse(makeSpec({ paintOrder: ["c2", "c1"] }));
    expect(result.success).toBe(false);
  });

  it("rejects paintOrder with a duplicate key", () => {
    const result = DesignSpecSchema.safeParse(
      makeSpec({ paintOrder: ["c2", "c1", "c1", "base"] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects paintOrder referencing an unknown colour", () => {
    const result = DesignSpecSchema.safeParse(
      makeSpec({ paintOrder: ["c2", "c1", "base", "c3"] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a placement referencing an unknown colour", () => {
    const spec = makeSpec();
    (spec.placements as any[])[0].colour = "does-not-exist";
    const result = DesignSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
  });

  it("rejects duplicate placement ids", () => {
    const spec = makeSpec();
    const placements = spec.placements as any[];
    placements.push({ ...placements[0] });
    const result = DesignSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
  });

  it("rejects a version other than 1", () => {
    const result = DesignSpecSchema.safeParse(makeSpec({ version: 2 }));
    expect(result.success).toBe(false);
  });
});
