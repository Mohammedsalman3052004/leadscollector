import Link from 'next/link';
import { requireStaff, isManagerRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getUsage } from '@/lib/usage';
import { formatDateTime } from '@/lib/utils';
import { EmptyState, LinkButton, Notice, PageHeader } from '@/components/ui';

export const metadata = { title: 'Websites' };
export const dynamic = 'force-dynamic';

export default async function Websites() {
  const ctx = await requireStaff();
  const supabase = await createClient();
  const usage = await getUsage(ctx.active.workspace.id, ctx.active.workspace.plan);
  const { data: sites } = await supabase.from('websites').select('id,name,domain,status,last_seen_at,created_at').order('created_at', { ascending: false });
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const counts = await Promise.all((sites ?? []).map(async (s: any) => {
    const [m, last] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('website_id', s.id).neq('confidence', 'attempted').is('deleted_at', null).gte('submitted_at', monthStart),
      supabase.from('leads').select('submitted_at').eq('website_id', s.id).neq('confidence', 'attempted').is('deleted_at', null).order('submitted_at', { ascending: false }).limit(1),
    ]);
    return { id: s.id, month: m.count ?? 0, last: (last.data as any[])?.[0]?.submitted_at ?? null };
  }));
  const info = new Map(counts.map((c) => [c.id, c]));
  const canAdd = isManagerRole(ctx.active.role) && usage.websites < usage.plan.websites;

  return (
    <>
      <PageHeader title="Websites" description={`${usage.websites} of ${usage.plan.websites} websites on the ${usage.plan.name} plan.`} actions={canAdd ? <LinkButton href="/app/websites/new">Add website</LinkButton> : undefined} />
      {isManagerRole(ctx.active.role) && usage.websites >= usage.plan.websites && <div className="mb-6"><Notice tone="info">You have reached the website limit on the {usage.plan.name} plan. <Link href="/app/billing" className="font-medium underline">See plans</Link></Notice></div>}
      {!(sites ?? []).length ? (
        <EmptyState title="Add your first website" description="Register a domain, paste one snippet, and receive leads." action={isManagerRole(ctx.active.role) ? <LinkButton href="/app/websites/new">Add website</LinkButton> : undefined} />
      ) : (
        <div className="overflow-x-auto border-y hairline">
          <table className="w-full min-w-[720px]">
            <thead><tr className="border-b hairline"><th className="th">Website</th><th className="th">Install status</th><th className="th">Leads this month</th><th className="th">Last lead</th><th className="th" /></tr></thead>
            <tbody>
              {(sites as any[]).map((s) => {
                const i = info.get(s.id);
                return (
                  <tr key={s.id} className="border-t hairline hover:bg-tint/40">
                    <td className="td"><Link href={`/app/websites/${s.id}`} className="font-medium hover:underline">{s.name}</Link><div className="text-[12px] text-muted">{s.domain}</div></td>
                    <td className="td">
                      <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${s.status === 'installed' ? 'text-[#2F6B3F]' : s.status === 'disabled' ? 'text-muted' : 'text-[#8A5A0B]'}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />{s.status === 'installed' ? 'Installed' : s.status === 'disabled' ? 'Paused' : 'Not detected'}
                      </span>
                      {s.last_seen_at && <div className="text-[12px] text-muted">Seen {formatDateTime(s.last_seen_at)}</div>}
                    </td>
                    <td className="td tabular-nums">{i?.month ?? 0}</td>
                    <td className="td text-muted">{i?.last ? formatDateTime(i.last) : '-'}</td>
                    <td className="td text-right"><Link href={`/app/websites/${s.id}`} className="text-accent-ink hover:underline">Settings</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
