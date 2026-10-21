import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Confidence, LeadStatus } from '@/lib/types';
import { LEAD_STATUSES } from '@/lib/types';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const base = 'inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-[14px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-ink hover:brightness-95',
  secondary: 'border border-line bg-surface text-ink hover:bg-tint',
  ghost: 'text-ink hover:bg-tint',
  danger: 'border border-red-200 bg-surface text-red-700 hover:bg-red-50',
};
export const buttonClass = (variant: Variant = 'primary', extra?: string) => cn(base, variants[variant], extra);

export function LinkButton({ href, variant = 'primary', className, children, ...rest }: { href: string; variant?: Variant; className?: string; children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, 'href' | 'className'>) {
  return <Link href={href} className={buttonClass(variant, className)} {...rest}>{children}</Link>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="display text-[40px] leading-[1.05]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-t hairline py-8 first:border-t-0 first:pt-0">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold leading-tight">{title}</h2>
          {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const statusTone: Record<LeadStatus, string> = {
  new: 'bg-[#F3EBDA] text-[#7A5C1F]',
  contacted: 'bg-[#E6ECF3] text-[#3C5573]',
  follow_up: 'bg-[#FBEFD5] text-[#8A5A0B]',
  qualified: 'bg-[#E3F1E6] text-[#2F6B3F]',
  converted: 'bg-[#D3E8D9] text-[#1F5430]',
  lost: 'bg-[#ECEAE5] text-[#6B675F]',
};
export function StatusPill({ status }: { status: string }) {
  const label = LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium', statusTone[status as LeadStatus] ?? statusTone.lost)}>{label}</span>;
}

export function ConfidenceBadge({ confidence }: { confidence: Confidence | string }) {
  const map: Record<string, { label: string; cls: string; title: string }> = {
    confirmed: { label: 'Confirmed', cls: 'text-[#2F6B3F]', title: 'The website accepted this submission.' },
    probable: { label: 'Probable', cls: 'text-[#8A5A0B]', title: 'The form submitted and the page moved on, but acceptance was not directly observed.' },
    attempted: { label: 'Unconfirmed attempt', cls: 'text-muted', title: 'A submit was seen but no success signal followed. It may have failed.' },
  };
  const c = map[confidence] ?? map.attempted;
  return (
    <span title={c.title} className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium', c.cls)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {c.label}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center border border-dashed border-line px-6 py-14 text-center rounded-lg">
      <h3 className="display text-2xl">{title}</h3>
      {description && <p className="mt-2 max-w-md text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error' | 'success'; children: React.ReactNode }) {
  const tones = {
    info: 'border-l-accent bg-tint text-ink',
    warn: 'border-l-amber-500 bg-amber-50 text-amber-900',
    error: 'border-l-red-500 bg-red-50 text-red-800',
    success: 'border-l-green-600 bg-green-50 text-green-900',
  };
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-md border-l-[3px] px-4 py-3 text-[13px]', tones[tone])}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <div className="display text-[48px] leading-none">{value}</div>
      <div className="mt-2 text-[12px] font-medium uppercase tracking-wider text-muted">{label}</div>
      {sub && <div className="mt-0.5 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

export function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="text-muted">No data yet.</p>;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex justify-between text-[13px]">
            <span className="truncate pr-3">{i.label}</span>
            <span className="tabular-nums text-muted">{i.value}</span>
          </div>
          <div className="h-1.5 rounded-full bg-line">
            <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.max(3, (i.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function UsageMeter({ used, cap, label }: { used: number; cap: number; label: string }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, cap)) * 100));
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[12px] text-muted"><span>{label}</span><span className="tabular-nums">{used} / {cap}</span></div>
      <div className="h-1.5 rounded-full bg-line"><div className={cn('h-1.5 rounded-full', pct >= 90 ? 'bg-red-500' : 'bg-accent')} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-[#1C1B19] p-4 font-mono text-[12.5px] leading-relaxed text-[#F3EBDA]"><code>{children}</code></pre>
  );
}
