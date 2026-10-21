import { describe, expect, it } from 'vitest';
import { isSensitiveName, redactCards, sanitizeFields } from '@/lib/ingest/sanitize';

describe('sanitizeFields (privacy filter)', () => {
  it('drops password, token, card, OTP and ID style fields', () => {
    const out = sanitizeFields({
      name: 'Priya', email: 'p@example.com', password: 'x', Password2: 'x', csrf_token: 'abc', card_number: '4111111111111111',
      cvv: '123', otp: '1', aadhaar: '123', api_key: 'k', _wpnonce: 'n', 'Building type': 'Residential',
    });
    expect(Object.keys(out).sort()).toEqual(['Building type', 'email', 'name']);
  });

  it('redacts card-like numbers inside free text but keeps ordinary numbers', () => {
    expect(redactCards('call 4111 1111 1111 1111 now')).toBe('call [redacted] now');
    expect(redactCards('phone 9876543210')).toBe('phone 9876543210');
    expect(redactCards('order 1234567890123')).toBe('order 1234567890123'); // fails Luhn
  });

  it('honours per-site excluded fields case-insensitively', () => {
    const out = sanitizeFields({ Name: 'A', DOB: '1990' }, ['dob']);
    expect(out).toEqual({ Name: 'A' });
  });

  it('enforces limits and strips control characters', () => {
    const many: Record<string, string> = {};
    for (let i = 0; i < 200; i++) many[`f${i}`] = 'v';
    expect(Object.keys(sanitizeFields(many)).length).toBe(60);
    expect(sanitizeFields({ a: 'x'.repeat(9000) }).a).toHaveLength(5000);
    expect(sanitizeFields({ a: 'he\u0000llo' }).a).toBe('hello');
  });

  it('keeps arrays of simple values and ignores nested objects', () => {
    const out = sanitizeFields({ interests: ['a', 'b'], nested: { x: 1 }, __proto__x: 'ok' });
    expect(out.interests).toEqual(['a', 'b']);
    expect(out.nested).toBeUndefined();
  });

  it('does not treat harmless names as sensitive', () => {
    for (const n of ['name', 'email', 'phone', 'message', 'company', 'pincode', 'Budget']) expect(isSensitiveName(n)).toBe(false);
  });
});
