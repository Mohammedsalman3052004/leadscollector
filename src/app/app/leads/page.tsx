import Link from 'next/link';
import { requireContext, isStaffRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { applyLeadFilters, LEAD_SELECT, PAGE_SIZE, parseFilters } from '@/lib/leads/query';
import { formatDateTime } from '@/lib/utils';
import { EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { LeadsTable, type LeadRowView } from '@/components/leads/LeadsTable';
import { LEAD_STATUSES } from '@/lib/types';

export const metadata = { title: 'Leads' };
export const dynamic = 'force-dynamic';
const one = (x: any) => (Array.isArray(x) ? x[0] : x);

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const f = parseFilters(sp);
  const supabase = await createClient();
  const page = f.page ?? 1;
  const from = (page - 1) * PAGE_SIZE;

  const [{ data, count }, { data: sites }, { data: sources }] = await Promise.all([
    applyLeadFilters(supabase.from('leads').select(LEAD_SELECT, { count: 'exact' }), f).range(from, from + PAGE_SIZE - 1),
    supabase.from('websites').select('id,name').order('name'),
    supabase.from('leads').select('source').is('deleted_at', null).limit(1000),
  ]);

  const rows: LeadRowView[] = ((data ?? []) as any[]).map((l) => ({
    id: l.id, name: l.name, email: l.email, phone: l.phone, message: l.message,
    website: one(l.website)?.name ?? '-', form: one(l.form)?.name ?? 'Form', status: l.status, confidence: l.confidence,
    received: formatDateTime(l.submitted_at), source: l.source, page_url: l.page_url, data: l.data ?? {},
  }));
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sourceList = Array.from(new Set(((sources ?? []) as any[]).map((s) => s.source).filter(Boolean))).sort() as string[];

  const qs = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string | undefined> = { q: f.q, website: f.website, status: f.status, confidence: f.confidence, source: f.source, from: f.from, to: f.to, sort: f.sort };
    for (const [k, v] of Object.entries({ ...cur, ...over })) if (v !== undefined && v !== '') p.set(k, String(v));
    return p.toString();
  };
  const hasFilters = !!(f.q || f.website || f.status || f.source || f.from || f.to || (f.confidence && f.confidence !== 'visible'));

  return (
    <>
      <PageHeader title="Leads" description={`${total.toLocaleString('en-US')} ${total === 1 ? 'lead' : 'leads'}${hasFilters ? ' match your filters' : ''}.`}
        actions={<a href={`/api/leads/export?${qs({})}`} className="inline-flex h-10 items-center rounded-md border border-line bg-surface px-4 font-medium hover:bg-tint">Export CSV</a>} />

      <form className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6" role="search">
        <input name="q" defaultValue={f.q} placeholder="Search" aria-label="Search" className="field lg:col-span-2" />
        <select name="website" defaultValue={f.website ?? ''} aria-label="Website" className="field"><option value="">All websites</option>{(sites ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select name="status" defaultValue={f.status ?? ''} aria-label="Status" className="field"><option value="">All statuses</option>{LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        <select name="source" defaultValue={f.source ?? ''} aria-label="Source" className="field"><option value="">All sources</option>{sourceList.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select name="confidence" defaultValue={f.confidence ?? 'visible'} aria-label="Confirmation" className="field"><option value="visible">Confirmed and probable</option><option value="attempted">Unconfirmed attempts</option><option value="all">Everything</option></select>
        <input type="date" name="from" defaultValue={f.from} aria-label="From date" className="field" />
        <input type="date" name="to" defaultValue={f.to} aria-label="To date" className="field" />
        <select name="sort" defaultValue={f.sort ?? 'newest'} aria-label="Sort" className="field"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A-Z</option></select>
        <div className="flex gap-2 lg:col-span-2"><button className="inline-flex h-10 items-center rounded-md bg-ink px-4 font-medium text-white">Apply</button>{hasFilters && <Link href="/app/leads" className="inline-flex h-10 items-center px-3 text-muted hover:text-ink">Clear</Link>}</div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={hasFilters ? 'No leads match' : 'No leads yet'} description={hasFilters ? 'Try removing a filter.' : 'Once a form on a connected website is submitted, it shows up here.'}
          action={!hasFilters && ctx.active.role !== 'client' ? <LinkButton href="/app/websites/new">Add a website</LinkButton> : undefined} />
      ) : (
        <>
          <LeadsTable rows={rows} canUpdate canDelete={isStaffRole(ctx.active.role)} />
          {pages > 1 && (
            <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
              <span className="text-muted">Page {page} of {pages}</span>
              <div className="flex gap-2">
                {page > 1 && <Link className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-3 hover:bg-tint" href={`/app/leads?${qs({ page: page - 1 })}`}>Previous</Link>}
                {page < pages && <Link className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-3 hover:bg-tint" href={`/app/leads?${qs({ page: page + 1 })}`}>Next</Link>}
              </div>
            </nav>
          )}
        </>
      )}
    </>
  );
}
