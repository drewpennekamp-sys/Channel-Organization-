import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { put } from '@vercel/blob';
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
 * Saves an uploaded photo and returns the URL the browser can load it from.
 *
 * Two backends, chosen automatically:
 *  - Vercel Blob, when BLOB_READ_WRITE_TOKEN is set (i.e. deployed on
 *    Vercel with Blob storage attached). Required there — the filesystem
 *    on serverless functions is ephemeral/read-only, so a local write
 *    would silently vanish or fail.
 *  - Local filesystem under public/uploads (gitignored), for local dev
 *    where no Blob token is configured.
 */
export async function saveUploadedImage(file: File): Promise<string> {
  const extension = EXTENSION_BY_MIME_TYPE[file.type] ?? '.jpg';
  const filename = `${randomUUID()}${extension}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(filename, file, { access: 'public', addRandomSuffix: false });
    return blob.url;
  }

  if (process.env.VERCEL) {
    // Vercel's serverless functions have a read-only filesystem (aside
    // from /tmp, which doesn't persist across requests) — falling through
    // to the local-disk write below would fail anyway, with a far less
    // useful error than this one. Fail fast with the actual fix.
    throw new Error(
      'Photo storage isn’t connected yet. In the Vercel project: Storage → Create → Blob → connect it to this project, then redeploy.',
    );
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

export async function fileToBase64(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString('base64');
}
