import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY is not set');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes, base64 encoded (openssl rand -base64 32)');
  return buf;
}

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

export function decrypt(payload: string): string {
  const [v, iv, tag, ct] = payload.split('.');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Invalid ciphertext');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hmacHex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('hex');
}

export function newPublicSiteId(): string {
  return 'lc_' + randomBytes(12).toString('hex');
}

export function randomPassword(len = 14): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Signed, expiring state token (used for the Google OAuth round trip). */
export function signState(payload: Record<string, string | number>, secret = process.env.ENCRYPTION_KEY || ''): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 10 * 60 * 1000 })).toString('base64url');
  return body + '.' + hmacHex(secret, body);
}
export function verifyState(token: string, secret = process.env.ENCRYPTION_KEY || ''): Record<string, any> | null {
  const [body, sig] = (token || '').split('.');
  if (!body || !sig || !safeEqual(sig, hmacHex(secret, body))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}
