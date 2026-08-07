import type { BodyTemplate } from "@livery-lab/schema";
import { resolvePanel, type ResolvedPanel } from "@livery-lab/bodies";
import { parsePath, splitSubpaths, transformPath, flattenSubpathToPolygon } from "./svg-path.js";
import { mirrorXTransform, translateTransform, compose } from "./transform2d.js";
import type { Polygon } from "./clipper.js";

export interface PanelGeometry {
  id: string;
  widthMm: number;
  heightMm: number;
  /** Outer boundary of the panel, flattened, mirrored if this panel is a mirrorOf another. */
  outline: Polygon;
  /** Cutout regions (e.g. wheel arches) to keep clear of artwork, same mirroring applied. */
  cutouts: Polygon[];
  curvature: ResolvedPanel["curvature"];
  isMirror: boolean;
}

/**
 * Resolve a panel's full geometry (outline + cutouts, flattened to
 * polygons, mirrored if needed) — the geometry-package counterpart to
 * @livery-lab/bodies' resolvePanel, which deliberately stops short of
 * doing any path math itself.
 */
export function getPanelGeometry(body: BodyTemplate, panelId: string): PanelGeometry {
  const resolved = resolvePanel(body, panelId);
  const mirror = resolved.isMirror
    ? compose(translateTransform(resolved.widthMm, 0), mirrorXTransform())
    : null;

  const flattenMaybeMirrored = (d: string): Polygon => {
    const subpaths = splitSubpaths(parsePath(d));
    const first = subpaths[0];
    if (!first) throw new Error(`Panel "${panelId}" has an empty outline/cutout path`);
    const cmds = mirror ? transformPath(first, mirror) : first;
    return flattenSubpathToPolygon(cmds);
  };

  return {
    id: resolved.id,
    widthMm: resolved.widthMm,
    heightMm: resolved.heightMm,
    outline: flattenMaybeMirrored(resolved.outline),
    cutouts: resolved.cutouts.map((c) => flattenMaybeMirrored(c.d)),
    curvature: resolved.curvature,
    isMirror: resolved.isMirror,
  };
}
