export type SupportedImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export interface CardImage {
  base64: string;
  mediaType: SupportedImageMediaType;
}

/**
 * Four levels only, no numeric score — a percentage is false precision
 * here and gets learned to ignore. See README's "Card scanner" section for
 * what each one means and how the UI treats it.
 */
export type ScanConfidence = 'exact' | 'high' | 'low' | 'unresolved';

export type ScanMethod = 'cert' | 'catalog-exact' | 'catalog-year-offset' | 'catalog-prefix' | 'unresolved';

/**
 * The scanner's final output — always what gets rendered on the confirm
 * form, never written to the database directly (see app/api/cards/route.ts,
 * the only write path). Every field the form doesn't have a confident
 * value for is null, not a guess.
 */
export interface ScanResult {
  confidence: ScanConfidence;
  method: ScanMethod;

  year: number | null;
  brand: string | null;
  set: string | null;
  subset: string | null;
  player: string | null;
  cardNumber: string | null;
  parallel: string | null;
  parallelCandidates: string[];
  serialNumbering: string | null;
  isAuto: boolean | null;
  isRelic: boolean | null;
  sport: string | null;
  grade: string | null;
  certNumber: string | null;

  /** Which resolved CatalogCard this came from, if any — used to grow it further on confirm. */
  catalogCardId: string | null;

  /**
   * Raw OCR facts from Pass 1 that didn't make it into a resolved field —
   * populated on the "unresolved" path so the confirm form has something
   * to prefill besides a blank sheet, without pretending they're a
   * resolved product year/brand/set (a printed copyright year is not the
   * same thing as a season/product year — see prompts/backRead.txt).
   */
  rawCopyrightYear: number | null;
  rawBrandLine: string | null;
  rawSetName: string | null;
}
