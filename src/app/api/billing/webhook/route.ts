import { adminClient } from '@/lib/supabase/admin';
import { verifyStripeSignature } from '@/lib/billing/stripe';
import { json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await req.text();
  if (!secret || !verifyStripeSignature(raw, req.headers.get('stripe-signature'), secret)) return json({ ok: false }, 400);
  const event = JSON.parse(raw);
  const admin = adminClient();
  const obj = event.data?.object ?? {};

  if (event.type === 'checkout.session.completed' && obj.client_reference_id) {
    await admin.from('workspaces').update({ plan: 'pro', stripe_customer_id: obj.customer, stripe_subscription_id: obj.subscription }).eq('id', obj.client_reference_id);
    await admin.rpc('release_locked_leads', { p_ws: obj.client_reference_id });
  } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const active = event.type === 'customer.subscription.updated' && ['active', 'trialing'].includes(obj.status);
    const { data: ws } = await admin.from('workspaces').update({ plan: active ? 'pro' : 'free' }).eq('stripe_subscription_id', obj.id).select('id').maybeSingle();
    if (ws && active) await admin.rpc('release_locked_leads', { p_ws: ws.id });
  }
  return json({ received: true });
}
