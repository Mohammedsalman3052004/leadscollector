import { json } from '@/lib/http';
import { safeEqual } from '@/lib/crypto';
import { runDeliveries } from '@/lib/delivery/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return safeEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`);
}

async function handle(req: Request) {
  if (!authorized(req)) return json({ ok: false }, 401);
  const result = await runDeliveries(50);
  return json({ ok: true, ...result });
}
export const GET = handle;
export const POST = handle;
