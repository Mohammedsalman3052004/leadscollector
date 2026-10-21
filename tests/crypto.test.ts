import { beforeAll, describe, expect, it } from 'vitest';
import { decrypt, encrypt, hmacHex, randomPassword, safeEqual, signState, verifyState } from '@/lib/crypto';

beforeAll(() => { process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64'); });

describe('crypto', () => {
  it('round-trips AES-GCM and uses a fresh IV each time', () => {
    const a = encrypt('{"refresh_token":"abc"}');
    expect(decrypt(a)).toBe('{"refresh_token":"abc"}');
    expect(encrypt('x')).not.toBe(encrypt('x'));
  });
  it('detects tampering', () => {
    const parts = encrypt('secret').split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => decrypt(parts.join('.'))).toThrow();
  });
  it('verifies HMAC signatures in constant time', () => {
    const sig = hmacHex('whsec_test', '{"a":1}');
    expect(safeEqual(sig, hmacHex('whsec_test', '{"a":1}'))).toBe(true);
    expect(safeEqual(sig, hmacHex('whsec_test', '{"a":2}'))).toBe(false);
    expect(safeEqual('short', sig)).toBe(false);
  });
  it('signs and verifies OAuth state, rejecting bad or expired tokens', () => {
    const t = signState({ w: '1' });
    expect(verifyState(t)?.w).toBe('1');
    expect(verifyState(t + 'x')).toBeNull();
    expect(verifyState('garbage')).toBeNull();
  });
  it('generates strong random passwords', () => {
    const p = randomPassword();
    expect(p).toHaveLength(14);
    expect(randomPassword()).not.toBe(p);
  });
});
