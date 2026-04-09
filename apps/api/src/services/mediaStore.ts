import { mkdir, readdir, readFile, rm, stat, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export type StoredMedia = {
  id: string;
  siteId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  path: string;
  sourceUrl?: string;
};

const mediaRoot = process.env.MEDIA_ROOT || '/tmp/ecom-media';
const mediaRootResolved = path.resolve(mediaRoot);
const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'mp4', 'webm', 'pdf', 'txt', 'bin']);

const sanitizeSegment = (value: string) => value.replace(/[^a-zA-Z0-9-_]/g, '');
const isSafeUrl = (value: string) => /^https?:\/\//i.test(value);
const getAllowedExtension = (filename: string) => {
  const extRaw = (filename.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
  return allowedExtensions.has(extRaw) ? extRaw : 'bin';
};

const ensureSafePath = (targetPath: string) => {
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(`${mediaRootResolved}${path.sep}`)) {
    throw new Error('Unsafe media path');
  }
  return resolved;
};

const siteDir = (siteId: string) => ensureSafePath(path.join(mediaRootResolved, sanitizeSegment(siteId)));
const recordPath = (siteId: string, id: string) => ensureSafePath(path.join(siteDir(siteId), `${sanitizeSegment(id)}.json`));
const payloadPath = (siteId: string, id: string, ext: string) =>
  ensureSafePath(path.join(siteDir(siteId), `${sanitizeSegment(id)}.${sanitizeSegment(ext)}`));

export const saveUploadedMedia = async (input: {
  siteId: string;
  filename: string;
  mimeType: string;
  contentBase64?: string;
  sourceUrl?: string;
}) => {
  const id = randomUUID();
  const now = new Date().toISOString();
  await mkdir(siteDir(input.siteId), { recursive: true });

  let sizeBytes = 0;
  let storedPath = '';
  if (input.contentBase64) {
    const buffer = Buffer.from(input.contentBase64, 'base64');
    sizeBytes = buffer.length;
    const ext = getAllowedExtension(input.filename);
    storedPath = payloadPath(input.siteId, id, ext);
    await writeFile(storedPath, buffer);
  } else {
    storedPath = input.sourceUrl && isSafeUrl(input.sourceUrl) ? input.sourceUrl : '';
  }

  const record: StoredMedia = {
    id,
    siteId: input.siteId,
    filename: input.filename,
    mimeType: input.mimeType,
    sizeBytes,
    createdAt: now,
    path: storedPath,
    sourceUrl: input.sourceUrl
  };
  await writeFile(recordPath(input.siteId, id), JSON.stringify(record, null, 2), 'utf8');
  return record;
};

export const listMedia = async (siteId: string): Promise<StoredMedia[]> => {
  const dir = siteDir(siteId);
  await mkdir(dir, { recursive: true });
  const files = await readdir(dir);
  const records: StoredMedia[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    if (file.includes('/') || file.includes('\\')) continue;
    const raw = await readFile(ensureSafePath(path.join(dir, file)), 'utf8');
    records.push(JSON.parse(raw) as StoredMedia);
  }
  return records.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

export const deleteMedia = async (siteId: string, id: string): Promise<boolean> => {
  const metaFile = recordPath(siteId, id);
  try {
    const raw = await readFile(metaFile, 'utf8');
    const record = JSON.parse(raw) as StoredMedia;
    await rm(metaFile, { force: true });
    const safeMediaPath = record.path ? ensureSafePath(record.path) : '';
    if (safeMediaPath) {
      const fileInfo = await stat(safeMediaPath).catch(() => null);
      if (fileInfo) {
        await rm(safeMediaPath, { force: true });
      }
    }
    return true;
  } catch {
    return false;
  }
};
