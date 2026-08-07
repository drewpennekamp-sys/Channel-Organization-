import type { BodyTemplate, DesignSpec, Placement } from "@livery-lab/schema";
import { requireElement } from "@livery-lab/elements";
import { getPanel } from "@livery-lab/bodies";
import { parsePath, splitSubpaths, transformPath, flattenSubpathToPolygon } from "./svg-path.js";
import {
  applyToPoint,
  compose,
  identityTransform,
  mirrorXTransform,
  rotateTransform,
  translateTransform,
  type Similarity2D,
} from "./transform2d.js";
import type { PositionedFill } from "./types.js";

export class ResolveError extends Error {}

function placementTransform(p: Placement): Similarity2D {
  const mirror = p.mirror ? mirrorXTransform() : identityTransform();
  const rotate = rotateTransform(p.rotationDeg);
  const translate = translateTransform(p.xMm, p.yMm);
  // Mirror first, then rotate, then translate — see transform2d.ts composition order.
  return compose(translate, compose(rotate, mirror));
}

/**
 * Stages 1+2 of the pipeline: resolve each placement's element generator
 * into real geometry (mm, element-local space), then rotate/translate
 * (and mirror, if the placement itself is flagged mirror) it into panel
 * space. Also expands `autoMirror` pairs by duplicating a source panel's
 * geometry onto its mirrored target panel.
 */
export function resolveAndTransform(spec: DesignSpec, body: BodyTemplate): PositionedFill[] {
  const direct: PositionedFill[] = [];

  for (const placement of spec.placements) {
    const element = requireElement(placement.element);
    let parsedParams: unknown;
    try {
      parsedParams = element.params.parse(placement.params);
    } catch (err) {
      throw new ResolveError(
        `Placement "${placement.id}" has invalid params for element "${placement.element}": ${(err as Error).message}`,
      );
    }

    const pathSet = element.generate(parsedParams);
    const t = placementTransform(placement);

    for (const fillD of pathSet.fills) {
      const subpaths = splitSubpaths(parsePath(fillD));
      for (const subpath of subpaths) {
        const positioned = transformPath(subpath, t);
        direct.push({
          placementId: placement.id,
          panelId: placement.panel,
          colourKey: placement.colour,
          elementId: placement.element,
          polygon: flattenSubpathToPolygon(positioned),
          sourceMinFeatureMm: pathSet.minFeatureMm,
        });
      }
    }
  }

  const mirrored: PositionedFill[] = [];
  for (const rule of spec.autoMirror) {
    const [srcPanelId, dstPanelId] = rule.split("→");
    if (!srcPanelId || !dstPanelId) {
      throw new ResolveError(`Malformed autoMirror rule "${rule}"`);
    }
    const srcPanel = getPanel(body, srcPanelId);
    if (!srcPanel || srcPanel.widthMm === undefined) {
      throw new ResolveError(`autoMirror rule "${rule}" references unknown/dimensionless panel "${srcPanelId}"`);
    }
    const mirrorAboutWidth = compose(translateTransform(srcPanel.widthMm, 0), mirrorXTransform());

    for (const fill of direct) {
      if (fill.panelId !== srcPanelId) continue;
      mirrored.push({
        placementId: `${fill.placementId}__mirror-${dstPanelId}`,
        panelId: dstPanelId,
        colourKey: fill.colourKey,
        elementId: fill.elementId,
        polygon: fill.polygon.map((p) => applyToPoint(mirrorAboutWidth, p)),
        sourceMinFeatureMm: fill.sourceMinFeatureMm,
      });
    }
  }

  return [...direct, ...mirrored];
}
