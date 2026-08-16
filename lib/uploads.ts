import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SupportedImageMediaType } from '@/lib/vision/identifyCard';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
};

const SUPPORTED_MEDIA_TYPES = new Set(Object.keys(EXTENSION_BY_MIME_TYPE));

export function isSupportedImageMediaType(mime: string): mime is SupportedImageMediaType {
  return SUPPORTED_MEDIA_TYPES.has(mime);
}

/**
 * Saves an uploaded photo under public/uploads (gitignored — local dev
 * storage only) and returns the path the browser can load it from
 * directly (Next.js serves everything under public/ at the site root).
 */
export async function saveUploadedImage(file: File): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });

  const extension = EXTENSION_BY_MIME_TYPE[file.type] ?? '.jpg';
  const filename = `${randomUUID()}${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return `/uploads/${filename}`;
}

export async function fileToBase64(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString('base64');
}
