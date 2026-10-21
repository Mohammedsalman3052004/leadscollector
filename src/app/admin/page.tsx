import { adminClient } from '@/lib/supabase/admin';
import { Metric, PageHeader, Section } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const a = adminClient();
  const day = new Date(Date.now() - 86400_000).toISOString();
  const week = new Date(Date.now() - 7 * 86400_000).toISOString();
  const cnt = (t: string) => a.from(t).select('id', { count: 'exact', head: true });
  const [ws, pro, sites, installed, leads, leads24, failed7, total7, suspended] = await Promise.all([
    cnt('workspaces'),
    cnt('workspaces').eq('plan', 'pro'),
    cnt('websites'),
    cnt('websites').eq('status', 'installed'),
    cnt('leads').neq('confidence', 'attempted'),
    cnt('leads').neq('confidence', 'attempted').gte('created_at', day),
    cnt('deliveries').eq('status', 'failed').gte('created_at', week),
    cnt('deliveries').gte('created_at', week),
    cnt('workspaces').eq('suspended', true),
  ]);
  const rate = total7.count ? Math.round(((failed7.count ?? 0) / total7.count) * 1000) / 10 : 0;
  return (
    <>
      <PageHeader title="Platform overview" description="Operational metrics. Customer lead contents are never shown here." />
      <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
        <Metric label="Workspaces" value={ws.count ?? 0} sub={`${pro.count ?? 0} on Pro`} />
        <Metric label="Websites" value={sites.count ?? 0} sub={`${installed.count ?? 0} installed`} />
        <Metric label="Leads (all time)" value={leads.count ?? 0} sub={`${leads24.count ?? 0} in last 24h`} />
        <Metric label="Delivery failures (7d)" value={`${rate}%`} sub={`${failed7.count ?? 0} of ${total7.count ?? 0}`} />
      </div>
      <Section title="Suspended"><p className="text-muted">{suspended.count ?? 0} workspace(s) currently suspended.</p></Section>
    </>
  );
}
