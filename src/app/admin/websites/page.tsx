import { adminClient } from '@/lib/supabase/admin';
import { setWebsiteDisabled } from '@/app/actions/admin';
import { PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
const one = (x: any) => (Array.isArray(x) ? x[0] : x);

export default async function AdminWebsites() {
  const { data } = await adminClient().from('websites').select('id,name,domain,status,last_seen_at,first_event_at,workspace:workspaces(name)').order('created_at', { ascending: false }).limit(300);
  return (
    <>
      <PageHeader title="Websites" description="Registration and integration status. Suspend a website that is being abused." />
      <div className="overflow-x-auto border-y hairline"><table className="w-full min-w-[760px]">
        <thead><tr className="border-b hairline"><th className="th">Website</th><th className="th">Workspace</th><th className="th">Status</th><th className="th">Last seen</th><th className="th" /></tr></thead>
        <tbody>
          {((data ?? []) as any[]).map((s) => (
            <tr key={s.id} className="border-t hairline">
              <td className="td"><div className="font-medium">{s.name}</div><div className="text-[12px] text-muted">{s.domain}</div></td>
              <td className="td text-muted">{one(s.workspace)?.name}</td>
              <td className="td capitalize">{s.status}</td>
              <td className="td text-[12px] text-muted">{formatDateTime(s.last_seen_at)}</td>
              <td className="td text-right"><form action={setWebsiteDisabled}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="disabled" value={String(s.status !== 'disabled')} /><SubmitButton variant={s.status === 'disabled' ? 'secondary' : 'danger'} className="h-8 px-3 text-[13px]">{s.status === 'disabled' ? 'Unsuspend' : 'Suspend'}</SubmitButton></form></td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
