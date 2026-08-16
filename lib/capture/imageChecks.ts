'use client';

/**
 * Client-side capture gate — runs entirely in the browser on canvas pixel
 * data, before a photo ever reaches the network. "Quality in, quality
 * out": rejecting a bad photo here is a re-tap, not a wasted scan.
 *
 * Two of these checks are honest heuristics, not real computer vision, and
 * that limitation is worth stating plainly rather than implying more than
 * they deliver:
 *  - `estimateCardCoverage` assumes the card sits on a reasonably plain
 *    background and finds it by edge density, not real segmentation. A
 *    busy background (patterned tablecloth, clutter) can throw it off.
 *  - `estimateSkewAngleDeg` finds the dominant gradient direction mod 90°
 *    rather than fitting the card's actual edges (no Hough transform
 *    here) — good enough to catch "obviously crooked," not a precise fit.
 * Both are deliberately conservative: on a borderline read they lean
 * toward passing the photo through rather than blocking a real capture on
 * an approximation's blind spot.
 */

export interface CaptureCheckResult {
  ok: boolean;
  reasons: string[];
  /** Downscaled, rotated, deskewed — ready to upload. Present even when ok is false, for re-preview. */
  processedBlob: Blob;
  /** Diagnostics for the confirm-screen preview, not the pass/fail decision itself. */
  diagnostics: { blurVariance: number; glareFraction: number; coverage: number; skewDeg: number };
}

const MAX_LONG_EDGE = 1600;
const ANALYSIS_MAX_EDGE = 500; // downsample before pixel analysis — plenty for these heuristics, much faster
export const BLUR_VARIANCE_MIN = 60; // Laplacian variance below this, on a 0-255 grayscale, reads as soft/out-of-focus
export const GLARE_FRACTION_MAX = 0.12; // more than this share of near-white pixels reads as blown-out glare
export const COVERAGE_MIN = 0.6; // card must fill at least this fraction of the frame
const SKEW_CORRECT_THRESHOLD_DEG = 5;

async function loadBitmap(file: File): Promise<ImageBitmap> {
  // imageOrientation: 'from-image' applies EXIF rotation so the pixels we
  // analyze and rotate below match what a viewer actually sees.
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

function drawToCanvas(bitmap: ImageBitmap | HTMLCanvasElement, maxEdge?: number): HTMLCanvasElement {
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const scale = maxEdge ? Math.min(1, maxEdge / Math.max(srcW, srcH)) : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(srcW * scale));
  canvas.height = Math.max(1, Math.round(srcH * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function rotateCanvas(canvas: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const radians = (degrees * Math.PI) / 180;
  const w = canvas.width;
  const h = canvas.height;
  // Bounding box of the rotated rectangle, so nothing gets clipped.
  const newW = Math.round(Math.abs(w * Math.cos(radians)) + Math.abs(h * Math.sin(radians)));
  const newH = Math.round(Math.abs(w * Math.sin(radians)) + Math.abs(h * Math.cos(radians)));
  const out = document.createElement('canvas');
  out.width = newW;
  out.height = newH;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(radians);
  ctx.drawImage(canvas, -w / 2, -h / 2);
  return out;
}

function toGrayscale(canvas: HTMLCanvasElement): { data: Float32Array; width: number; height: number } {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // Rec. 601 luma.
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return { data: gray, width, height };
}

/** Variance of the Laplacian response — low variance means few sharp edges, i.e. a soft/blurry image. */
export function laplacianVariance(gray: Float32Array, width: number, height: number): number {
  const responses: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const lap =
        -4 * gray[idx] + gray[idx - 1] + gray[idx + 1] + gray[idx - width] + gray[idx + width];
      responses.push(lap);
    }
  }
  const mean = responses.reduce((a, b) => a + b, 0) / responses.length;
  const variance = responses.reduce((a, b) => a + (b - mean) ** 2, 0) / responses.length;
  return variance;
}

/** Fraction of pixels at or above near-white luminance — a proxy for blown-out glare, esp. on chrome/foil cards. */
export function glareFraction(gray: Float32Array): number {
  let bright = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] >= 248) bright++;
  }
  return bright / gray.length;
}

/**
 * Sobel gradient magnitude, thresholded, to approximate "where's the
 * busy/textured object versus the plain background" — see the module
 * doc comment for what this heuristic does and doesn't do.
 */
