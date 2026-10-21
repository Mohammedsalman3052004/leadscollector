import { adminClient } from '@/lib/supabase/admin';
import { setWorkspacePlan, setWorkspaceSuspended } from '@/app/actions/admin';
import { PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminWorkspaces() {
  const a = adminClient();
  const { data } = await a.from('workspaces').select('id,name,slug,plan,suspended,created_at,owner:profiles!workspaces_owner_id_fkey(email)').order('created_at', { ascending: false }).limit(200);
  const month = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10);
  const { data: usage } = await a.from('usage_counters').select('workspace_id,lead_count').eq('month', month);
  const { data: sites } = await a.from('websites').select('workspace_id');
  const used = new Map((usage ?? []).map((u: any) => [u.workspace_id, u.lead_count]));
  const siteCount = new Map<string, number>();
  for (const s of (sites ?? []) as any[]) siteCount.set(s.workspace_id, (siteCount.get(s.workspace_id) ?? 0) + 1);
  const one = (x: any) => (Array.isArray(x) ? x[0] : x);

  return (
    <>
      <PageHeader title="Workspaces" />
      <div className="overflow-x-auto border-y hairline"><table className="w-full min-w-[820px]">
        <thead><tr className="border-b hairline"><th className="th">Workspace</th><th className="th">Owner</th><th className="th">Plan</th><th className="th">Sites</th><th className="th">Leads this month</th><th className="th">Created</th><th className="th" /></tr></thead>
        <tbody>
          {((data ?? []) as any[]).map((w) => (
            <tr key={w.id} className="border-t hairline align-top">
              <td className="td"><div className="font-medium">{w.name}</div><div className="text-[12px] text-muted">{w.slug}{w.suspended && ' - suspended'}</div></td>
              <td className="td text-muted">{one(w.owner)?.email}</td>
              <td className="td">
                <form action={setWorkspacePlan} className="flex items-center gap-2"><input type="hidden" name="id" value={w.id} />
                  <select name="plan" defaultValue={w.plan} aria-label="Plan" className="field h-8 w-auto py-0 text-[13px]"><option value="free">Free</option><option value="pro">Pro</option></select>
                  <button className="text-[13px] text-accent-ink hover:underline">Set</button></form>
              </td>
              <td className="td tabular-nums">{siteCount.get(w.id) ?? 0}</td>
              <td className="td tabular-nums">{used.get(w.id) ?? 0}</td>
              <td className="td text-[12px] text-muted">{formatDate(w.created_at)}</td>
              <td className="td text-right"><form action={setWorkspaceSuspended}><input type="hidden" name="id" value={w.id} /><input type="hidden" name="suspended" value={String(!w.suspended)} /><SubmitButton variant={w.suspended ? 'secondary' : 'danger'} className="h-8 px-3 text-[13px]">{w.suspended ? 'Unsuspend' : 'Suspend'}</SubmitButton></form></td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
