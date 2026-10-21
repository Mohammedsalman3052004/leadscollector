import Link from 'next/link';
import { adminClient } from '@/lib/supabase/admin';
import { grantSupportAccess } from '@/app/actions/admin';
import { ActionForm } from '@/components/action-form';
import { Field, PageHeader, Section } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
const one = (x: any) => (Array.isArray(x) ? x[0] : x);

export default async function AdminSettings() {
  const a = adminClient();
  const [{ data: workspaces }, { data: grants }, { data: log }] = await Promise.all([
    a.from('workspaces').select('id,name').order('name').limit(500),
    a.from('admin_support_access').select('id,workspace_id,reason,expires_at,created_at,workspace:workspaces(name)').order('created_at', { ascending: false }).limit(20),
    a.from('audit_log').select('id,action,target,created_at,workspace:workspaces(name)').order('created_at', { ascending: false }).limit(60),
  ]);
  return (
    <>
      <PageHeader title="Settings & audit" />
      <Section title="Support access" description="Admins cannot read customer leads by default. A time-limited, logged grant is required; it is enforced by the database, not just the UI.">
        <ActionForm action={grantSupportAccess} submit="Grant access" className="max-w-xl space-y-4">
          <Field label="Workspace"><select name="workspace_id" required className="field" defaultValue=""><option value="" disabled>Choose...</option>{(workspaces ?? []).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
          <Field label="Reason (recorded)"><textarea name="reason" required minLength={10} rows={2} className="field" placeholder="Ticket #123: customer reports missing leads" /></Field>
          <Field label="Hours (1-72)"><input name="hours" type="number" min={1} max={72} defaultValue={2} className="field w-28" /></Field>
        </ActionForm>
        <ul className="mt-6 divide-y divide-line border-y hairline">
          {((grants ?? []) as any[]).map((g) => {
            const active = new Date(g.expires_at) > new Date();
            return <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><span className="font-medium">{one(g.workspace)?.name}</span> <span className="text-[12px] text-muted">- {g.reason}</span><div className="text-[12px] text-muted">Expires {formatDateTime(g.expires_at)}</div></div>{active ? <Link href={`/admin/support/${g.workspace_id}`} className="text-accent-ink hover:underline">Open leads</Link> : <span className="text-[12px] text-muted">Expired</span>}</li>;
          })}
        </ul>
      </Section>
      <Section title="Audit log">
        <div className="overflow-x-auto border-y hairline"><table className="w-full min-w-[560px]"><tbody>
          {((log ?? []) as any[]).map((l) => <tr key={l.id} className="border-t hairline first:border-t-0"><td className="td font-mono text-[12px]">{l.action}</td><td className="td text-muted">{one(l.workspace)?.name ?? '-'}</td><td className="td text-[12px] text-muted">{formatDateTime(l.created_at)}</td></tr>)}
        </tbody></table></div>
      </Section>
    </>
  );
}
