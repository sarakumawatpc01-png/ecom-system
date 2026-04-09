import { randomUUID } from 'crypto';
import Redis from 'ioredis';

type CacheEntry = { value: string; expiresAt?: number };

const hasRedisUrl = Boolean(process.env.REDIS_URL);
const redis = hasRedisUrl ? new Redis(process.env.REDIS_URL as string, { lazyConnect: true, maxRetriesPerRequest: 1 }) : null;
const memory = new Map<string, CacheEntry>();

const now = () => Date.now();

const memorySet = (key: string, value: string, ttlSeconds?: number) => {
  memory.set(key, { value, expiresAt: ttlSeconds ? now() + ttlSeconds * 1000 : undefined });
};

const memoryGet = (key: string) => {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt <= now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
};

const memoryDel = (key: string) => memory.delete(key);

export const cacheGet = async (key: string) => {
  if (!redis) return memoryGet(key);
  try {
    await redis.connect().catch(() => undefined);
    return await redis.get(key);
  } catch {
    return memoryGet(key);
  }
};

export const cacheSet = async (key: string, value: string, ttlSeconds?: number) => {
  if (!redis) return memorySet(key, value, ttlSeconds);
  try {
    await redis.connect().catch(() => undefined);
    if (ttlSeconds && ttlSeconds > 0) await redis.set(key, value, 'EX', ttlSeconds);
    else await redis.set(key, value);
    return;
  } catch {
    return memorySet(key, value, ttlSeconds);
  }
};

export const cacheDel = async (key: string) => {
  if (!redis) return memoryDel(key);
  try {
    await redis.connect().catch(() => undefined);
    await redis.del(key);
    return;
  } catch {
    return memoryDel(key);
  }
};

export const createRefreshToken = async (userId: string, ttlSeconds: number) => {
  const token = randomUUID();
  await cacheSet(`auth:refresh:${token}`, userId, ttlSeconds);
  return token;
};

export const validateRefreshToken = async (token: string, userId: string) => {
  const value = await cacheGet(`auth:refresh:${token}`);
  return value === userId;
};

export const getRefreshTokenUser = async (token: string) => cacheGet(`auth:refresh:${token}`);

export const revokeRefreshToken = async (token: string) => cacheDel(`auth:refresh:${token}`);

export const incrLoginFailure = async (key: string, ttlSeconds: number) => {
  const cacheKey = `auth:fail:${key}`;
  const current = Number((await cacheGet(cacheKey)) || 0);
  const next = current + 1;
  await cacheSet(cacheKey, String(next), ttlSeconds);
  return next;
};

export const resetLoginFailures = async (key: string) => cacheDel(`auth:fail:${key}`);

export const setLockout = async (key: string, ttlSeconds: number) => cacheSet(`auth:lock:${key}`, String(now() + ttlSeconds * 1000), ttlSeconds);

export const getLockout = async (key: string) => {
  const value = await cacheGet(`auth:lock:${key}`);
  if (!value) return null;
  const expiresAt = Number(value);
  if (!Number.isFinite(expiresAt) || expiresAt <= now()) {
    await cacheDel(`auth:lock:${key}`);
    return null;
  }
  return expiresAt;
};
