import type { BoundsMm, PointMm } from "@livery-lab/schema";
import { applyToPoint, transformArcParams, type Similarity2D } from "./transform2d.js";

export type PathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "Q"; x1: number; y1: number; x: number; y: number }
  | {
      type: "A";
      rx: number;
      ry: number;
      xAxisRotationDeg: number;
      largeArc: boolean;
      sweep: boolean;
      x: number;
      y: number;
    }
  | { type: "Z" };

const COMMAND_LETTERS = new Set("MmLlHhVvCcQqAaZz");
const NUMBER_RE = /-?\d*\.\d+(?:[eE][-+]?\d+)?|-?\d+(?:[eE][-+]?\d+)?/y;

class Scanner {
  private i = 0;
  constructor(private s: string) {}

  private skipSeparators() {
    while (this.i < this.s.length && /[\s,]/.test(this.s[this.i]!)) this.i++;
  }

  atEnd(): boolean {
    this.skipSeparators();
    return this.i >= this.s.length;
  }

  peekCommandLetter(): string | null {
    this.skipSeparators();
    const c = this.s[this.i];
    return c !== undefined && COMMAND_LETTERS.has(c) ? c : null;
  }

  consumeCommandLetter(): string {
    this.skipSeparators();
    const c = this.s[this.i];
    if (c === undefined || !COMMAND_LETTERS.has(c)) {
      throw new Error(`Expected an SVG path command letter at index ${this.i} in "${this.s}"`);
    }
    this.i++;
    return c;
  }

  hasMoreNumbers(): boolean {
    this.skipSeparators();
    const c = this.s[this.i];
    return c !== undefined && /[0-9.\-+]/.test(c);
  }

  readNumber(): number {
    this.skipSeparators();
    NUMBER_RE.lastIndex = this.i;
    const m = NUMBER_RE.exec(this.s);
    if (!m) throw new Error(`Expected a number at index ${this.i} in "${this.s}"`);
    this.i = NUMBER_RE.lastIndex;
    return parseFloat(m[0]);
  }

  /** Arc flags are a single '0'/'1' character, sometimes packed with no separator ("...001..."). */
  readFlag(): boolean {
    this.skipSeparators();
    const c = this.s[this.i];
    if (c !== "0" && c !== "1") {
      throw new Error(`Expected an arc flag (0 or 1) at index ${this.i} in "${this.s}"`);
    }
    this.i++;
    return c === "1";
  }
}

/**
 * Parse an SVG path `d` string into a list of absolute-coordinate
 * commands. Supports M/L/H/V/C/Q/A/Z, both cases (relative commands are
 * converted to absolute immediately). Does NOT support the S/T
 * smooth-curve shorthand — none of our own generators emit it and hand
 * authored BTF content shouldn't need it for simple panel outlines.
 */
export function parsePath(d: string): PathCommand[] {
  const s = new Scanner(d);
  const cmds: PathCommand[] = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let lastLetter: string | null = null;

  while (!s.atEnd()) {
    let letter = s.peekCommandLetter();
    if (letter) {
      s.consumeCommandLetter();
    } else {
      if (!lastLetter) throw new Error(`Path data must start with a command letter: "${d}"`);
      // Implicit repeat: bare coordinates reuse the previous command,
      // except a repeated M becomes an implicit L per the SVG spec.
      letter = lastLetter === "M" ? "L" : lastLetter === "m" ? "l" : lastLetter;
    }
    const abs = letter === letter.toUpperCase();
    const upper = letter.toUpperCase();

    switch (upper) {
      case "M": {
        const x = s.readNumber();
        const y = s.readNumber();
        cx = abs ? x : cx + x;
        cy = abs ? y : cy + y;
        sx = cx;
        sy = cy;
        cmds.push({ type: "M", x: cx, y: cy });
        break;
      }
      case "L": {
        const x = s.readNumber();
        const y = s.readNumber();
        cx = abs ? x : cx + x;
        cy = abs ? y : cy + y;
        cmds.push({ type: "L", x: cx, y: cy });
        break;
      }
      case "H": {
        const x = s.readNumber();
        cx = abs ? x : cx + x;
        cmds.push({ type: "L", x: cx, y: cy });
        break;
      }
      case "V": {
        const y = s.readNumber();
        cy = abs ? y : cy + y;
        cmds.push({ type: "L", x: cx, y: cy });
        break;
      }
      case "C": {
        const x1r = s.readNumber();
        const y1r = s.readNumber();
        const x2r = s.readNumber();
        const y2r = s.readNumber();
        const xr = s.readNumber();
        const yr = s.readNumber();
        const x1 = abs ? x1r : cx + x1r;
        const y1 = abs ? y1r : cy + y1r;
        const x2 = abs ? x2r : cx + x2r;
        const y2 = abs ? y2r : cy + y2r;
        const x = abs ? xr : cx + xr;
        const y = abs ? yr : cy + yr;
        cmds.push({ type: "C", x1, y1, x2, y2, x, y });
        cx = x;
        cy = y;
        break;
      }
      case "Q": {
        const x1r = s.readNumber();
        const y1r = s.readNumber();
        const xr = s.readNumber();
        const yr = s.readNumber();
        const x1 = abs ? x1r : cx + x1r;
        const y1 = abs ? y1r : cy + y1r;
        const x = abs ? xr : cx + xr;
        const y = abs ? yr : cy + yr;
        cmds.push({ type: "Q", x1, y1, x, y });
        cx = x;
        cy = y;
        break;
      }
      case "A": {
        const rx = s.readNumber();
        const ry = s.readNumber();
        const xAxisRotationDeg = s.readNumber();
        const largeArc = s.readFlag();
        const sweep = s.readFlag();
        const xr = s.readNumber();
        const yr = s.readNumber();
        const x = abs ? xr : cx + xr;
        const y = abs ? yr : cy + yr;
        cmds.push({ type: "A", rx, ry, xAxisRotationDeg, largeArc, sweep, x, y });
        cx = x;
        cy = y;
        break;
      }
      case "Z": {
        cmds.push({ type: "Z" });
        cx = sx;
        cy = sy;
        break;
      }
      default:
        throw new Error(`Unsupported path command "${letter}" in "${d}"`);
    }
    lastLetter = letter;
  }

  return cmds;
}

