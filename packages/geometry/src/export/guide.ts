import type { DesignSpec } from "@livery-lab/schema";

export interface SprayGuideOptions {
  bodyName: string;
  /** Mask filenames actually generated for each palette colour key (empty/omitted if that colour has no cut geometry). */
  maskFilesByColour?: Record<string, string[]>;
}

/**
 * Stage 10c: the numbered paint-order guide. This is the single most
 * important document in the whole product — §15 flags it explicitly:
 * "Paint order is counterintuitive... get this wrong and every customer
 * ruins a body." The rule implemented here: paintOrder[0] is sprayed
 * FIRST and ends up the most-visible colour (inside-Lexan painting is
 * back-to-front relative to what you'd expect). Every mask applied for a
 * detail colour STAYS ON while every subsequent detail colour is sprayed
 * — nothing is removed until the very last detail colour is done, at
 * which point ALL masks come off before the unmasked backing coat
 * (paintOrder's LAST entry) goes on over everything.
 */
export function generateSprayGuide(spec: DesignSpec, opts: SprayGuideOptions): string {
  const maskFiles = opts.maskFilesByColour ?? {};
  const lines: string[] = [];

  lines.push(`# Paint order — ${spec.name} (${opts.bodyName})`);
  lines.push("");
  lines.push(
    "Sprayed on the INSIDE of the clear body. Paint order below is sprayed in this exact sequence — " +
      "index 0 goes on first and ends up the colour you SEE from outside once the body is mounted.",
  );
  if (spec.rationale) {
    lines.push("");
    lines.push(`_${spec.rationale}_`);
  }
  lines.push("");

  let step = 1;
  lines.push(`Step ${step++} — Prep: wash the inside with dish soap, dry fully, tack cloth. Do not touch the painting surface after this.`);

  if (spec.paintOrder.length === 0) {
    throw new Error("generateSprayGuide: paintOrder is empty");
  }

  const detailKeys = spec.paintOrder.slice(0, -1);
  const baseKey = spec.paintOrder[spec.paintOrder.length - 1]!;

  for (const key of detailKeys) {
    const colour = spec.palette[key];
    if (!colour) throw new Error(`generateSprayGuide: paintOrder references unknown palette key "${key}"`);
    const files = maskFiles[key] ?? [];
    const fileNote = files.length > 0 ? files.join(", ") : "no mask needed — this colour isn't used in this design";
    lines.push(
      `Step ${step++} — Apply layer ${colour.name.toUpperCase()} (${fileNote}). Align the registration crosses to the panel edge${
        files.length > 0 ? " — do NOT remove any previously applied mask" : ""
      }.`,
    );
    if (files.length > 0) {
      lines.push(`Step ${step++} — Spray ${colour.paintCode ?? colour.name}. 3 light coats, ~10 minutes between coats.`);
    }
  }

  if (detailKeys.length > 0) {
    const names = detailKeys.map((k) => spec.palette[k]!.name).join(", ");
    lines.push(`Step ${step++} — Remove ALL masks (${names}). Every mask applied above stays on until this single step — this is the only time you remove anything before the backing coat.`);
  }

  const base = spec.palette[baseKey];
  if (!base) throw new Error(`generateSprayGuide: paintOrder references unknown palette key "${baseKey}"`);
  lines.push(`Final — Backing coat: spray ${base.paintCode ?? base.name} over the entire inside, no mask. This seals and backs every colour sprayed above.`);

  return lines.join("\n") + "\n";
}
