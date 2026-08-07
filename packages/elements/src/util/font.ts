import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// opentype.js ships as CJS with no named ESM exports — under plain Node
// ESM (no bundler interop shim) `import * as opentype` puts everything
// behind a single `.default`, so `opentype.parse` doesn't exist. A
// default import is what actually works in both Node ESM and Vitest/Vite.
import opentype from "opentype.js";
import type { PathCommand, Font } from "opentype.js";
import { fmt } from "./path.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FONT_PATH = join(__dirname, "..", "..", "assets", "fonts", "LiberationSans-Bold.ttf");

let cachedFont: Font | null = null;
let cachedFontPath: string | null = null;

/**
 * Load (and cache) the bundled default font. `text-block` and
 * `banner-curved` MUST convert glyphs to real paths via this — never emit
 * an SVG <text> element (Cricut Design Space can't cut fonts it doesn't
 * have installed, and neither can a vinyl blade).
 */
export function loadFont(fontPath: string = DEFAULT_FONT_PATH): Font {
  if (cachedFont && cachedFontPath === fontPath) return cachedFont;
  const buffer = readFileSync(fontPath);
  // opentype.parse expects a Node Buffer's underlying ArrayBuffer.
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  cachedFont = opentype.parse(arrayBuffer);
  cachedFontPath = fontPath;
  return cachedFont;
}

type Point2 = { x: number; y: number };
type PointTransform = (p: Point2) => Point2;

/** Apply a point transform to every coordinate/control-point in a command list. */
function transformCommands(commands: PathCommand[], transform: PointTransform): PathCommand[] {
  return commands.map((cmd) => {
    switch (cmd.type) {
      case "Z":
        return cmd;
      case "M":
      case "L": {
        const p = transform({ x: cmd.x, y: cmd.y });
        return { type: cmd.type, x: p.x, y: p.y };
      }
      case "Q": {
        const c1 = transform({ x: cmd.x1, y: cmd.y1 });
        const p = transform({ x: cmd.x, y: cmd.y });
        return { type: "Q", x1: c1.x, y1: c1.y, x: p.x, y: p.y };
      }
      case "C": {
        const c1 = transform({ x: cmd.x1, y: cmd.y1 });
        const c2 = transform({ x: cmd.x2, y: cmd.y2 });
        const p = transform({ x: cmd.x, y: cmd.y });
        return { type: "C", x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: p.x, y: p.y };
      }
    }
  });
}

/** Serialize a single glyph/contour's commands to one "M...Z" subpath string. */
function commandsToSubpaths(commands: PathCommand[]): string[] {
  // opentype.js glyph contours often rely on IMPLICIT closure (the last
  // point coincides with the first) instead of an explicit Z command —
  // we always emit an explicit trailing Z per subpath regardless, since
  // "closed subpaths only" is a hard Cricut-safe requirement (§3.5), not
  // an opentype.js convention we can lean on.
  const subpaths: string[] = [];
  let current: string[] = [];
  const closeCurrent = () => {
    if (current.length === 0) return;
    if (current[current.length - 1] !== "Z") current.push("Z");
    subpaths.push(current.join(" "));
  };
  for (const cmd of commands) {
    if (cmd.type === "M") {
      closeCurrent();
      current = [`M${fmt(cmd.x)},${fmt(cmd.y)}`];
    } else if (cmd.type === "L") {
      current.push(`L${fmt(cmd.x)},${fmt(cmd.y)}`);
    } else if (cmd.type === "Q") {
      current.push(`Q${fmt(cmd.x1)},${fmt(cmd.y1)} ${fmt(cmd.x)},${fmt(cmd.y)}`);
    } else if (cmd.type === "C") {
      current.push(`C${fmt(cmd.x1)},${fmt(cmd.y1)} ${fmt(cmd.x2)},${fmt(cmd.y2)} ${fmt(cmd.x)},${fmt(cmd.y)}`);
    } else if (cmd.type === "Z") {
      current.push("Z");
    }
  }
  closeCurrent();
  return subpaths;
}