function sobelMagnitude(gray: Float32Array, width: number, height: number): Float32Array {
  const mag = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx =
        -gray[i - width - 1] + gray[i - width + 1] - 2 * gray[i - 1] + 2 * gray[i + 1] - gray[i + width - 1] + gray[i + width + 1];
      const gy =
        -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] + gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
      mag[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return mag;
}

/** Bounding-box coverage of the "busy" region, as a fraction of total frame area. See module doc comment. */
export function estimateCardCoverage(gray: Float32Array, width: number, height: number): number {
  const mag = sobelMagnitude(gray, width, height);
  const threshold = 40;
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let found = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mag[y * width + x] > threshold) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return 0;
  const boxArea = (maxX - minX) * (maxY - minY);
  return boxArea / (width * height);
}

/** Dominant edge angle mod 90°, signed offset from the nearest cardinal direction. See module doc comment. */
function estimateSkewAngleDeg(gray: Float32Array, width: number, height: number): number {
  const bins = new Array(180).fill(0) as number[];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx = gray[i + 1] - gray[i - 1];
      const gy = gray[i + width] - gray[i - width];
      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag < 25) continue; // ignore near-flat regions, keep only real edges
      let angle = (Math.atan2(gy, gx) * 180) / Math.PI; // -180..180
      angle = ((angle % 90) + 90) % 90; // fold into 0..90 — cardinal-direction-relative
      bins[Math.round(angle * 2)] += mag; // 0.5° resolution, weighted by edge strength
    }
  }
  let bestBin = 0;
  for (let i = 1; i < bins.length; i++) {
    if (bins[i] > bins[bestBin]) bestBin = i;
  }
  const dominantAngle = bestBin / 2; // 0..90
  // Signed offset from the nearer of 0°/90°.
  return dominantAngle <= 45 ? dominantAngle : dominantAngle - 90;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas failed to produce a blob.'))),
      'image/jpeg',
      quality,
    );
  });
}

export async function processCapture(file: File, { checkGlare = false }: { checkGlare?: boolean } = {}): Promise<CaptureCheckResult> {
  const bitmap = await loadBitmap(file);

  // Auto-rotate to portrait — a card photographed sideways is the most
  // common orientation mistake and the cheapest to just fix outright.
  let working = drawToCanvas(bitmap);
  if (working.width > working.height) {
    working = rotateCanvas(working, 90);
  }

  // Deskew: measure on a small analysis copy (fast), then apply the
  // correction to the full working canvas.
  {
    const analysisCanvas = drawToCanvas(working, ANALYSIS_MAX_EDGE);
    const { data: analysisGray, width: aw, height: ah } = toGrayscale(analysisCanvas);
    const skewDeg = estimateSkewAngleDeg(analysisGray, aw, ah);
    if (Math.abs(skewDeg) > SKEW_CORRECT_THRESHOLD_DEG) {
      working = rotateCanvas(working, -skewDeg);
    }
  }

  // Final analysis pass, on the corrected image.
  const analysisCanvas = drawToCanvas(working, ANALYSIS_MAX_EDGE);
  const { data: gray, width: aw, height: ah } = toGrayscale(analysisCanvas);
  const blurVariance = laplacianVariance(gray, aw, ah);
  const glare = glareFraction(gray);
  const coverage = estimateCardCoverage(gray, aw, ah);
  const skewDeg = estimateSkewAngleDeg(gray, aw, ah);

  const reasons: string[] = [];
  if (blurVariance < BLUR_VARIANCE_MIN) {
    reasons.push('This photo looks blurry — hold steady and let the camera focus before capturing.');
  }
  if (checkGlare && glare > GLARE_FRACTION_MAX) {
    reasons.push('Glare is washing out part of the card — tilt it or move away from direct light.');
  }
  if (coverage < COVERAGE_MIN) {
    reasons.push('The card is too small in the frame — fill more of the guide rectangle.');
  }

  const output = drawToCanvas(working, MAX_LONG_EDGE);
  const processedBlob = await canvasToBlob(output);

  return {
    ok: reasons.length === 0,
    reasons,
    processedBlob,
    diagnostics: { blurVariance, glareFraction: glare, coverage, skewDeg },
  };
}
