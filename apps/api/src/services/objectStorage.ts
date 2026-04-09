import { Client } from 'minio';

const endpoint = process.env.MINIO_ENDPOINT;
const accessKey = process.env.MINIO_ACCESS_KEY;
const secretKey = process.env.MINIO_SECRET_KEY;
const bucket = process.env.MINIO_BUCKET || 'ecom-media';
const useSSL = String(process.env.MINIO_USE_SSL || 'false').toLowerCase() === 'true';
const port = Number(process.env.MINIO_PORT || (useSSL ? 443 : 9000));

const hasConfig = Boolean(endpoint && accessKey && secretKey);

let client: Client | null = null;

const getClient = () => {
  if (!hasConfig) {
    throw new Error('MinIO is not configured: set MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY');
  }
  if (!client) {
    client = new Client({
      endPoint: String(endpoint),
      accessKey: String(accessKey),
      secretKey: String(secretKey),
      useSSL,
      port
    });
  }
  return client;
};

let bucketReady: Promise<void> | null = null;

export const ensureMediaBucket = async () => {
  if (!bucketReady) {
    bucketReady = (async () => {
      const storage = getClient();
      const exists = await storage.bucketExists(bucket);
      if (!exists) {
        await storage.makeBucket(bucket, process.env.MINIO_REGION || 'us-east-1');
      }
    })();
  }
  await bucketReady;
};

export const putObjectBuffer = async (objectName: string, buffer: Buffer, contentType: string) => {
  await ensureMediaBucket();
  const storage = getClient();
  await storage.putObject(bucket, objectName, buffer, buffer.length, { 'Content-Type': contentType });
};

export const getObjectBuffer = async (objectName: string): Promise<Buffer> => {
  await ensureMediaBucket();
  const storage = getClient();
  const stream = await storage.getObject(bucket, objectName);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export const removeObject = async (objectName: string) => {
  await ensureMediaBucket();
  const storage = getClient();
  await storage.removeObject(bucket, objectName);
};

export type ListedObject = { name: string; size: number; lastModified?: Date };

export const listObjects = async (prefix: string): Promise<ListedObject[]> => {
  await ensureMediaBucket();
  const storage = getClient();
  const stream = storage.listObjectsV2(bucket, prefix, true);
  return await new Promise<ListedObject[]>((resolve, reject) => {
    const items: ListedObject[] = [];
    stream.on('data', (obj) => {
      if (!obj?.name) return;
      items.push({ name: obj.name, size: obj.size || 0, lastModified: obj.lastModified });
    });
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(items));
  });
};

export const buildMediaUrl = (objectName: string) => {
  const publicBase = process.env.MINIO_PUBLIC_BASE_URL;
  if (publicBase) return `${publicBase.replace(/\/$/, '')}/${objectName}`;
  const proto = useSSL ? 'https' : 'http';
  return `${proto}://${endpoint}:${port}/${bucket}/${objectName}`;
};
