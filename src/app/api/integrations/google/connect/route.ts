import { NextResponse } from 'next/server';
import { actionContext } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';
import { signState } from '@/lib/crypto';
import { planOf } from '@/lib/plans';
import { appUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await actionContext('manager');
  if (!ctx) return NextResponse.redirect(`${appUrl()}/login`);
  if (!planOf(ctx.active.workspace.plan).sheets) return NextResponse.redirect(`${appUrl()}/app/billing`);
  const websiteId = new URL(req.url).searchParams.get('website') ?? '';
  const { data: site } = await adminClient().from('websites').select('id').eq('id', websiteId).eq('workspace_id', ctx.active.workspace.id).maybeSingle();
  if (!site || !process.env.GOOGLE_CLIENT_ID) return NextResponse.redirect(`${appUrl()}/app/integrations?error=google_not_configured`);

  const state = signState({ w: site.id, ws: ctx.active.workspace.id, u: ctx.user.id });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_SHEETS_REDIRECT_URI || `${appUrl()}/api/integrations/google/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  res.cookies.set('lc_oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/api/integrations/google' });
  return res;
}
