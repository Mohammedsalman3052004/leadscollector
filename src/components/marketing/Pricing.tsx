import Link from 'next/link';
import { Check } from 'lucide-react';
import { PLANS, PLAN_FEATURES } from '@/lib/plans';
import { buttonClass } from '@/components/ui';

export function Pricing() {
  return (
    <div className="grid gap-px overflow-hidden rounded-lg border hairline bg-line md:grid-cols-2">
      {(['free', 'pro'] as const).map((id) => {
        const p = PLANS[id];
        return (
          <div key={id} className="bg-surface p-8">
            <div className="flex items-baseline justify-between">
              <h3 className="display text-3xl">{p.name}</h3>
              {id === 'pro' && <span className="rounded-full bg-tint px-2.5 py-0.5 text-[12px] font-medium text-accent-ink">For agencies</span>}
            </div>
            <p className="mt-1 text-muted">{p.tagline}</p>
            <p className="mt-6"><span className="display text-[56px] leading-none">{p.price}</span>{id === 'pro' && <span className="text-muted"> / month</span>}</p>
            <ul className="mt-6 space-y-2.5">
              {PLAN_FEATURES[id].map((f) => (
                <li key={f} className="flex items-start gap-2.5"><Check size={16} className="mt-0.5 shrink-0 text-accent-ink" />{f}</li>
              ))}
            </ul>
            <Link href="/signup" className={buttonClass(id === 'pro' ? 'primary' : 'secondary', 'mt-8 w-full')}>{id === 'pro' ? 'Start with Pro' : 'Start free'}</Link>
          </div>
        );
      })}
    </div>
  );
}
