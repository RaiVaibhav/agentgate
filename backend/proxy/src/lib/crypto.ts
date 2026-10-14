import crypto from 'node:crypto';

/**
 * Derives a consistent 32-byte key using SHA-256 from the configured secret.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.PROXY_SECRET || 'agentgate-default-secret-key-change-in-prod';
  return crypto.createHash('sha256').update(secret).digest();
}

const PREFIX = 'enc:v1:';

/**
 * Encrypt a plaintext secret string using AES-256-GCM.
 */
export function encryptSecret(plainText: string): string {
  if (!plainText || typeof plainText !== 'string' || plainText.startsWith(PREFIX)) {
    return plainText;
  }
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV standard for AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt an AES-256-GCM encrypted secret string.
 * Gracefully returns original string if not encrypted.
 */
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
    console.error('[crypto] Failed to decrypt secret:', err);
    return cipherText;
  }
}

/**
 * Mask a secret string for safe display in UI/API responses.
 */
export function maskSecret(val: string): string {
  if (!val || typeof val !== 'string') return val;
  const raw = decryptSecret(val);
  if (raw.length <= 8) return '••••••••';
  if (raw.startsWith('Bearer ')) {
    const token = raw.slice(7);
    return `Bearer ••••••••${token.slice(-4)}`;
  }
  return `${raw.slice(0, 3)}••••••••${raw.slice(-4)}`;
}

/**
 * Recursively encrypt string values in an object (e.g., headers or env).
 */
export function encryptObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const result: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      result[k] = encryptSecret(v);
    } else if (v && typeof v === 'object') {
      result[k] = encryptObject(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Recursively decrypt string values in an object.
 */
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

/**
 * Recursively mask secrets in an object for UI consumption.
 */
export function maskObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const result: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      result[k] = maskSecret(v);
    } else if (v && typeof v === 'object') {
      result[k] = maskObject(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}
