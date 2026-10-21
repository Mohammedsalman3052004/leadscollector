import { after } from 'next/server';
import { z } from 'zod';
import { clientIp, corsFor, json } from '@/lib/http';
import { hostAllowed, requestHost } from '@/lib/ingest/origin';
import { ingest, loadSite, rateLimit, siteUsable, verifyTurnstile } from '@/lib/ingest/process';
import { runDeliveries } from '@/lib/delivery/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  site: z.string().min(8).max(64),
  event: z.enum(['attempted', 'probable', 'confirmed']),
  signal: z.string().max(40).optional(),
  submission_id: z.string().min(8).max(64),
  promote: z.boolean().optional(),
  form: z.object({ name: z.string().max(120).optional(), fingerprint: z.string().min(1).max(64) }),
  fields: z.record(z.any()).optional(),
  page_url: z.string().max(2000).optional(),
  referrer: z.string().max(2000).optional(),
  utm: z.record(z.string().max(300)).optional(),
  turnstile: z.string().max(2048).optional(),
  hp: z.string().max(200).optional(),
});

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsFor(req.headers.get('origin')) });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const cors = corsFor(origin);
  try {
    const raw = await req.text(); // sendBeacon sends text/plain to avoid a CORS preflight
    if (raw.length > 100_000) return json({ ok: false, error: 'payload_too_large' }, 413, cors);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return json({ ok: false, error: 'invalid_json' }, 400, cors); }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return json({ ok: false, error: 'invalid_payload' }, 400, cors);
    const p = parsed.data;

    const site = await loadSite(p.site);
    if (!site || !siteUsable(site)) return json({ ok: false, error: 'unknown_site' }, 404, cors);

    // Origin check: browsers always send Origin/Referer. Blocks other sites that copied the public ID.
    const host = requestHost(req);
    if (!hostAllowed(host, site)) return json({ ok: false, error: 'origin_not_allowed' }, 403, cors);

    const ip = clientIp(req);
    const okSite = await rateLimit(`ing:site:${site.id}`, 120, 60);
    const okIp = ip ? await rateLimit(`ing:ip:${ip}`, 30, 60) : true;
    if (!okSite || !okIp) return json({ ok: false, error: 'rate_limited' }, 429, { ...cors, 'Retry-After': '60' });

    if (p.hp) return json({ ok: true, status: 'dropped' }, 202, cors); // honeypot: silently accept, store nothing

    if (site.settings.turnstile && !p.promote && !(await verifyTurnstile(p.turnstile, ip))) {
      return json({ ok: false, error: 'bot_check_failed' }, 403, cors);
    }

    const result = await ingest({
      site, submissionId: p.submission_id, confidence: p.event, signal: p.signal ?? 'submit',
      formFingerprint: p.form.fingerprint, formName: p.form.name ?? 'Form', fields: p.fields,
      promoteOnly: p.promote, pageUrl: p.page_url, referrer: p.referrer, utm: p.utm,
      ip, userAgent: req.headers.get('user-agent'),
    });

    if (result.status === 'created' || (result.status === 'updated')) after(() => runDeliveries(10).catch(() => {}));
    return json({ ok: true, status: result.status }, 202, cors);
  } catch (e) {
    console.error('[ingest] error', e);
    return json({ ok: false, error: 'server_error' }, 500, cors);
  }
}
