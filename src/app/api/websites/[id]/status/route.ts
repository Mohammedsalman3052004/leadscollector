import { createClient } from '@/lib/supabase/server';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** Polled by the "waiting for first submission" step. Uses the caller's session, so RLS applies. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: site } = await supabase.from('websites').select('id,status,last_seen_at').eq('id', id).maybeSingle();
  if (!site) return json({ ok: false }, 404);
  const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('website_id', id);
  return json({ ok: true, status: site.status, lastSeen: site.last_seen_at, leads: count ?? 0 });
}