export interface LaidOutText {
  /** One closed-subpath string per glyph contour (letters with holes emit >1). */
  subpaths: string[];
  /** Bounding box of the untransformed, straight-baseline layout, in mm. */
  bbox: { x1: number; y1: number; x2: number; y2: number };
}

/**
 * Lay out `text` on a straight baseline at the given size (mm, treated as
 * the font's em size — NOT cap height). Returns one closed subpath per
 * glyph contour, still in the font's own straight-baseline coordinate
 * space (SVG y-down convention, baseline at y=0) so callers can re-map
 * every point themselves (e.g. onto an arc) before flattening to a single
 * path list.
 */
export function layoutTextStraight(font: Font, text: string, sizeMm: number): LaidOutText {
  const full = font.getPath(text, 0, 0, sizeMm);
  const bbox = full.getBoundingBox();
  const subpaths = commandsToSubpaths(full.commands as PathCommand[]);
  return { subpaths, bbox };
}

export interface ArcTextOptions {
  radiusMm: number;
  /** Mirror the finished arc layout vertically (banner hangs below the arc line instead of riding on top of it). */
  invert?: boolean;
}

/**
 * Lay out `text` along a circular arc. Each glyph is individually rotated
 * to stay normal to the arc (not just translated) — a straight line of
 * text bent onto a curve without per-glyph rotation looks wrong and,
 * worse, self-intersects at anything but a huge radius.
 *
 * `invert` is implemented as a vertical mirror of the whole non-inverted
 * layout (documented simplification — see inline comment). Exact
 * "text-hugs-the-underside-of-the-arc-right-side-up" typography is a
 * Phase 2 concern once there's a renderer to check it against visually.
 */
export function layoutTextOnArc(font: Font, text: string, sizeMm: number, opts: ArcTextOptions): LaidOutText {
  const { radiusMm, invert = false } = opts;
  if (radiusMm <= 0) throw new Error("layoutTextOnArc requires radiusMm > 0");

  const glyphPaths = font.getPaths(text, 0, 0, sizeMm);
  const fullBox = font.getPath(text, 0, 0, sizeMm).getBoundingBox();
  const textCenterX = (fullBox.x1 + fullBox.x2) / 2;

  const allSubpaths: string[] = [];
  let outMinX = Infinity;
  let outMinY = Infinity;
  let outMaxX = -Infinity;
  let outMaxY = -Infinity;

  for (const glyphPath of glyphPaths) {
    const glyphBox = glyphPath.getBoundingBox();
    if (!Number.isFinite(glyphBox.x1)) continue; // space / empty glyph
    const glyphCenterX = (glyphBox.x1 + glyphBox.x2) / 2;
    const theta = (glyphCenterX - textCenterX) / radiusMm;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const anchorX = radiusMm * sinT;
    const anchorY = radiusMm - radiusMm * cosT;

    const transform: PointTransform = (p) => {
      const localX = p.x - glyphCenterX;
      const localY = p.y;
      let x = localX * cosT - localY * sinT + anchorX;
      let y = localX * sinT + localY * cosT + anchorY;
      if (invert) y = -y;
      return { x, y };
    };

    const transformed = transformCommands(glyphPath.commands as PathCommand[], transform);
    for (const cmd of transformed) {
      if (cmd.type === "Z") continue;
      outMinX = Math.min(outMinX, cmd.x);
      outMaxX = Math.max(outMaxX, cmd.x);
      outMinY = Math.min(outMinY, cmd.y);
      outMaxY = Math.max(outMaxY, cmd.y);
    }
    allSubpaths.push(...commandsToSubpaths(transformed));
  }

  return {
    subpaths: allSubpaths,
    bbox: { x1: outMinX, y1: outMinY, x2: outMaxX, y2: outMaxY },
  };
}
