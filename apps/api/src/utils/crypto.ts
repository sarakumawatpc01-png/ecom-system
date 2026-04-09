import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const getKey = (secret: string) => scryptSync(secret, 'ecom-system-salt', 32);

export const encryptText = (plainText: string, secret: string) => {
  const iv = randomBytes(12);
  const key = getKey(secret);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
};

export const decryptText = (cipherText: string, secret: string) => {
  const [ivBase64, tagBase64, payloadBase64] = cipherText.split('.');
  if (!ivBase64 || !tagBase64 || !payloadBase64) return '';
  try {
    const key = getKey(secret);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivBase64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(payloadBase64, 'base64')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
};
