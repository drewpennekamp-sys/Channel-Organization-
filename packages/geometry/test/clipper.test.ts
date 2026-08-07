import { describe, expect, it } from "vitest";
import { unionPolygons, offsetPolygons, differencePolygons, polygonArea } from "../src/clipper.js";

function square(x0: number, y0: number, size: number) {
  return [
    { x: x0, y: y0 },
    { x: x0 + size, y: y0 },
    { x: x0 + size, y: y0 + size },
    { x: x0, y: y0 + size },
  ];
}

describe("clipper wrapper", () => {
  it("unions two overlapping squares into one shape", async () => {
    const a = square(0, 0, 10);
    const b = square(5, 0, 10);
    const result = await unionPolygons([a, b]);
    expect(result).toHaveLength(1);
    expect(Math.abs(polygonArea(result[0]!))).toBeCloseTo(150, 0); // 10x10 + 10x10 - 5x10 overlap
  });

  it("keeps two non-overlapping squares separate", async () => {
    const a = square(0, 0, 5);
    const b = square(20, 0, 5);
    const result = await unionPolygons([a, b]);
    expect(result).toHaveLength(2);
  });

  it("offsetting a 0.8mm-wide bar by -0.6/+0.6 removes it (min-width detector primitive)", async () => {
    const thinBar = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 0.8 },
      { x: 0, y: 0.8 },
    ];
    const opened = await offsetPolygons(await offsetPolygons([thinBar], -0.6), 0.6);
    const totalArea = opened.reduce((sum, p) => sum + Math.abs(polygonArea(p)), 0);
    expect(totalArea).toBeLessThan(1); // effectively vanished
  });

  it("offsetting a 2.0mm-wide bar by -0.6/+0.6 survives (above the 1.2mm floor)", async () => {
    const thickBar = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 2.0 },
      { x: 0, y: 2.0 },
    ];
    const opened = await offsetPolygons(await offsetPolygons([thickBar], -0.6), 0.6);
    const totalArea = opened.reduce((sum, p) => sum + Math.abs(polygonArea(p)), 0);
    expect(totalArea).toBeGreaterThan(20); // most of the ~40mm^2 bar survives
  });

  it("differencePolygons subtracts a hole from a square", async () => {
    const outer = square(0, 0, 10);
    const hole = square(3, 3, 2);
    const result = await differencePolygons([outer], [hole]);
    // Clipper represents an outer ring + hole as two paths with opposite
    // winding, so the NET area (signed sum, not abs-per-path) is what
    // matters here — the hole's negative area cancels part of the outer's.
    const area = Math.abs(result.reduce((sum, p) => sum + polygonArea(p), 0));
    expect(area).toBeCloseTo(96, 0);
  });
});
