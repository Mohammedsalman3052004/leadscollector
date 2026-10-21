import { adminClient } from '@/lib/supabase/admin';
import { json } from '@/lib/http';
import { hostAllowed, requestHost } from '@/lib/ingest/origin';
import { loadSite, siteUsable } from '@/lib/ingest/process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' };

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}

/** Public, minimal config. Contains no secrets and reveals nothing about unknown sites. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('site') ?? '';
  const site = await loadSite(id);
  if (!site || !siteUsable(site)) return json({ v: 1, disabled: true }, 200, CORS);

  // Script-seen ping: only counts when it comes from an allowed domain.
  const host = requestHost(req);
  if (hostAllowed(host, site)) {
    const stale = !site.status || site.status === 'pending';
    const admin = adminClient();
    if (stale) await admin.from('websites').update({ status: 'installed', last_seen_at: new Date().toISOString() }).eq('id', site.id).eq('status', 'pending');
    else await admin.from('websites').update({ last_seen_at: new Date().toISOString() }).eq('id', site.id).lt('last_seen_at', new Date(Date.now() - 5 * 60_000).toISOString());
  }

  const s = site.settings;
  return json(
    {
      v: 1,
      excluded: Array.isArray(s.excluded_fields) ? s.excluded_fields : [],
      successUrl: typeof s.success_url === 'string' ? s.success_url : '',
      successSelector: typeof s.success_selector === 'string' ? s.success_selector : '',
      consent: !!s.consent,
    },
    200,
    CORS,
  );
}
