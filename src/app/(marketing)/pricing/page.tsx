import { Pricing } from '@/components/marketing/Pricing';
import { PLANS } from '@/lib/plans';

export const metadata = { title: 'Pricing' };

const rows: [string, (p: typeof PLANS.free) => string][] = [
  ['Websites', (p) => String(p.websites)],
  ['Confirmed leads per month', (p) => p.leadsPerMonth.toLocaleString('en-US')],
  ['Team members', (p) => String(p.teamMembers)],
  ['Client logins', (p) => (p.clientLogins ? String(p.clientLogins) : 'No')],
  ['Google Sheets sync', (p) => (p.sheets ? 'Yes' : 'No')],
  ['White-label client portal', (p) => (p.whiteLabel ? 'Yes' : 'No')],
  ['Data retention', (p) => `${p.retentionDays >= 365 ? Math.round(p.retentionDays / 365) + ' years' : p.retentionDays + ' days'}`],
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="display text-[56px] leading-none">Pricing</h1>
      <p className="mb-10 mt-4 max-w-xl text-muted">Leads above your monthly limit are never discarded. They are stored securely and unlock as soon as you upgrade.</p>
      <Pricing />
      <h2 className="display mb-4 mt-16 text-3xl">Compare plans</h2>
      <div className="overflow-x-auto border-y hairline">
        <table className="w-full min-w-[480px]">
          <thead><tr><th className="th">Feature</th><th className="th">Free</th><th className="th">Pro</th></tr></thead>
          <tbody>
            {rows.map(([label, f]) => (
              <tr key={label} className="border-t hairline"><td className="td">{label}</td><td className="td">{f(PLANS.free)}</td><td className="td">{f(PLANS.pro)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