/** Split a flat absolute command list at each M into independent subpaths (each starting with M). */
export function splitSubpaths(cmds: PathCommand[]): PathCommand[][] {
  const subpaths: PathCommand[][] = [];
  let current: PathCommand[] = [];
  for (const cmd of cmds) {
    if (cmd.type === "M") {
      if (current.length > 0) subpaths.push(current);
      current = [cmd];
    } else {
      current.push(cmd);
    }
  }
  if (current.length > 0) subpaths.push(current);
  return subpaths;
}

export function isClosedSubpath(subpath: PathCommand[]): boolean {
  if (subpath.length === 0 || subpath[0]!.type !== "M") return false;
  const last = subpath[subpath.length - 1]!;
  if (last.type === "Z") return true;
  const first = subpath[0] as { x: number; y: number };
  return Math.abs(last.x - first.x) < 1e-6 && Math.abs(last.y - first.y) < 1e-6;
}

export function transformPath(cmds: PathCommand[], t: Similarity2D): PathCommand[] {
  return cmds.map((cmd) => {
    if (cmd.type === "Z") return cmd;
    if (cmd.type === "A") {
      const p = applyToPoint(t, { x: cmd.x, y: cmd.y });
      const arc = transformArcParams(t, {
        rx: cmd.rx,
        ry: cmd.ry,
        xAxisRotationDeg: cmd.xAxisRotationDeg,
        largeArc: cmd.largeArc,
        sweep: cmd.sweep,
      });
      return { type: "A", ...arc, x: p.x, y: p.y };
    }
    if (cmd.type === "C") {
      const p = applyToPoint(t, { x: cmd.x, y: cmd.y });
      const c1 = applyToPoint(t, { x: cmd.x1, y: cmd.y1 });
      const c2 = applyToPoint(t, { x: cmd.x2, y: cmd.y2 });
      return { type: "C", x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: p.x, y: p.y };
    }
    if (cmd.type === "Q") {
      const p = applyToPoint(t, { x: cmd.x, y: cmd.y });
      const c1 = applyToPoint(t, { x: cmd.x1, y: cmd.y1 });
      return { type: "Q", x1: c1.x, y1: c1.y, x: p.x, y: p.y };
    }
    // M | L
    const p = applyToPoint(t, { x: cmd.x, y: cmd.y });
    return { type: cmd.type, x: p.x, y: p.y };
  });
}

function fmt3(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? "0" : r.toString();
}

/** Serialize a command list back to a "d" string, absolute commands, 3 decimal places. */
export function serializePath(cmds: PathCommand[]): string {
  const parts: string[] = [];
  for (const cmd of cmds) {
    switch (cmd.type) {
      case "M":
        parts.push(`M${fmt3(cmd.x)},${fmt3(cmd.y)}`);
        break;
      case "L":
        parts.push(`L${fmt3(cmd.x)},${fmt3(cmd.y)}`);
        break;
      case "C":
        parts.push(`C${fmt3(cmd.x1)},${fmt3(cmd.y1)} ${fmt3(cmd.x2)},${fmt3(cmd.y2)} ${fmt3(cmd.x)},${fmt3(cmd.y)}`);
        break;
      case "Q":
        parts.push(`Q${fmt3(cmd.x1)},${fmt3(cmd.y1)} ${fmt3(cmd.x)},${fmt3(cmd.y)}`);
        break;
      case "A":
        parts.push(
          `A${fmt3(cmd.rx)},${fmt3(cmd.ry)} ${fmt3(cmd.xAxisRotationDeg)} ${cmd.largeArc ? 1 : 0} ${cmd.sweep ? 1 : 0} ${fmt3(cmd.x)},${fmt3(cmd.y)}`,
        );
        break;
      case "Z":
        parts.push("Z");
        break;
    }
  }
  return parts.join(" ");
}

