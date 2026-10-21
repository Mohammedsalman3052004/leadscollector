import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const src = readFileSync(path.resolve(__dirname, '../public/lc.js'), 'utf8');

describe('tracker script', () => {
  it('stays small (under 8 KB gzipped)', () => {
    expect(gzipSync(src).length).toBeLessThan(8 * 1024);
  });
  it('is syntactically valid and never throws when loaded without a script tag', () => {
    expect(() => new Function(src)).not.toThrow();
  });
  it('contains the privacy and confirmation building blocks', () => {
    for (const needle of ['password', 'csrf', 'wpcf7mailsent', 'leadscollector:success', 'data-lc-ignore', 'sendBeacon', 'network_2xx']) expect(src).toContain(needle);
  });
  it('does not touch cookies', () => {
    expect(src).not.toMatch(/document\.cookie/);
  });
});
