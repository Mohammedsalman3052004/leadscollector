import { after, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { clientIp, corsFor, json } from '@/lib/http';
import { hostAllowed, hostOf, requestHost } from '@/lib/ingest/origin';
import { ingest, loadSite, rateLimit, siteUsable, verifyTurnstile } from '@/lib/ingest/process';
import { runDeliveries } from '@/lib/delivery/run';
import { appUrl } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPECIAL = new Set(['_redirect', '_next', '_hp', '_gotcha', '_form_name', 'cf-turnstile-response']);

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsFor(req.headers.get('origin')) });
}

/** Hosted form endpoint: point any HTML form's action (or a fetch) at /api/f/<site id>. */
export async function POST(req: Request, ctx: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await ctx.params;
  const origin = req.headers.get('origin');
  const cors = corsFor(origin);
  const wantsJson = (req.headers.get('accept') ?? '').includes('application/json') || (req.headers.get('content-type') ?? '').includes('json');
  const fail = (error: string, status: number) => (wantsJson ? json({ ok: false, error }, status, cors) : new NextResponse(`Submission failed: ${error}`, { status }));

  try {
    const site = await loadSite(siteId);
    if (!site || !siteUsable(site)) return fail('unknown_site', 404);
    if (!site.settings.endpoint_open && !hostAllowed(requestHost(req), site)) return fail('origin_not_allowed', 403);

    const ip = clientIp(req);
    if (!(await rateLimit(`f:site:${site.id}`, 120, 60)) || (ip && !(await rateLimit(`f:ip:${ip}`, 20, 60)))) return fail('rate_limited', 429);

    const fields: Record<string, unknown> = {};
    let redirect: string | undefined;
    let hp = '';
    let turnstile = '';
    let formName = 'Hosted endpoint form';
    const ct = req.headers.get('content-type') ?? '';
    if (ct.includes('json')) {
      const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      for (const [k, v] of Object.entries(b)) {
        if (k === '_redirect' || k === '_next') redirect = String(v);
        else if (k === '_hp' || k === '_gotcha') hp = String(v ?? '');
        else if (k === 'cf-turnstile-response') turnstile = String(v ?? '');
        else if (k === '_form_name') formName = String(v).slice(0, 100);
        else fields[k] = v;
      }
    } else {
      const fd = await req.formData();
      for (const [k, v] of fd.entries()) {
        if (typeof v !== 'string') continue;
        if (k === '_redirect' || k === '_next') redirect = v;
        else if (k === '_hp' || k === '_gotcha') hp = v;
        else if (k === 'cf-turnstile-response') turnstile = v;
        else if (k === '_form_name') formName = v.slice(0, 100);
        else if (!SPECIAL.has(k)) {
          const prev = fields[k];
          fields[k] = prev === undefined ? v : ([] as string[]).concat(prev as string | string[], v);
        }
      }
    }

    if (!hp) {
      if (site.settings.turnstile && !(await verifyTurnstile(turnstile, ip))) return fail('bot_check_failed', 403);
      const r = await ingest({
        site, submissionId: randomUUID(), confidence: 'confirmed', signal: 'endpoint',
        formFingerprint: 'endpoint:' + formName.toLowerCase().slice(0, 40), formName, fields,
        pageUrl: req.headers.get('referer'), referrer: null, ip, userAgent: req.headers.get('user-agent'),
      });
      if (r.status === 'created' || r.status === 'updated') after(() => runDeliveries(10).catch(() => {}));
    }

    if (wantsJson) return json({ ok: true }, 200, cors);
    // Only redirect to a page on one of the customer's own domains.
    const target = redirect && hostAllowed(hostOf(redirect), site) ? redirect : `${appUrl()}/thanks`;
    return NextResponse.redirect(target, 303);
  } catch (e) {
    console.error('[endpoint] error', e);
    return fail('server_error', 500);
  }
}
