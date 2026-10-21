import { NextResponse } from 'next/server';

export function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}

export function corsFor(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
