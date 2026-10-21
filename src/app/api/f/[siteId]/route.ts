
import { after, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { clientIp, corsFor, json } from '@/lib/http';
import { hostAllowed, hostOf, requestHost } from '@/lib/ingest/origin';
import {
  ingest,
  loadSite,
  rateLimit,
  siteUsable,
  verifyTurnstile,
} from '@/lib/ingest/process';
import { runDeliveries } from '@/lib/delivery/run';
import { appUrl } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPECIAL = new Set([
  '_redirect',
  '_next',
  '_hp',
  '_gotcha',
  '_form_name',
  'cf-turnstile-response',
]);

export async function OPTIONS(req: Request) {
  return new Response(null, {
    status: 204,
    headers: corsFor(req.headers.get('origin')),
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await ctx.params;
  const origin = req.headers.get('origin');
  const cors = corsFor(origin);

  const wantsJson =
    (req.headers.get('accept') ?? '').includes('application/json') ||
    (req.headers.get('content-type') ?? '').includes('json');

  const fail = (error: string, status: number) =>
    wantsJson
      ? json({ ok: false, error }, status, cors)
      : new NextResponse(`Submission failed: ${error}`, { status });

  try {
    // DEBUG 1: Verify the incoming website ID and database lookup.
    console.log('[hosted-form] Request received', {
      siteId,
      requestHost: requestHost(req),
      origin,
    });

    const site = await loadSite(siteId);

    console.log('[hosted-form] Site lookup result', {
      siteFound: !!site,
      requestedSiteId: siteId,
      databasePublicSiteId: site?.public_site_id ?? null,
      websiteStatus: site?.status ?? null,
      workspaceFound: !!site?.workspace,
      workspaceSuspended: site?.workspace?.suspended ?? null,
    });

    if (!site) {
      console.error(
        '[hosted-form] UNKNOWN SITE: loadSite() returned null.',
        'Check the production database, public_site_id, and environment variables.',
      );

      return fail('unknown_site', 404);
    }

    if (!siteUsable(site)) {
      console.error('[hosted-form] Site is disabled or workspace suspended.', {
        status: site.status,
        suspended: site.workspace.suspended,
      });

      return fail('unknown_site', 404);
    }

    // DEBUG 2: Check the domain verification and endpoint settings.
    const host = requestHost(req);
    const allowed = hostAllowed(host, site);

    console.log('[hosted-form] Origin check', {
      requestHost: host,
      configuredDomain: site.domain,
      allowedDomains: site.allowed_domains,
      endpointOpen: site.settings.endpoint_open,
      hostAllowed: allowed,
    });

    if (!site.settings.endpoint_open && !allowed) {
      return fail('origin_not_allowed', 403);
    }

    const ip = clientIp(req);

    if (
      !(await rateLimit(`f:site:${site.id}`, 120, 60)) ||
      (ip && !(await rateLimit(`f:ip:${ip}`, 20, 60)))
    ) {
      return fail('rate_limited', 429);
    }

    const fields: Record<string, unknown> = {};
    let redirect: string | undefined;
    let hp = '';
    let turnstile = '';
    let formName = 'Hosted endpoint form';

    const ct = req.headers.get('content-type') ?? '';

    if (ct.includes('json')) {
      const body = (await req.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      for (const [key, value] of Object.entries(body)) {
        if (key === '_redirect' || key === '_next') {
          redirect = String(value);
        } else if (key === '_hp' || key === '_gotcha') {
          hp = String(value ?? '');
        } else if (key === 'cf-turnstile-response') {
          turnstile = String(value ?? '');
        } else if (key === '_form_name') {
          formName = String(value).slice(0, 100);
        } else {
          fields[key] = value;
        }
      }
    } else {
      const formData = await req.formData();

      for (const [key, value] of formData.entries()) {
        if (typeof value !== 'string') continue;

        if (key === '_redirect' || key === '_next') {
          redirect = value;
        } else if (key === '_hp' || key === '_gotcha') {
          hp = value;
        } else if (key === 'cf-turnstile-response') {
          turnstile = value;
        } else if (key === '_form_name') {
          formName = value.slice(0, 100);
        } else if (!SPECIAL.has(key)) {
          const previous = fields[key];

          fields[key] =
            previous === undefined
              ? value
              : ([] as string[]).concat(
                previous as string | string[],
                value,
              );
        }
      }
    }

    console.log('[hosted-form] Form parsed', {
      fieldNames: Object.keys(fields),
      fieldCount: Object.keys(fields).length,
      formName,
      contentType: ct,
    });

    if (!hp) {
      if (
        site.settings.turnstile &&
        !(await verifyTurnstile(turnstile, ip))
      ) {
        return fail('bot_check_failed', 403);
      }

      console.log('[hosted-form] Sending submission to ingest.');

      const result = await ingest({
        site,
        submissionId: randomUUID(),
        confidence: 'confirmed',
        signal: 'endpoint',
        formFingerprint:
          'endpoint:' + formName.toLowerCase().slice(0, 40),
        formName,
        fields,
        pageUrl: req.headers.get('referer'),
        referrer: null,
        ip,
        userAgent: req.headers.get('user-agent'),
      });

      console.log('[hosted-form] Ingest result', {
        status: result.status,
        leadId: result.lead_id ?? null,
      });

      if (
        result.status === 'created' ||
        result.status === 'updated'
      ) {
        after(() => runDeliveries(10).catch(console.error));
      }
    }

    if (wantsJson) {
      return json({ ok: true }, 200, cors);
    }

    // Redirect only to a domain allowed for this website.
    const target =
      redirect && hostAllowed(hostOf(redirect), site)
        ? redirect
        : `${appUrl()}/thanks`;

    return NextResponse.redirect(target, 303);
  } catch (error) {
    console.error('[hosted-form] Unexpected error:', error);
    return fail('server_error', 500);
  }
}