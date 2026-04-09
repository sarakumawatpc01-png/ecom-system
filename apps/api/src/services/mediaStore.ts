import { randomUUID } from 'crypto';
import path from 'path';
import { buildMediaUrl, getObjectBuffer, listObjects, putObjectBuffer, removeObject } from './objectStorage';
import { processImageToWebP } from './imageProcessor';

export type StoredMedia = {
  id: string;
  siteId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  path: string;
  sourceUrl?: string;
  objectName: string;
};

const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'mp4', 'webm', 'pdf']);
const allowedMimePrefixes = ['image/', 'video/'];
const allowedMimeExact = new Set(['application/pdf']);
const MAX_MEDIA_BYTES = Number(process.env.MAX_MEDIA_BYTES || 15 * 1024 * 1024);
const sanitizeSegment = (value: string) => {
  if (value.includes('..')) throw new Error('Unsafe path segment');
  const stripped = value.replace(/[^a-zA-Z0-9-_]/g, '');
  return stripped;
};
const isPrivateHost = (host: string) => {
  const trimmedHost = host.trim().toLowerCase();
  const normalized = trimmedHost.replace(/^\[|\]$/g, '');
  if (normalized === 'localhost' || normalized === '0.0.0.0' || normalized === '::1') return true;
  const ipv4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map((part) => Number(part));
    if (octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
    if (octets[0] === 127) return true;
    if (octets[0] === 10) return true;
    if (octets[0] === 192 && octets[1] === 168) return true;
    if (octets[0] === 169 && octets[1] === 254) return true;
    if (octets[0] === 172) {
      const secondOctet = octets[1];
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }
  }
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  return false;
};
const isSafeUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (isPrivateHost(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
};
const getAllowedExtension = (filename: string) => {
  const extRaw = (filename.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
  if (!allowedExtensions.has(extRaw)) {
    throw new Error(`Unsupported media extension: ${extRaw}`);
  }
  return extRaw;
};

const mediaPrefix = (siteId: string) => `sites/${sanitizeSegment(siteId)}/media`;
const metaObject = (siteId: string, id: string) => `${mediaPrefix(siteId)}/meta/${sanitizeSegment(id)}.json`;
const fileObject = (siteId: string, id: string, ext: string) => `${mediaPrefix(siteId)}/files/${sanitizeSegment(id)}.${sanitizeSegment(ext)}`;

const maybeConvertImage = async (mimeType: string, buffer: Buffer) => {
  if (!mimeType.startsWith('image/')) return { buffer, mimeType };
  const converted = await processImageToWebP(buffer);
  return { buffer: converted, mimeType: 'image/webp' };
};

const validateMimeType = (mimeType: string) => {
  if (allowedMimeExact.has(mimeType)) return;
  if (allowedMimePrefixes.some((prefix) => mimeType.startsWith(prefix))) return;
  throw new Error(`Unsupported media mime type: ${mimeType}`);
};

const ensureWithinSizeLimit = (size: number) => {
  if (size > MAX_MEDIA_BYTES) throw new Error(`Media payload exceeds ${MAX_MEDIA_BYTES} bytes`);
};

const hasPrefix = (buffer: Buffer, signature: number[]) =>
  signature.length <= buffer.length && signature.every((value, index) => buffer[index] === value);

const looksLikeSvg = (buffer: Buffer) => {
  const sample = buffer.slice(0, 512).toString('utf8').trimStart().toLowerCase();
  return sample.startsWith('<svg') || sample.startsWith('<?xml');
};

const validateBufferSignature = (mimeType: string, buffer: Buffer) => {
  if (mimeType === 'application/pdf' && hasPrefix(buffer, [0x25, 0x50, 0x44, 0x46])) return;
  if (mimeType === 'image/jpeg' && hasPrefix(buffer, [0xff, 0xd8, 0xff])) return;
  if (mimeType === 'image/png' && hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47])) return;
  if (mimeType === 'image/webp' && buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP') return;
  if (mimeType === 'image/gif' && (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a')) return;
  if (mimeType === 'image/svg+xml' && looksLikeSvg(buffer)) return;
  if (mimeType === 'video/mp4' && buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') return;
  if (mimeType === 'video/webm' && hasPrefix(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return;
  throw new Error(`Media content signature mismatch for mime type: ${mimeType}`);
};

const fetchRemoteBuffer = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download remote media: ${response.status}`);
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > 0) ensureWithinSizeLimit(contentLength);
  const arrayBuffer = await response.arrayBuffer();
  ensureWithinSizeLimit(arrayBuffer.byteLength);
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  return { buffer: Buffer.from(arrayBuffer), contentType };
};

export const saveUploadedMedia = async (input: {
  siteId: string;
  filename: string;
  mimeType: string;
  contentBase64?: string;
  sourceUrl?: string;
}) => {
  const id = randomUUID();
  const now = new Date().toISOString();
  let sourceBuffer: Buffer | null = null;
  let mimeType = input.mimeType;

  if (input.contentBase64) {
    sourceBuffer = Buffer.from(input.contentBase64, 'base64');
    ensureWithinSizeLimit(sourceBuffer.length);
  } else if (input.sourceUrl) {
    if (!isSafeUrl(input.sourceUrl)) throw new Error('Unsafe or invalid sourceUrl');
    const remote = await fetchRemoteBuffer(input.sourceUrl);
    sourceBuffer = remote.buffer;
    mimeType = mimeType || remote.contentType;
  } else {
    throw new Error('Missing media content');
  }

  const processed = await maybeConvertImage(mimeType, sourceBuffer);
  validateMimeType(processed.mimeType);
  ensureWithinSizeLimit(processed.buffer.length);
  validateBufferSignature(processed.mimeType, processed.buffer);
  const ext = processed.mimeType === 'image/webp' ? 'webp' : getAllowedExtension(input.filename);
  const objectName = fileObject(input.siteId, id, ext);
  await putObjectBuffer(objectName, processed.buffer, processed.mimeType);

  const record: StoredMedia = {
    id,
    siteId: input.siteId,
    filename: path.basename(input.filename),
    mimeType: processed.mimeType,
    sizeBytes: processed.buffer.length,
    createdAt: now,
    path: buildMediaUrl(objectName),
    sourceUrl: input.sourceUrl,
    objectName
  };
  await putObjectBuffer(metaObject(input.siteId, id), Buffer.from(JSON.stringify(record), 'utf8'), 'application/json');
  return record;
};

export const listMedia = async (siteId: string): Promise<StoredMedia[]> => {
  const objects = await listObjects(`${mediaPrefix(siteId)}/meta/`);
  const records: StoredMedia[] = [];
  for (const object of objects) {
    if (!object.name.endsWith('.json')) continue;
    const raw = await getObjectBuffer(object.name);
    records.push(JSON.parse(raw.toString('utf8')) as StoredMedia);
  }
  return records.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

export const deleteMedia = async (siteId: string, id: string): Promise<boolean> => {
  try {
    const metaName = metaObject(siteId, id);
    const raw = await getObjectBuffer(metaName);
    const record = JSON.parse(raw.toString('utf8')) as StoredMedia;
    await removeObject(metaName);
    if (record.objectName) {
      await removeObject(record.objectName);
    }
    return true;
  } catch {
    return false;
  }
};
