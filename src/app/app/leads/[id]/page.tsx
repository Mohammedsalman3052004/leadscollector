import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireContext, isStaffRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { formatDateTime } from '@/lib/utils';
import { ConfidenceBadge, Section } from '@/components/ui';
import { AssignControl, FollowupControl, NoteForm, StatusControl } from '@/components/leads/DetailControls';

export const dynamic = 'force-dynamic';
const one = (x: any) => (Array.isArray(x) ? x[0] : x);

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data: lead } = await supabase
    .from('leads')
    .select('*, website:websites(name,domain), form:forms(name)')
    .eq('id', id).is('deleted_at', null).maybeSingle();
  if (!lead) notFound();

  const staff = isStaffRole(ctx.active.role);
  const [{ data: notes }, { data: activity }, staffList] = await Promise.all([
    supabase.from('lead_notes').select('id,author_name,body,created_at').eq('lead_id', id).order('created_at', { ascending: false }),
    supabase.from('lead_activity').select('id,actor_name,type,meta,created_at').eq('lead_id', id).order('created_at', { ascending: false }).limit(50),
    staff ? adminClient().from('members').select('user_id,display_name,email').eq('workspace_id', lead.workspace_id).eq('status', 'active').in('role', ['owner', 'admin', 'member']) : Promise.resolve({ data: [] as any[] }),
  ]);

  const assignee = (staffList.data ?? []).find((s: any) => s.user_id === lead.assigned_to);
  const toLocalInput = lead.followup_at ? new Date(lead.followup_at).toISOString().slice(0, 16) : '';
  const fields: [string, string | null][] = [['Email', lead.email], ['Phone', lead.phone], ['Message', lead.message]];
  const describe = (a: any) => {
    const m = a.meta ?? {};
    switch (a.type) {
      case 'received': return `Received (${m.confidence ?? ''}${m.signal ? `, via ${m.signal}` : ''})`;
      case 'confirmed': return `Confirmed (${m.signal ?? 'signal'})`;
      case 'probable': return 'Marked probable';
      case 'status': return `Status changed to ${String(m.status).replace('_', ' ')}`;
      case 'assigned': return m.to ? `Assigned to ${m.to}` : 'Unassigned';
      case 'followup': return m.at ? `Follow-up set for ${formatDateTime(m.at)}` : 'Follow-up cleared';
      case 'note': return 'Added a note';
      default: return a.type;
    }
  };

  return (
    <>
      <Link href="/app/leads" className="mb-6 inline-block text-muted hover:text-ink">&larr; All leads</Link>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[44px] leading-[1.05]">{lead.name ?? lead.email ?? 'Unnamed lead'}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
            <span>{one(lead.website)?.name}</span><span>{one(lead.form)?.name}</span><span>{formatDateTime(lead.submitted_at)}</span><ConfidenceBadge confidence={lead.confidence} />
          </div>
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
        <div>
          <Section title="Submission">
            <dl className="divide-y divide-line border-y hairline">
              {fields.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="grid gap-1 py-3 sm:grid-cols-[160px_1fr]"><dt className="text-muted">{k}</dt><dd className="whitespace-pre-wrap break-words">{v}</dd></div>
              ))}
              {Object.entries((lead.data ?? {}) as Record<string, string | string[]>).map(([k, v]) => (
                <div key={k} className="grid gap-1 py-3 sm:grid-cols-[160px_1fr]"><dt className="text-muted">{k}</dt><dd className="whitespace-pre-wrap break-words">{Array.isArray(v) ? v.join(', ') : v}</dd></div>
              ))}
            </dl>
          </Section>
          <Section title="Source">
            <dl className="divide-y divide-line border-y hairline">
              {([['Page', lead.page_url], ['Referrer', lead.referrer], ['Source', lead.source], ...Object.entries((lead.utm ?? {}) as Record<string, string>)] as [string, string | null][]).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="grid gap-1 py-3 sm:grid-cols-[160px_1fr]"><dt className="text-muted">{k}</dt><dd className="break-all">{v}</dd></div>
              ))}
            </dl>
          </Section>
          <Section title="Notes">
            <NoteForm leadId={lead.id} />
            <ul className="mt-6 space-y-4">
              {(notes ?? []).map((n: any) => (
                <li key={n.id} className="border-l-2 border-accent pl-4"><p className="whitespace-pre-wrap break-words">{n.body}</p><p className="mt-1 text-[12px] text-muted">{n.author_name} - {formatDateTime(n.created_at)}</p></li>
              ))}
            </ul>
          </Section>
        </div>

        <aside className="space-y-6">
          <div><label className="label">Status</label><StatusControl id={lead.id} status={lead.status} canUpdate /></div>
          {staff && <div><label className="label">Assigned to</label><AssignControl id={lead.id} assigned={lead.assigned_to} staff={(staffList.data ?? []).map((s: any) => ({ user_id: s.user_id, name: s.display_name ?? s.email }))} />{assignee && <p className="mt-1 text-[12px] text-muted">{assignee.display_name ?? assignee.email}</p>}</div>}
          <div><label className="label">Follow-up</label><FollowupControl id={lead.id} value={toLocalInput} canUpdate /></div>
          <div>
            <h2 className="mb-3 text-[14px] font-semibold">Activity</h2>
            <ol className="space-y-3 border-l hairline pl-4">
              {(activity ?? []).map((a: any) => (
                <li key={a.id} className="relative"><span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-accent" /><p>{describe(a)}</p><p className="text-[12px] text-muted">{a.actor_name ? `${a.actor_name} - ` : ''}{formatDateTime(a.created_at)}</p></li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </>
  );
}
