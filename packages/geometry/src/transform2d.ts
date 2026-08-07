/**
 * Similarity transforms only — translate, rotate, uniform scale, and at
 * most one axis mirror. This is a deliberate restriction (never general
 * affine/shear/non-uniform-scale) because it's exactly what the pipeline
 * needs (placement rotate+translate, autoMirror, whole-sheet mirrorX) and
 * it makes elliptical-arc transforms exact via closed-form rules instead
 * of requiring a general 2x2 SVD decomposition.
 *
 * Composition order, applied to a point p:
 *   p' = translate + scale * Rotate(rotationDeg) * Mirror(p)
 * i.e. mirror first, then rotate, then scale, then translate.
 */
export interface Similarity2D {
  translateX: number;
  translateY: number;
  rotationDeg: number;
  scale: number;
  mirrorX: boolean;
}

export function identityTransform(): Similarity2D {
  return { translateX: 0, translateY: 0, rotationDeg: 0, scale: 1, mirrorX: false };
}

export function translateTransform(dx: number, dy: number): Similarity2D {
  return { translateX: dx, translateY: dy, rotationDeg: 0, scale: 1, mirrorX: false };
}

export function rotateTransform(deg: number): Similarity2D {
  return { translateX: 0, translateY: 0, rotationDeg: deg, scale: 1, mirrorX: false };
}

export function mirrorXTransform(): Similarity2D {
  return { translateX: 0, translateY: 0, rotationDeg: 0, scale: 1, mirrorX: true };
}

export interface Point2 {
  x: number;
  y: number;
}

export function applyToPoint(t: Similarity2D, p: Point2): Point2 {
  const mx = t.mirrorX ? -p.x : p.x;
  const my = p.y;
  const rad = (t.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = mx * cos - my * sin;
  const ry = mx * sin + my * cos;
  return {
    x: t.translateX + t.scale * rx,
    y: t.translateY + t.scale * ry,
  };
}

/**
 * Compose two transforms so that `applyToPoint(compose(outer, inner), p)`
 * equals `applyToPoint(outer, applyToPoint(inner, p))` — inner runs first.
 * Because both are restricted to similarity transforms this stays exact,
 * but note: mirror + rotation do not commute, so composing "mirror" then
 * "rotate" is NOT the same transform as "rotate" then "mirror". Compose
 * arguments in the order operations should visually happen (inner first).
 */
export function compose(outer: Similarity2D, inner: Similarity2D): Similarity2D {
  // Represent inner's basis vectors and push them through outer.
  const origin = applyToPoint(outer, applyToPoint(inner, { x: 0, y: 0 }));
  const ex = applyToPoint(outer, applyToPoint(inner, { x: 1, y: 0 }));
  const ey = applyToPoint(outer, applyToPoint(inner, { x: 0, y: 1 }));

  const vx = { x: ex.x - origin.x, y: ex.y - origin.y };
  const vy = { x: ey.x - origin.x, y: ey.y - origin.y };

  const scale = Math.hypot(vx.x, vx.y);
  const rotationDeg = (Math.atan2(vx.y, vx.x) * 180) / Math.PI;
  // Determinant sign tells us if the composed basis is right-handed
  // (no net mirror) or left-handed (net mirror) in this y-down space.
  const det = vx.x * vy.y - vx.y * vy.x;
  const mirrorX = det < 0;

  return {
    translateX: origin.x,
    translateY: origin.y,
    rotationDeg,
    scale: scale === 0 ? 1 : scale,
    mirrorX,
  };
}

export interface ArcParams {
  rx: number;
  ry: number;
  xAxisRotationDeg: number;
  largeArc: boolean;
  sweep: boolean;
}

/** Transform an elliptical arc's shape parameters (NOT its endpoint — transform that separately with applyToPoint). */
export function transformArcParams(t: Similarity2D, arc: ArcParams): ArcParams {
  const mirrorFlip = t.mirrorX ? -1 : 1;
  const xAxisRotationDeg = mirrorFlip * arc.xAxisRotationDeg + t.rotationDeg;
  const sweep = t.mirrorX ? !arc.sweep : arc.sweep;
  return {
    rx: arc.rx * t.scale,
    ry: arc.ry * t.scale,
    xAxisRotationDeg,
    largeArc: arc.largeArc,
    sweep,
  };
}
