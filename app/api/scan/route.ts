import { NextResponse } from 'next/server';
import { identifyCard, type SupportedImageMediaType } from '@/lib/vision/identifyCard';
import { fileToBase64, isSupportedImageMediaType, saveUploadedImage } from '@/lib/uploads';

/**
 * Accepts a front photo (required) and an optional back photo, runs Claude
 * vision, and returns structured attributes. Never writes to the database
 * — the card is only saved once the user confirms/corrects the result via
 * POST /api/cards. Uploaded photos are saved to disk regardless of whether
 * identification succeeds, so a failed scan still lets the user save the
 * photos alongside a manually-filled-in form.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const formData = await request.formData();
  const frontFile = formData.get('front');
  const backFile = formData.get('back');

  if (!(frontFile instanceof File) || frontFile.size === 0) {
    return NextResponse.json({ ok: false, error: 'A front photo is required.' }, { status: 400 });
  }

  const frontMediaType = frontFile.type;
  if (!isSupportedImageMediaType(frontMediaType)) {
    return NextResponse.json(
      { ok: false, error: `Unsupported front image type: ${frontMediaType || 'unknown'}` },
      { status: 400 },
    );
  }

  let backImage: File | null = null;
  let backMediaType: SupportedImageMediaType | undefined;
  if (backFile instanceof File && backFile.size > 0) {
    const candidateMediaType = backFile.type;
    if (!isSupportedImageMediaType(candidateMediaType)) {
      return NextResponse.json(
        { ok: false, error: `Unsupported back image type: ${candidateMediaType || 'unknown'}` },
        { status: 400 },
      );
    }
    backImage = backFile;
    backMediaType = candidateMediaType;
  }

  // Save the photo(s) first so the client still has a usable path even if
  // identification below fails — a failed scan shouldn't lose the photos.
  let frontImagePath: string;
  let backImagePath: string | null = null;
  try {
    frontImagePath = await saveUploadedImage(frontFile);
    if (backImage) {
      backImagePath = await saveUploadedImage(backImage);
    }
  } catch (err: unknown) {
    console.error('[api/scan] Failed to save uploaded image(s):', err);
    return NextResponse.json({ ok: false, error: 'Failed to save the uploaded photo(s).' }, { status: 500 });
  }

  const frontBase64 = await fileToBase64(frontFile);
  const backBase64 = backImage ? await fileToBase64(backImage) : undefined;

  const attributes = await identifyCard(
    { base64: frontBase64, mediaType: frontMediaType },
    backBase64 && backMediaType ? { base64: backBase64, mediaType: backMediaType } : undefined,
  );

  if (!attributes) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Could not read the card from that photo. Enter the details manually below.',
        frontImagePath,
        backImagePath,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, attributes, frontImagePath, backImagePath });
}
