import { describe, expect, it } from 'vitest';
import { hostAllowed, normalizeDomain, requestHost } from '@/lib/ingest/origin';

const site = { domain: 'Example.com', allowed_domains: ['ads.other.in'], settings: {} };

describe('origin allow-list', () => {
  it('normalises domains', () => {
    expect(normalizeDomain('https://www.Example.com/path?x=1')).toBe('example.com');
    expect(normalizeDomain('localhost:3000')).toBe('localhost');
  });
  it('allows the domain, www, subdomains and extra domains', () => {
    for (const h of ['example.com', 'www.example.com', 'blog.example.com', 'ads.other.in']) expect(hostAllowed(h, site)).toBe(true);
  });
  it('rejects lookalikes, other sites and empty hosts', () => {
    for (const h of ['evil-example.com', 'example.com.evil.io', 'other.in', null]) expect(hostAllowed(h as string | null, site)).toBe(false);
  });
  it('allows localhost only when enabled', () => {
    expect(hostAllowed('localhost', site)).toBe(false);
    expect(hostAllowed('localhost', { ...site, settings: { allow_localhost: true } })).toBe(true);
  });
  it('reads Origin first, then Referer', () => {
    expect(requestHost(new Request('http://x', { headers: { origin: 'https://a.com', referer: 'https://b.com/p' } }))).toBe('a.com');
    expect(requestHost(new Request('http://x', { headers: { referer: 'https://b.com/p' } }))).toBe('b.com');
    expect(requestHost(new Request('http://x', { headers: { origin: 'null' } }))).toBeNull();
  });
});
