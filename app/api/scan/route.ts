import { NextResponse } from 'next/server';
import { scanCard } from '@/lib/scanner/scanCard';
import type { SupportedImageMediaType } from '@/lib/scanner/types';
import { fileToBase64, isSupportedImageMediaType, saveUploadedImage } from '@/lib/uploads';

/**
 * Runs the scanner pipeline (Pass 0-3, see lib/scanner/scanCard.ts) and
 * returns its result. Never writes to the database — the card is only
 * saved once the user confirms/corrects the result via POST /api/cards.
 * Both photos are required: the pipeline's whole design (read the back's
 * printed identifiers, resolve against the catalog, read the parallel off
 * the front) depends on having both, so a front-only or back-only scan
 * isn't supported.
 */
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  const formData = await request.formData();
  const frontFile = formData.get('front');
  const backFile = formData.get('back');

  if (!(frontFile instanceof File) || frontFile.size === 0) {
    return NextResponse.json({ ok: false, error: 'A front photo is required.' }, { status: 400 });
  }
  if (!(backFile instanceof File) || backFile.size === 0) {
    return NextResponse.json(
      { ok: false, error: 'A back photo is required — the scanner reads the card number and other identifiers off the back.' },
      { status: 400 },
    );
  }

  const frontMediaType = frontFile.type;
  if (!isSupportedImageMediaType(frontMediaType)) {
    return NextResponse.json(
      { ok: false, error: `Unsupported front image type: ${frontMediaType || 'unknown'}` },
      { status: 400 },
    );
  }
  const backMediaType: string = backFile.type;
  if (!isSupportedImageMediaType(backMediaType)) {
    return NextResponse.json(
      { ok: false, error: `Unsupported back image type: ${backMediaType || 'unknown'}` },
      { status: 400 },
    );
  }

  // Save the photos first so the client still has usable paths even if
  // the pipeline below fails — a failed scan shouldn't lose the photos.
  let frontImagePath: string;
  let backImagePath: string;
  try {
    frontImagePath = await saveUploadedImage(frontFile);
    backImagePath = await saveUploadedImage(backFile);
  } catch (err: unknown) {
    console.error('[api/scan] Failed to save uploaded image(s):', err);
    const message = err instanceof Error ? err.message : 'Failed to save the uploaded photo(s).';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const frontBase64 = await fileToBase64(frontFile);
  const backBase64 = await fileToBase64(backFile);

  try {
    const result = await scanCard(
      { base64: frontBase64, mediaType: frontMediaType as SupportedImageMediaType },
      { base64: backBase64, mediaType: backMediaType as SupportedImageMediaType },
    );
    return NextResponse.json({ ok: true, result, frontImagePath, backImagePath });
  } catch (err: unknown) {
    console.error('[api/scan] Scanner pipeline failed:', err);
    const message = err instanceof Error ? err.message : 'Scan failed.';
    return NextResponse.json({ ok: false, error: message, frontImagePath, backImagePath }, { status: 200 });
  }
}
