import { after } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { clientIp, json } from '@/lib/http';
import { hmacHex, safeEqual } from '@/lib/crypto';
import { ingest, loadSite, rateLimit, siteUsable } from '@/lib/ingest/process';
import { runDeliveries } from '@/lib/delivery/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  fields: z.record(z.any()),
  form_name: z.string().max(120).optional(),
  page_url: z.string().max(2000).optional(),
  submission_id: z.string().min(8).max(64).optional(),
  submitted_at: z.string().datetime().optional(),
});

/**
 * Server-to-server capture (the most reliable path: your backend confirms the submission).
 * Sign the raw body: header  x-lc-signature: sha256=<hex hmac of body using the website's webhook secret>
 */
export async function POST(req: Request, ctx: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await ctx.params;
  const raw = await req.text();
  if (raw.length > 200_000) return json({ ok: false, error: 'payload_too_large' }, 413);
  const site = await loadSite(siteId);
  if (!site || !siteUsable(site)) return json({ ok: false, error: 'unknown_site' }, 404);

  const sig = (req.headers.get('x-lc-signature') ?? '').replace(/^sha256=/, '');
  if (!sig || !safeEqual(sig, hmacHex(site.webhook_secret, raw))) return json({ ok: false, error: 'bad_signature' }, 401);
  if (!(await rateLimit(`wh:site:${site.id}`, 300, 60))) return json({ ok: false, error: 'rate_limited' }, 429);

  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const p = schema.safeParse(body);
  if (!p.success) return json({ ok: false, error: 'invalid_payload' }, 400);

  const r = await ingest({
    site, submissionId: p.data.submission_id ?? randomUUID(), confidence: 'confirmed', signal: 'webhook',
    formFingerprint: 'webhook:' + (p.data.form_name ?? 'default').toLowerCase().slice(0, 40),
    formName: p.data.form_name ?? 'Webhook form', fields: p.data.fields, pageUrl: p.data.page_url,
    ip: clientIp(req), userAgent: null, submittedAt: p.data.submitted_at ?? null,
  });
  if (r.status === 'created' || r.status === 'updated') after(() => runDeliveries(10).catch(() => {}));
  return json({ ok: true, status: r.status, lead_id: r.lead_id }, 200);
}
