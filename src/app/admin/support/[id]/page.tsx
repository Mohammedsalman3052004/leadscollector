import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Notice, PageHeader } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Uses the admin's OWN session: Row Level Security only returns rows while a support grant is active. */
export default async function SupportView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from('leads').select('id,name,email,status,confidence,submitted_at,website:websites(name)').eq('workspace_id', id).order('submitted_at', { ascending: false }).limit(50);
  const one = (x: any) => (Array.isArray(x) ? x[0] : x);
  return (
    <>
      <Link href="/admin/settings" className="mb-4 inline-block text-muted hover:text-ink">&larr; Back</Link>
      <PageHeader title="Support view" description="Read-only. Access is time-limited and logged." />
      {error || !(data ?? []).length ? <Notice tone="warn">No visible leads. Either there is no active support grant for this workspace or it has no leads.</Notice> : (
        <div className="overflow-x-auto border-y hairline"><table className="w-full"><tbody>
          {((data ?? []) as any[]).map((l) => <tr key={l.id} className="border-t hairline first:border-t-0"><td className="td font-medium">{l.name ?? l.email}</td><td className="td text-muted">{one(l.website)?.name}</td><td className="td capitalize">{l.status.replace('_', ' ')}</td><td className="td text-[12px] text-muted">{formatDateTime(l.submitted_at)}</td></tr>)}
        </tbody></table></div>
      )}
    </>
  );
}
