/**
 * Runtime checklist from §3.5 — every item here is also asserted by a
 * golden-file/unit test, but this lets the pipeline itself refuse to ship
 * a file that would choke Design Space instead of finding out at cut time.
 */
export function findCricutSafeViolations(svg: string): string[] {
  const violations: string[] = [];

  if (/<text[\s>]/i.test(svg)) violations.push("contains <text>");
  if (/<tspan[\s>]/i.test(svg)) violations.push("contains <tspan>");
  if (/<image[\s>]/i.test(svg)) violations.push("contains <image>");
  if (/<use[\s>]/i.test(svg)) violations.push("contains <use>");
  if (/<clipPath[\s>]/i.test(svg)) violations.push("contains <clipPath>");
  if (/<mask[\s>]/i.test(svg)) violations.push("contains <mask>");
  if (/<filter[\s>]/i.test(svg)) violations.push("contains <filter>");
  if (/<style[\s>]/i.test(svg)) violations.push("contains <style>");
  if (/\btransform\s*=/.test(svg)) violations.push("contains a transform= attribute");
  if (/\bstroke(?!-)\s*=\s*"(?!none)/i.test(svg)) violations.push("contains a stroke attribute");
  if (/\bstroke-width\s*=/.test(svg)) violations.push("contains stroke-width");
  if (/\bclass\s*=/.test(svg)) violations.push("contains a class= attribute (CSS classes not allowed)");
  if (/width\s*=\s*"\d+%"/.test(svg) || /height\s*=\s*"\d+%"/.test(svg)) {
    violations.push("uses percentage-based document dimensions");
  }
  if (!/width\s*=\s*"[\d.]+mm"/.test(svg)) violations.push("document width is not expressed in mm");
  if (!/height\s*=\s*"[\d.]+mm"/.test(svg)) violations.push("document height is not expressed in mm");

  // Every <path> must carry fill-rule="evenodd" explicitly.
  const pathTags = svg.match(/<path\b[^>]*>/g) ?? [];
  for (const tag of pathTags) {
    if (!/fill-rule\s*=\s*"evenodd"/.test(tag)) {
      violations.push(`a <path> is missing fill-rule="evenodd": ${tag.slice(0, 80)}`);
      break;
    }
  }

  // Path data must use only absolute M/L/C/Q/A/Z commands (no lowercase relative commands).
  const dAttrs = [...svg.matchAll(/\sd="([^"]*)"/g)].map((m) => m[1]!);
  for (const d of dAttrs) {
    if (/[a-z]/.test(d.replace(/e-?\d/g, ""))) {
      // strip scientific-notation "e-5" fragments before checking for stray lowercase letters
      violations.push(`path data contains a lowercase (relative) command: ${d.slice(0, 60)}`);
      break;
    }
  }

  return [...new Set(violations)];
}

export function assertCricutSafe(svg: string, label: string): void {
  const violations = findCricutSafeViolations(svg);
  if (violations.length > 0) {
    throw new Error(`"${label}" is not Cricut-safe:\n${violations.map((v) => `  - ${v}`).join("\n")}`);
  }
}
