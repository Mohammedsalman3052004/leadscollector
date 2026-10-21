import { NextResponse } from 'next/server';
import { actionContext } from '@/lib/auth';
import { createCheckoutSession, stripeConfigured } from '@/lib/billing/stripe';
import { appUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST() {
  const ctx = await actionContext('owner');
  if (!ctx) return NextResponse.redirect(`${appUrl()}/app/billing?error=forbidden`, 303);
  if (!stripeConfigured()) return NextResponse.redirect(`${appUrl()}/app/billing?error=stripe_not_configured`, 303);
  try {
    const url = await createCheckoutSession({
      workspaceId: ctx.active.workspace.id, email: ctx.user.email,
      successUrl: `${appUrl()}/app/billing?upgraded=1`, cancelUrl: `${appUrl()}/app/billing`,
    });
    return NextResponse.redirect(url, 303);
  } catch {
    return NextResponse.redirect(`${appUrl()}/app/billing?error=checkout_failed`, 303);
  }
}
