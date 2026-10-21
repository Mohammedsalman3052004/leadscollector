import { describe, expect, it } from 'vitest';
import { extractCore } from '@/lib/ingest/extract';
import { computeDedupeKey } from '@/lib/ingest/dedupe';

describe('extractCore', () => {
  it('maps differently named fields to the core columns and keeps the rest', () => {
    const c = extractCore({ 'Your Name': 'Priya Raman', 'E-mail': 'PRIYA@Example.com', Mobile: '98765 43210', Enquiry: 'Need a lift', 'Number of floors': '6' });
    expect(c.name).toBe('Priya Raman');
    expect(c.email).toBe('priya@example.com');
    expect(c.phone).toBe('98765 43210');
    expect(c.message).toBe('Need a lift');
    expect(c.rest).toEqual({ 'Number of floors': '6' });
  });
  it('joins first and last name and finds emails by value', () => {
    const c = extractCore({ first_name: 'A', last_name: 'B', contact: 'a@b.co' });
    expect(c.name).toBe('A B');
    expect(c.email).toBe('a@b.co');
  });
  it('returns nulls for empty input', () => {
    const c = extractCore({ foo: 'bar' });
    expect([c.name, c.email, c.phone, c.message]).toEqual([null, null, null, null]);
    expect(c.rest).toEqual({ foo: 'bar' });
  });
});

describe('computeDedupeKey', () => {
  const core = (email: string) => extractCore({ name: 'A', email, message: 'hi' });
  it('is stable for identical content and differs otherwise', () => {
    expect(computeDedupeKey('s', 'f', core('a@b.co'))).toBe(computeDedupeKey('s', 'f', core('a@b.co')));
    expect(computeDedupeKey('s', 'f', core('a@b.co'))).not.toBe(computeDedupeKey('s', 'f', core('c@d.co')));
    expect(computeDedupeKey('s', 'f', core('a@b.co'))).not.toBe(computeDedupeKey('t', 'f', core('a@b.co')));
  });
});
