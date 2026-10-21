import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { actionContext } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';
import { encrypt, verifyState } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { appUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(`${appUrl()}/app/integrations?${q}`);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  const store = await cookies();
  const cookieState = store.get('lc_oauth_state')?.value;
  const payload = verifyState(state);
  const ctx = await actionContext('manager');

  if (url.searchParams.get('error')) return back('error=google_denied');
  if (!code || !payload || !ctx || cookieState !== state || payload.u !== ctx.user.id || payload.ws !== ctx.active.workspace.id) return back('error=google_state');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, grant_type: 'authorization_code',
      client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: process.env.GOOGLE_SHEETS_REDIRECT_URI || `${appUrl()}/api/integrations/google/callback`,
    }),
  });
  const tok: any = await res.json().catch(() => ({}));
  if (!res.ok || !tok.refresh_token) return back('error=google_token');

  const admin = adminClient();
  const websiteId = payload.w as string;
  const { data: existing } = await admin.from('integrations').select('id,config').eq('workspace_id', ctx.active.workspace.id).eq('website_id', websiteId).eq('type', 'google_sheets').maybeSingle();
  const encrypted = encrypt(JSON.stringify({ refresh_token: tok.refresh_token }));
  let integrationId = existing?.id as string | undefined;
  if (existing) {
    await admin.from('integrations').update({ encrypted_credentials: encrypted, status: 'active', last_error: null }).eq('id', existing.id);
  } else {
    const { data: created } = await admin.from('integrations').insert({
      workspace_id: ctx.active.workspace.id, website_id: websiteId, type: 'google_sheets', name: 'Google Sheets', config: {}, encrypted_credentials: encrypted, status: 'active',
    }).select('id').single();
    integrationId = created?.id;
  }
  if (integrationId) {
    // resume deliveries that stopped because authorization had expired
    await admin.from('deliveries').update({ status: 'pending', attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null })
      .eq('integration_id', integrationId).eq('status', 'failed').like('last_error', 'needs_reauth%');
  }
  await audit(ctx.active.workspace.id, ctx.user.id, 'integration.google.connected', websiteId);
  const out = back('connected=1');
  out.cookies.delete('lc_oauth_state');
  return out;
}
