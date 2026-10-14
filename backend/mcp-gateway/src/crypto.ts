import crypto from 'node:crypto';

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.PROXY_SECRET || 'agentgate-default-secret-key-change-in-prod';
  return crypto.createHash('sha256').update(secret).digest();
}

const PREFIX = 'enc:v1:';

export function decryptSecret(cipherText: string): string {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.startsWith(PREFIX)) {
    return cipherText;
  }
  const parts = cipherText.slice(PREFIX.length).split(':');
  if (parts.length !== 3) return cipherText;
  const [ivHex, tagHex, dataHex] = parts;
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(dataHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('[gateway:crypto] Failed to decrypt secret:', err);
    return cipherText;
  }
}

export function decryptObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const result: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      result[k] = decryptSecret(v);
    } else if (v && typeof v === 'object') {
      result[k] = decryptObject(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}
