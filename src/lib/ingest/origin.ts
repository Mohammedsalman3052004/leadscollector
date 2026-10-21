export interface OriginSite {
  domain: string;
  allowed_domains: string[];
  settings?: Record<string, any> | null;
}

export function normalizeDomain(input: string): string {
  let d = (input || '').trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, '').split('/')[0].split('?')[0].split('#')[0];
  d = d.replace(/:\d+$/, '').replace(/^www\./, '');
  return d;
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Host of the page that sent the request: Origin first, Referer as a fallback. */
export function requestHost(req: Request): string | null {
  const origin = req.headers.get('origin');
  if (origin && origin !== 'null') return hostOf(origin);
  return hostOf(req.headers.get('referer'));
}

export function hostAllowed(host: string | null, site: OriginSite): boolean {
  if (!host) return false;
  const h = host.replace(/^www\./, '');
  if ((h === 'localhost' || h === '127.0.0.1') && site.settings?.allow_localhost) return true;
  const list = [site.domain, ...(site.allowed_domains ?? [])].map(normalizeDomain).filter(Boolean);
  return list.some((d) => h === d || h.endsWith('.' + d));
}
