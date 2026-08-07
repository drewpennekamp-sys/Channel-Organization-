import type { BodyTemplate, CurvatureLevel, Panel, PanelCutout } from "@livery-lab/schema";

export interface ResolvedPanel {
  id: string;
  widthMm: number;
  heightMm: number;
  outline: string;
  cutouts: PanelCutout[];
  curvature: CurvatureLevel;
  /** True if this panel's geometry is inherited from another panel via mirrorOf. */
  isMirror: boolean;
  /** Present when isMirror is true — the panel this one's geometry came from. */
  sourcePanelId?: string;
}

export function getPanel(body: BodyTemplate, panelId: string): Panel | undefined {
  return body.panels.find((p) => p.id === panelId);
}

export function listPanelIds(body: BodyTemplate): string[] {
  return body.panels.map((p) => p.id);
}

/**
 * Resolve a panel to its effective geometry, following `mirrorOf` one hop
 * (chained mirrors are rejected during semantic validation, so one hop is
 * always enough for a body that has passed `loadBodyTemplate`).
 *
 * This returns the SOURCE geometry unflipped — the caller (the geometry
 * engine, which owns path-transform math) is responsible for mirroring it
 * horizontally when `isMirror` is true.
 */
export function resolvePanel(body: BodyTemplate, panelId: string): ResolvedPanel {
  const panel = getPanel(body, panelId);
  if (!panel) {
    throw new Error(`Body "${body.id}" has no panel "${panelId}"`);
  }

  if (!panel.mirrorOf) {
    if (!panel.widthMm || !panel.heightMm || !panel.outline || !panel.curvature) {
      // Guarded by BodyTemplateSchema at load time; this is a defensive check
      // for callers that construct BodyTemplate objects by hand (e.g. tests).
      throw new Error(`Panel "${panelId}" is not a mirror but is missing geometry fields`);
    }
    return {
      id: panel.id,
      widthMm: panel.widthMm,
      heightMm: panel.heightMm,
      outline: panel.outline,
      cutouts: panel.cutouts ?? [],
      curvature: panel.curvature,
      isMirror: false,
    };
  }

  const source = getPanel(body, panel.mirrorOf);
  if (!source) {
    throw new Error(`Panel "${panelId}" mirrors unknown panel "${panel.mirrorOf}"`);
  }
  if (!source.widthMm || !source.heightMm || !source.outline || !source.curvature) {
    throw new Error(`Panel "${panelId}" mirrors "${source.id}", which is missing geometry fields`);
  }

  return {
    id: panel.id,
    widthMm: source.widthMm,
    heightMm: source.heightMm,
    outline: source.outline,
    cutouts: source.cutouts ?? [],
    curvature: source.curvature,
    isMirror: true,
    sourcePanelId: source.id,
  };
}
