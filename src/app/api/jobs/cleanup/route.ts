import { json } from '@/lib/http';
import { safeEqual } from '@/lib/crypto';
import { adminClient } from '@/lib/supabase/admin';
import { PLANS } from '@/lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) return json({ ok: false }, 401);
  const { data, error } = await adminClient().rpc('run_cleanup', { p_free_days: PLANS.free.retentionDays, p_pro_days: PLANS.pro.retentionDays });
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, ...(data as object) });
}
export const GET = handle;
export const POST = handle;
