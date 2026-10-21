import Link from 'next/link';
import { requireContext, isManagerRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { dayKey, formatDateTime, formatShortDay } from '@/lib/utils';
import { BarList, ConfidenceBadge, EmptyState, LinkButton, Metric, Notice, PageHeader, Section, StatusPill } from '@/components/ui';
import { LeadsChart } from '@/components/charts';
import { LEAD_STATUSES } from '@/lib/types';

export const metadata = { title: 'Overview' };
export const dynamic = 'force-dynamic';

const one = (x: any) => (Array.isArray(x) ? x[0] : x);

export default async function Overview() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const manager = isManagerRole(ctx.active.role);
  const now = new Date();
  const startOfDay = new Date(`${dayKey(now)}T00:00:00+05:30`);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const since = new Date(now.getTime() - 30 * 86400_000);

  const base = () => supabase.from('leads').select('id', { count: 'exact', head: true }).is('deleted_at', null).neq('confidence', 'attempted');
  const [total, fresh, today, month, recent, latest, health] = await Promise.all([
    base(),
    base().eq('status', 'new'),
    base().gte('submitted_at', startOfDay.toISOString()),
    base().gte('submitted_at', monthStart.toISOString()),
    supabase.from('leads').select('submitted_at,status,source,website:websites(name)').is('deleted_at', null).neq('confidence', 'attempted').gte('submitted_at', since.toISOString()).order('submitted_at', { ascending: false }).limit(5000),
    supabase.from('leads').select('id,name,email,status,confidence,submitted_at,website:websites(name),form:forms(name)').is('deleted_at', null).neq('confidence', 'attempted').order('submitted_at', { ascending: false }).limit(8),
    manager
      ? Promise.all([
          adminClient().from('deliveries').select('id', { count: 'exact', head: true }).eq('workspace_id', ctx.active.workspace.id).eq('status', 'failed'),
          adminClient().from('integrations').select('id,website:websites(name)').eq('workspace_id', ctx.active.workspace.id).eq('status', 'needs_reauth'),
        ])
      : Promise.resolve(null),
  ]);

  const rows = (recent.data ?? []) as any[];
  const perDay = new Map<string, number>();
  for (let i = 29; i >= 0; i--) perDay.set(dayKey(new Date(now.getTime() - i * 86400_000)), 0);
  const byWebsite = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const bySource = new Map<string, number>();
  for (const r of rows) {
    const k = dayKey(r.submitted_at);
    if (perDay.has(k)) perDay.set(k, (perDay.get(k) ?? 0) + 1);
    const w = one(r.website)?.name ?? 'Unknown';
    byWebsite.set(w, (byWebsite.get(w) ?? 0) + 1);
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    const s = r.source ?? 'direct';
    bySource.set(s, (bySource.get(s) ?? 0) + 1);
  }
  const chart = [...perDay.entries()].map(([day, leads]) => ({ day: formatShortDay(`${day}T12:00:00Z`), leads }));
  const top = (m: Map<string, number>, n = 6) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, value]) => ({ label, value }));
  const statusItems = LEAD_STATUSES.map((s) => ({ label: s.label, value: byStatus.get(s.value) ?? 0 })).filter((s) => s.value > 0);

  const failed = health ? health[0].count ?? 0 : 0;
  const reauth = health ? (health[1].data ?? []) : [];

  return (
    <>
      <PageHeader title="Overview" description={ctx.active.role === 'client' ? 'Leads received on your website.' : 'Everything that came in across your websites.'} actions={<LinkButton href="/app/leads" variant="secondary">View all leads</LinkButton>} />

      {(failed > 0 || reauth.length > 0) && (
        <div className="mb-8 space-y-3">
          {reauth.map((r: any) => <Notice key={r.id} tone="warn"><b>Google Sheets needs to be reconnected</b> for {one(r.website)?.name ?? 'a website'}. Leads are safe. <Link className="font-medium underline" href="/app/integrations">Reconnect</Link></Notice>)}
          {failed > 0 && <Notice tone="error"><b>{failed} delivery failure{failed === 1 ? '' : 's'}.</b> Some email or Sheets copies did not go through. <Link className="font-medium underline" href="/app/integrations#log">Review and retry</Link></Notice>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-8 gap-y-8 border-b hairline pb-10 lg:grid-cols-4">
        <Metric label="Total leads" value={total.count ?? 0} />
        <Metric label="New" value={fresh.count ?? 0} sub="not yet contacted" />
        <Metric label="Today" value={today.count ?? 0} />
        <Metric label="This month" value={month.count ?? 0} />
      </div>

      <Section title="Leads over time" description="Last 30 days, confirmed and probable submissions.">
        {rows.length ? <LeadsChart data={chart} /> : <EmptyState title="No leads yet" description="Install the snippet on a website and your first submission will appear here." action={ctx.active.role !== 'client' ? <LinkButton href="/app/websites/new">Add a website</LinkButton> : undefined} />}
      </Section>

      <div className="grid gap-x-12 gap-y-0 md:grid-cols-3">
        <Section title="By website"><BarList items={top(byWebsite)} /></Section>
        <Section title="By status"><BarList items={statusItems} /></Section>
        <Section title="By source"><BarList items={top(bySource)} /></Section>
      </div>

      <Section title="Latest leads" action={<Link href="/app/leads" className="text-accent-ink hover:underline">See all</Link>}>
        {(latest.data ?? []).length === 0 ? <p className="text-muted">Nothing here yet.</p> : (
          <div className="overflow-x-auto border-y hairline">
            <table className="w-full min-w-[640px]">
              <tbody>
                {(latest.data as any[]).map((l) => (
                  <tr key={l.id} className="border-t hairline first:border-t-0 hover:bg-tint/40">
                    <td className="td"><Link href={`/app/leads/${l.id}`} className="font-medium hover:underline">{l.name ?? l.email ?? 'Unnamed lead'}</Link><div className="text-[12px] text-muted">{l.email}</div></td>
                    <td className="td text-muted">{one(l.website)?.name}<div className="text-[12px]">{one(l.form)?.name}</div></td>
                    <td className="td"><StatusPill status={l.status} /></td>
                    <td className="td"><ConfidenceBadge confidence={l.confidence} /></td>
                    <td className="td text-right text-[12px] text-muted">{formatDateTime(l.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
