import type { BodyTemplate } from "@livery-lab/schema";

export interface BodyValidationIssue {
  path: string;
  message: string;
}

export function formatBodyValidationIssues(issues: BodyValidationIssue[]): string {
  return issues.map((i) => `  - ${i.path}: ${i.message}`).join("\n");
}

/**
 * Cross-reference checks that zod's per-field schema can't express on its
 * own: do mirrorOf targets exist, do view panelMaps point at real panels,
 * are ids unique. Structural shape is already guaranteed by
 * BodyTemplateSchema by the time this runs.
 */
export function validateBodyTemplateSemantics(body: BodyTemplate): BodyValidationIssue[] {
  const issues: BodyValidationIssue[] = [];
  const panelIds = new Set<string>();

  for (const panel of body.panels) {
    if (panelIds.has(panel.id)) {
      issues.push({ path: `panels[${panel.id}]`, message: "duplicate panel id" });
    }
    panelIds.add(panel.id);
  }

  for (const panel of body.panels) {
    if (!panel.mirrorOf) continue;
    const source = body.panels.find((p) => p.id === panel.mirrorOf);
    if (!source) {
      issues.push({
        path: `panels[${panel.id}].mirrorOf`,
        message: `mirrors unknown panel "${panel.mirrorOf}"`,
      });
      continue;
    }
    if (source.mirrorOf) {
      issues.push({
        path: `panels[${panel.id}].mirrorOf`,
        message: `mirrors "${panel.mirrorOf}", which is itself a mirror — chained mirrors are not allowed`,
      });
    }
  }

  for (const panel of body.panels) {
    const cutoutIds = new Set<string>();
    for (const cutout of panel.cutouts ?? []) {
      if (cutoutIds.has(cutout.id)) {
        issues.push({
          path: `panels[${panel.id}].cutouts[${cutout.id}]`,
          message: "duplicate cutout id within panel",
        });
      }
      cutoutIds.add(cutout.id);
    }
  }

  for (const view of body.views) {
    for (const entry of view.panelMap) {
      if (!panelIds.has(entry.panel)) {
        issues.push({
          path: `views[${view.id}].panelMap`,
          message: `references unknown panel "${entry.panel}"`,
        });
      }
    }
  }

  return issues;
}
