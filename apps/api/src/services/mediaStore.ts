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

const siteDir = (siteId: string) => path.join(mediaRoot, siteId);
const recordPath = (siteId: string, id: string) => path.join(siteDir(siteId), `${id}.json`);
const payloadPath = (siteId: string, id: string, ext: string) => path.join(siteDir(siteId), `${id}.${ext}`);

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
    const ext = (input.filename.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
    storedPath = payloadPath(input.siteId, id, ext);
    await writeFile(storedPath, buffer);
  } else {
    storedPath = input.sourceUrl || '';
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
  await mkdir(siteDir(siteId), { recursive: true });
  const files = await readdir(siteDir(siteId));
  const records: StoredMedia[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const raw = await readFile(path.join(siteDir(siteId), file), 'utf8');
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
    if (record.path && record.path.startsWith('/')) {
      const fileInfo = await stat(record.path).catch(() => null);
      if (fileInfo) {
        await rm(record.path, { force: true });
      }
    }
    return true;
  } catch {
    return false;
  }
};