/** Sample a cubic bezier at parameter t in [0,1]. */
function cubicAt(p0: PointMm, p1: PointMm, p2: PointMm, p3: PointMm, t: number): PointMm {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const dd = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + dd * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + dd * p3.y,
  };
}

function quadAt(p0: PointMm, p1: PointMm, p2: PointMm, t: number): PointMm {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

/** Endpoint-to-center arc parameterization (SVG spec appendix F.6.5), returns sample points along the arc (excluding the start point). */
function flattenArc(start: PointMm, cmd: Extract<PathCommand, { type: "A" }>, segments = 24): PointMm[] {
  let { rx, ry } = cmd;
  const phi = (cmd.xAxisRotationDeg * Math.PI) / 180;
  const { x: x2, y: y2 } = cmd;
  if (rx === 0 || ry === 0) return [{ x: x2, y: y2 }];
  rx = Math.abs(rx);
  ry = Math.abs(ry);

  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx2 = (start.x - x2) / 2;
  const dy2 = (start.y - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  let rxSq = rx * rx;
  let rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;
  const lambda = x1pSq / rxSq + y1pSq / rySq;
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
    rxSq = rx * rx;
    rySq = ry * ry;
  }

  const sign = cmd.largeArc !== cmd.sweep ? 1 : -1;
  const num = rxSq * rySq - rxSq * y1pSq - rySq * x1pSq;
  const den = rxSq * y1pSq + rySq * x1pSq;
  const coef = sign * Math.sqrt(Math.max(0, num / den || 0));
  const cxp = (coef * (rx * y1p)) / ry;
  const cyp = (coef * -(ry * x1p)) / rx;

  const cx = cosPhi * cxp - sinPhi * cyp + (start.x + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (start.y + y2) / 2;

  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const sgn = ux * vy - uy * vx < 0 ? -1 : 1;
    const dot = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy))));
    return sgn * Math.acos(dot);
  };

  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!cmd.sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (cmd.sweep && dTheta < 0) dTheta += 2 * Math.PI;

  const points: PointMm[] = [];
  const n = Math.max(2, Math.ceil((Math.abs(dTheta) / (Math.PI * 2)) * segments));
  for (let i = 1; i <= n; i++) {
    const theta = theta1 + (dTheta * i) / n;
    const ex = cx + rx * Math.cos(theta) * cosPhi - ry * Math.sin(theta) * sinPhi;
    const ey = cy + rx * Math.cos(theta) * sinPhi + ry * Math.sin(theta) * cosPhi;
    points.push({ x: ex, y: ey });
  }
  return points;
}

/**
 * Flatten a single closed subpath (starting with M) into a polygon point
 * loop, approximating curves/arcs with straight segments. Used to feed
 * Clipper (booleans, offsetting) and for bounding-box / node-count checks.
 */
export function flattenSubpathToPolygon(subpath: PathCommand[]): PointMm[] {
  const points: PointMm[] = [];
  let current: PointMm = { x: 0, y: 0 };
  for (const cmd of subpath) {
    switch (cmd.type) {
      case "M":
        current = { x: cmd.x, y: cmd.y };
        points.push(current);
        break;
      case "L":
        current = { x: cmd.x, y: cmd.y };
        points.push(current);
        break;
      case "Q": {
        const p1 = { x: cmd.x1, y: cmd.y1 };
        const p2 = { x: cmd.x, y: cmd.y };
        const n = 12;
        for (let i = 1; i <= n; i++) points.push(quadAt(current, p1, p2, i / n));
        current = p2;
        break;
      }
      case "C": {
        const p1 = { x: cmd.x1, y: cmd.y1 };
        const p2 = { x: cmd.x2, y: cmd.y2 };
        const p3 = { x: cmd.x, y: cmd.y };
        const n = 16;
        for (let i = 1; i <= n; i++) points.push(cubicAt(current, p1, p2, p3, i / n));
        current = p3;
        break;
      }
      case "A": {
        const arcPoints = flattenArc(current, cmd);
        points.push(...arcPoints);
        current = { x: cmd.x, y: cmd.y };
        break;
      }
      case "Z":
        // closed implicitly by the caller treating this as a polygon loop
        break;
    }
  }
  return points;
}

export function boundsOfPolygon(points: PointMm[]): BoundsMm {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export function boundsUnion(a: BoundsMm, b: BoundsMm): BoundsMm {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function translatePolygon(points: PointMm[], dx: number, dy: number): PointMm[] {
  return points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}
