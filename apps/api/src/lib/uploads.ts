import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']);
const MAX_BYTES = 5 * 1024 * 1024;

export function ensureUploadDir(subfolder: string): string {
  const dir = path.join(UPLOAD_ROOT, subfolder);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveBase64Image(base64: string, mimeType: string, subfolder = 'images'): string {
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error('Unsupported image type. Use JPEG, PNG, WebP, GIF, SVG, or ICO.');
  }

  const data = base64.includes(',') ? base64.split(',')[1] : base64;
  const buffer = Buffer.from(data, 'base64');
  if (buffer.length > MAX_BYTES) {
    throw new Error('File too large (max 5MB)');
  }

  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
  };
  const ext = extMap[mimeType] || 'png';
  const filename = `${crypto.randomUUID()}.${ext}`;
  const dir = ensureUploadDir(subfolder);
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/api/v1/uploads/${subfolder}/${filename}`;
}

export function getUploadRoot(): string {
  return UPLOAD_ROOT;
}
