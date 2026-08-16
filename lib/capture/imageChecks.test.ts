import { describe, expect, it } from 'vitest';
import { laplacianVariance, glareFraction, estimateCardCoverage, BLUR_VARIANCE_MIN, GLARE_FRACTION_MAX, COVERAGE_MIN } from './imageChecks';

/**
 * These test the pixel-math heuristics directly, on synthetic Float32Array
 * data — not the full processCapture() pipeline, which needs a real
 * browser canvas/Image and isn't available in this Node test environment.
 * That's the honest boundary: this validates "does the blur/glare/coverage
 * math actually distinguish good from bad," which is what would decide
 * fixture 8 (a deliberately blurry photo must be rejected, not misread) —
 * it doesn't exercise the DOM plumbing around it.
 */

function flatImage(width: number, height: number, value: number): Float32Array {
  return new Float32Array(width * height).fill(value);
}

function checkerboardImage(width: number, height: number, cell = 4): Float32Array {
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const on = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      out[y * width + x] = on ? 240 : 20;
    }
  }
  return out;
}

/** A sharp square of "card" texture in the middle of a flat background. */
function busySquareImage(width: number, height: number, boxFrac: number): Float32Array {
  const out = flatImage(width, height, 30);
  const boxW = Math.round(width * boxFrac);
  const boxH = Math.round(height * boxFrac);
  const x0 = Math.floor((width - boxW) / 2);
  const y0 = Math.floor((height - boxH) / 2);
  for (let y = y0; y < y0 + boxH; y++) {
    for (let x = x0; x < x0 + boxW; x++) {
      out[y * width + x] = (x + y) % 2 === 0 ? 220 : 40; // high-contrast texture
    }
  }
  return out;
}

describe('laplacianVariance (blur detection)', () => {
  it('reads near zero on a flat/featureless image — the blurry case', () => {
    const gray = flatImage(60, 60, 128);
    expect(laplacianVariance(gray, 60, 60)).toBeLessThan(BLUR_VARIANCE_MIN);
  });

  it('reads well above the threshold on a sharp high-contrast pattern', () => {
    const gray = checkerboardImage(60, 60);
    expect(laplacianVariance(gray, 60, 60)).toBeGreaterThan(BLUR_VARIANCE_MIN);
  });

  it('a deliberately blurry fixture (flat) is correctly rejected by the threshold', () => {
    // Fixture 8 from the M4 spec: a blurry image must be rejected at
    // capture, not passed through to be misread downstream.
    const blurry = flatImage(60, 60, 200);
    const sharp = checkerboardImage(60, 60);
    expect(laplacianVariance(blurry, 60, 60)).toBeLessThan(BLUR_VARIANCE_MIN);
    expect(laplacianVariance(sharp, 60, 60)).toBeGreaterThan(BLUR_VARIANCE_MIN);
  });
});

describe('glareFraction', () => {
  it('is 0 on a mid-gray image with no blown-out pixels', () => {
    const gray = flatImage(40, 40, 128);
    expect(glareFraction(gray)).toBe(0);
  });

  it('is 1 on an all-white (fully blown-out) image', () => {
    const gray = flatImage(40, 40, 255);
    expect(glareFraction(gray)).toBe(1);
  });

  it('flags an image over the glare threshold', () => {
    const width = 40;
    const height = 40;
    const gray = flatImage(width, height, 100);
    // Blow out 20% of the pixels — above GLARE_FRACTION_MAX (0.12).
    const glarePixels = Math.floor(width * height * 0.2);
    for (let i = 0; i < glarePixels; i++) gray[i] = 255;
    expect(glareFraction(gray)).toBeGreaterThan(GLARE_FRACTION_MAX);
  });
});

describe('estimateCardCoverage', () => {
  it('reads low coverage when the busy region is small relative to the frame', () => {
    const gray = busySquareImage(120, 120, 0.3);
    expect(estimateCardCoverage(gray, 120, 120)).toBeLessThan(COVERAGE_MIN);
  });

  it('reads high coverage when the busy region fills most of the frame', () => {
    const gray = busySquareImage(120, 120, 0.9);
    expect(estimateCardCoverage(gray, 120, 120)).toBeGreaterThan(COVERAGE_MIN);
  });

  it('reads 0 when there is no busy region at all (blank frame)', () => {
    const gray = flatImage(80, 80, 100);
    expect(estimateCardCoverage(gray, 80, 80)).toBe(0);
  });
});
