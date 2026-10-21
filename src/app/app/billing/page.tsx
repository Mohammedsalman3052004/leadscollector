import { requireManager } from '@/lib/auth';
import { getUsage } from '@/lib/usage';
import { PLANS, PLAN_FEATURES } from '@/lib/plans';
import { stripeConfigured } from '@/lib/billing/stripe';
import { Notice, PageHeader, Section, UsageMeter } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { Check } from 'lucide-react';

export const metadata = { title: 'Plan & billing' };
export const dynamic = 'force-dynamic';

export default async function Billing({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireManager();
  const sp = await searchParams;
  const ws = ctx.active.workspace;
  const usage = await getUsage(ws.id, ws.plan);
  const isOwner = ctx.active.role === 'owner';
  const errors: Record<string, string> = {
    stripe_not_configured: 'Online payments are not set up yet. Contact the platform owner to upgrade.',
    checkout_failed: 'Could not start checkout. Please try again.',
    forbidden: 'Only the workspace owner can change the plan.',
  };

  return (
    <>
      <PageHeader title="Plan & billing" description={`You are on the ${usage.plan.name} plan.`} />
      {sp.upgraded && <div className="mb-6"><Notice tone="success">Thank you! Your upgrade is being applied. Locked leads unlock within a minute.</Notice></div>}
      {sp.error && <div className="mb-6"><Notice tone="error">{errors[sp.error] ?? 'Something went wrong.'}</Notice></div>}

      <Section title="Usage this month">
        <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
          <UsageMeter used={usage.leads} cap={usage.plan.leadsPerMonth} label="Leads" />
          <UsageMeter used={usage.websites} cap={usage.plan.websites} label="Websites" />
          <UsageMeter used={usage.clients} cap={Math.max(usage.plan.clientLogins, 1)} label={usage.plan.clientLogins ? 'Client logins' : 'Client logins (Pro)'} />
          <UsageMeter used={usage.team} cap={usage.plan.teamMembers} label="Team members" />
        </div>
        {usage.locked > 0 && <div className="mt-6 max-w-3xl"><Notice tone="warn"><b>{usage.locked} lead{usage.locked === 1 ? ' is' : 's are'} locked</b> because you are over your monthly limit. Nothing is lost; upgrade to unlock them.</Notice></div>}
      </Section>

      <Section title="Plans">
        <div className="grid gap-px overflow-hidden rounded-lg border hairline bg-line md:grid-cols-2">
          {(['free', 'pro'] as const).map((id) => (
            <div key={id} className="bg-surface p-6">
              <div className="flex items-baseline justify-between"><h3 className="display text-3xl">{PLANS[id].name}</h3>{ws.plan === id && <span className="rounded-full bg-tint px-2.5 py-0.5 text-[12px] font-medium text-accent-ink">Current plan</span>}</div>
              <p className="mt-3"><span className="display text-5xl">{PLANS[id].price}</span>{id === 'pro' && <span className="text-muted"> / month</span>}</p>
              <ul className="mt-5 space-y-2">{PLAN_FEATURES[id].map((f) => <li key={f} className="flex items-start gap-2"><Check size={15} className="mt-1 shrink-0 text-accent-ink" />{f}</li>)}</ul>
              {id === 'pro' && ws.plan !== 'pro' && (
                isOwner ? (
                  <form action="/api/billing/checkout" method="POST" className="mt-6"><SubmitButton className="w-full">Upgrade to Pro</SubmitButton></form>
                ) : <p className="mt-6 text-[13px] text-muted">Ask the workspace owner to upgrade.</p>
              )}
            </div>
          ))}
        </div>
        {!stripeConfigured() && <p className="mt-4 text-[12px] text-muted">Payments are not configured on this server yet (STRIPE_* variables).</p>}
      </Section>
    </>
  );
}
