import { adminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
const one = (x: any) => (Array.isArray(x) ? x[0] : x);

export default async function AdminErrors() {
  const { data } = await adminClient().from('deliveries').select('id,status,attempts,last_error,created_at,workspace:workspaces(name),integration:integrations(type)').in('status', ['failed', 'retrying']).order('created_at', { ascending: false }).limit(100);
  return (
    <>
      <PageHeader title="Delivery errors" description="Failed and retrying email / Sheets deliveries. Lead contents are intentionally not shown." />
      {(data ?? []).length === 0 ? <p className="text-muted">No failures. </p> : (
        <div className="overflow-x-auto border-y hairline"><table className="w-full min-w-[720px]">
          <thead><tr className="border-b hairline"><th className="th">Workspace</th><th className="th">Type</th><th className="th">Status</th><th className="th">Error</th><th className="th">When</th></tr></thead>
          <tbody>
            {((data ?? []) as any[]).map((d) => (
              <tr key={d.id} className="border-t hairline align-top">
                <td className="td">{one(d.workspace)?.name}</td><td className="td">{one(d.integration)?.type}</td>
                <td className="td capitalize">{d.status} ({d.attempts})</td><td className="td max-w-md break-words text-muted">{d.last_error}</td>
                <td className="td whitespace-nowrap text-[12px] text-muted">{formatDateTime(d.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </>
  );
}
