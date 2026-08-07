import type { BodyTemplate, DesignSpec } from "@livery-lab/schema";
import { getElement } from "@livery-lab/elements";
import { getPanel, resolvePanel } from "@livery-lab/bodies";
import { parsePath, splitSubpaths, transformPath, flattenSubpathToPolygon } from "./svg-path.js";
import { compose, identityTransform, mirrorXTransform, rotateTransform, translateTransform } from "./transform2d.js";
import { boundsOfPolygon, boundsUnion } from "./svg-path.js";
import { MIN_CUT_WIDTH_MM } from "./validate.js";

export interface SpecValidationIssue {
  rule: string;
  message: string;
}

export interface SpecValidationOptions {
  /**
   * §2.1: "only verified bodies are purchasable". Defaults to true. The
   * Phase 1 CLI / golden-file tests run against the seed Camaro fixture,
   * which is intentionally shipped as status="draft" (its panel outlines
   * are geometric approximations, not physical measurements — see the
   * `notes` field in content/bodies/protoform-1567-00.btf.json) — so
   * anything exercising the geometry engine itself against that fixture
   * must explicitly opt out of this business rule with
   * `requireVerifiedBody: false`. The storefront (Phase 4) should never do so.
   */
  requireVerifiedBody?: boolean;
}

const PANEL_MARGIN_MM = 3;

/**
 * The upfront DesignSpec checks from §2.3, rules 1/2/3/6/7 — the ones
 * that need a BodyTemplate and the element registry in scope (rules 4
 * and 5 are pure DesignSpec shape and are already enforced by
 * DesignSpecSchema in @livery-lab/schema). Cheap and fast on purpose:
 * this runs before the full geometry pipeline so the AI repair loop
 * (§8) isn't paying for clipper booleans on every retry. The
 * authoritative, precise version of rule 6's margin check (real panel
 * outline minus cutouts, not just a bounding box) is pipeline stage 5
 * (validate.ts) — every spec that passes here still goes through that.
 */
export function validateDesignSpec(
  spec: DesignSpec,
  body: BodyTemplate,
  opts: SpecValidationOptions = {},
): SpecValidationIssue[] {
  const requireVerified = opts.requireVerifiedBody ?? true;
  const issues: SpecValidationIssue[] = [];

  // Rule 1: bodyId exists and (optionally) is verified.
  if (spec.bodyId !== body.id) {
    issues.push({ rule: "bodyId", message: `DesignSpec.bodyId "${spec.bodyId}" does not match the supplied body "${body.id}"` });
  }
  if (requireVerified && body.status !== "verified") {
    issues.push({ rule: "bodyId", message: `Body "${body.id}" is not verified (status="${body.status}") and cannot be used for a purchasable design` });
  }

  for (const placement of spec.placements) {
    // Rule 2: panel exists.
    const panel = getPanel(body, placement.panel);
    if (!panel) {
      issues.push({ rule: "panel", message: `placements[${placement.id}] references unknown panel "${placement.panel}"` });
      continue;
    }

    // Rule 3: element exists and params validate.
    const element = getElement(placement.element);
    if (!element) {
      issues.push({ rule: "element", message: `placements[${placement.id}] references unknown element "${placement.element}"` });
      continue;
    }
    const parsed = element.params.safeParse(placement.params);
    if (!parsed.success) {
      issues.push({
        rule: "element-params",
        message: `placements[${placement.id}] (${placement.element}) has invalid params: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
      });
      continue;
    }

    let resolvedPanel;
    try {
      resolvedPanel = resolvePanel(body, placement.panel);
    } catch (err) {
      issues.push({ rule: "panel", message: `placements[${placement.id}]: ${(err as Error).message}` });
      continue;
    }

    // Rule 7: generated geometry's own minFeatureMm must clear the global
    // 1.2mm cut-safety floor. (element.minSizeMm is a per-element SIZE
    // PARAMETER gate — e.g. text-block's 12mm cap-height minimum — and is
    // already enforced by that element's own zod params schema before we
    // ever get here; it isn't the same thing as the generated geometry's
    // measured feature width, which is what actually determines
    // cuttability and is what this check is for.)
    let pathSet;
    try {
      pathSet = element.generate(parsed.data);
    } catch (err) {
      issues.push({ rule: "element-generate", message: `placements[${placement.id}] (${placement.element}) failed to generate: ${(err as Error).message}` });
      continue;
    }
    if (pathSet.minFeatureMm < MIN_CUT_WIDTH_MM) {
      issues.push({
        rule: "min-size",
        message: `placements[${placement.id}] (${placement.element}): reports minFeatureMm=${pathSet.minFeatureMm.toFixed(2)}mm, below the ${MIN_CUT_WIDTH_MM}mm cut-safety floor`,
      });
    }

    // Rule 6 (fast pre-check): bounding box, after rotation/mirror, stays
    // within the panel's own bounding rect inset by 3mm. The real check
    // (against outline minus cutouts) happens in the geometry pipeline.
    const mirror = placement.mirror ? mirrorXTransform() : identityTransform();
    const t = compose(translateTransform(placement.xMm, placement.yMm), compose(rotateTransform(placement.rotationDeg), mirror));
    const polygons = pathSet.fills.flatMap((d) => {
      const subpaths = splitSubpaths(parsePath(d));
      return subpaths.map((sp) => flattenSubpathToPolygon(transformPath(sp, t)));
    });
    if (polygons.length > 0) {
      const bounds = polygons.map(boundsOfPolygon).reduce(boundsUnion);
      const minX = PANEL_MARGIN_MM;
      const minY = PANEL_MARGIN_MM;
      const maxX = resolvedPanel.widthMm - PANEL_MARGIN_MM;
      const maxY = resolvedPanel.heightMm - PANEL_MARGIN_MM;
      if (bounds.minX < minX || bounds.minY < minY || bounds.maxX > maxX || bounds.maxY > maxY) {
        issues.push({
          rule: "panel-margin",
          message: `placements[${placement.id}] (${placement.element}) bounding box [${bounds.minX.toFixed(1)},${bounds.minY.toFixed(1)} .. ${bounds.maxX.toFixed(1)},${bounds.maxY.toFixed(1)}] doesn't clear a ${PANEL_MARGIN_MM}mm margin on panel "${placement.panel}" (${resolvedPanel.widthMm}x${resolvedPanel.heightMm}mm)`,
        });
      }
    }
  }

  return issues;
}
