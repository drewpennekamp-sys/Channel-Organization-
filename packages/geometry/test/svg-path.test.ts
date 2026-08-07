import { describe, expect, it } from "vitest";
import {
  parsePath,
  serializePath,
  splitSubpaths,
  isClosedSubpath,
  transformPath,
  flattenSubpathToPolygon,
  boundsOfPolygon,
} from "../src/svg-path.js";
import { identityTransform, mirrorXTransform, rotateTransform, translateTransform, compose } from "../src/transform2d.js";

describe("parsePath", () => {
  it("parses a simple absolute rectangle", () => {
    const cmds = parsePath("M0,0 L489,0 L489,112 L0,112 Z");
    expect(cmds).toEqual([
      { type: "M", x: 0, y: 0 },
      { type: "L", x: 489, y: 0 },
      { type: "L", x: 489, y: 112 },
      { type: "L", x: 0, y: 112 },
      { type: "Z" },
    ]);
  });

  it("converts relative commands to absolute, including a relative arc", () => {
    const cmds = parsePath("M46,112 a34,34 0 0 1 68,0 Z");
    expect(cmds[0]).toEqual({ type: "M", x: 46, y: 112 });
    expect(cmds[1]).toMatchObject({ type: "A", rx: 34, ry: 34, largeArc: false, sweep: true, x: 114, y: 112 });
    expect(cmds[2]).toEqual({ type: "Z" });
  });

  it("handles packed arc flags with no separators", () => {
    const cmds = parsePath("M0,0A5,5 0 0110,0");
    expect(cmds[1]).toMatchObject({ type: "A", largeArc: false, sweep: true, x: 10, y: 0 });
  });

  it("supports H and V shorthand", () => {
    const cmds = parsePath("M0,0 H10 V10 Z");
    expect(cmds).toEqual([
      { type: "M", x: 0, y: 0 },
      { type: "L", x: 10, y: 0 },
      { type: "L", x: 10, y: 10 },
      { type: "Z" },
    ]);
  });

  it("supports implicit repeated L after the initial command", () => {
    const cmds = parsePath("M0,0 L10,0 10,10 0,10 Z");
    expect(cmds.map((c) => c.type)).toEqual(["M", "L", "L", "L", "Z"]);
  });
});

describe("split/isClosed", () => {
  it("splits a multi-subpath command list at each M", () => {
    const cmds = parsePath("M0,0 L1,0 L1,1 Z M5,5 L6,5 L6,6 Z");
    const subpaths = splitSubpaths(cmds);
    expect(subpaths).toHaveLength(2);
    expect(isClosedSubpath(subpaths[0]!)).toBe(true);
    expect(isClosedSubpath(subpaths[1]!)).toBe(true);
  });

  it("treats a subpath whose last point equals the first as implicitly closed", () => {
    const cmds = parsePath("M0,0 L1,0 L1,1 L0,0");
    expect(isClosedSubpath(cmds)).toBe(true);
  });
});

describe("transformPath", () => {
  it("mirrorX flips x and preserves y for straight lines", () => {
    const cmds = parsePath("M10,5 L20,5 Z");
    const out = transformPath(cmds, mirrorXTransform());
    expect(out[0]).toEqual({ type: "M", x: -10, y: 5 });
    expect(out[1]).toEqual({ type: "L", x: -20, y: 5 });
  });

  it("mirrorX flips an arc's sweep flag", () => {
    const cmds = parsePath("M46,112 a34,34 0 0 1 68,0 Z");
    const out = transformPath(cmds, mirrorXTransform());
    const arc = out[1] as any;
    expect(arc.sweep).toBe(false);
    expect(arc.largeArc).toBe(false);
    expect(arc.x).toBe(-114);
  });

  it("rotate + translate composition matches applying them in sequence", () => {
    const cmds = parsePath("M1,0 Z");
    const combined = compose(translateTransform(5, 5), rotateTransform(90));
    const out = transformPath(cmds, combined)[0] as any;
    // Rotate (1,0) by 90deg -> (0,1), then translate by (5,5) -> (5,6)
    expect(out.x).toBeCloseTo(5, 6);
    expect(out.y).toBeCloseTo(6, 6);
  });

  it("identity transform is a no-op", () => {
    const cmds = parsePath("M1,2 L3,4 Z");
    const out = transformPath(cmds, identityTransform());
    expect(out).toEqual(cmds);
  });
});

describe("serializePath", () => {
  it("round-trips a simple polygon", () => {
    const cmds = parsePath("M0,0 L489,0 L489,112 L0,112 Z");
    expect(serializePath(cmds)).toBe("M0,0 L489,0 L489,112 L0,112 Z");
  });

  it("rounds to 3 decimal places", () => {
    const cmds = parsePath("M0.123456,0 Z");
    expect(serializePath(cmds)).toBe("M0.123,0 Z");
  });
});

describe("flattenSubpathToPolygon + bounds", () => {
  it("flattens a rectangle to its 4 corners", () => {
    const subpath = parsePath("M0,0 L10,0 L10,10 L0,10 Z");
    const points = flattenSubpathToPolygon(subpath);
    expect(points).toHaveLength(4);
    expect(boundsOfPolygon(points)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
  });

  it("flattens a semicircular arc such that all sampled points stay within its bounding radius", () => {
    const subpath = parsePath("M46,112 a34,34 0 0 1 68,0 Z");
    const points = flattenSubpathToPolygon(subpath);
    expect(points.length).toBeGreaterThan(4);
    const bounds = boundsOfPolygon(points);
    // Arc centre is at x=80 (46+34), apex should reach roughly y=112-34=78.
    expect(bounds.minY).toBeGreaterThan(75);
    expect(bounds.minY).toBeLessThan(80);
  });
});
