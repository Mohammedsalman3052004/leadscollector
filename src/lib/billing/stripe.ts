import 'server-only';
import { hmacHex, safeEqual } from '@/lib/crypto';

/** Minimal Stripe client (no SDK). Scaffolded: set STRIPE_* env vars to enable. */
export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PRICE_PRO;

export async function createCheckoutSession(opts: { workspaceId: string; email: string; successUrl: string; cancelUrl: string }) {
  const body = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': process.env.STRIPE_PRICE_PRO || '',
    'line_items[0][quantity]': '1',
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    client_reference_id: opts.workspaceId,
    customer_email: opts.email,
    'subscription_data[metadata][workspace_id]': opts.workspaceId,
  });
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const j: any = await res.json();
  if (!res.ok) throw new Error(j?.error?.message ?? 'Stripe error');
  return j.url as string;
}

/** Verifies the Stripe-Signature header (HMAC SHA256, 5 minute tolerance). */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = parts.t;
  const v1 = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || !v1.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = hmacHex(secret, `${t}.${rawBody}`);
  return v1.some((sig) => safeEqual(sig, expected));
}
