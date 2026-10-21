import { createClient } from '@/lib/supabase/server';
import { applyLeadFilters, LEAD_SELECT, parseFilters } from '@/lib/leads/query';
import { csvCell } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** CSV of the current filters. Uses the caller's session (RLS), neutralises spreadsheet formulas. */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const filters = parseFilters(sp);
  const rows: any[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await applyLeadFilters(supabase.from('leads').select(LEAD_SELECT), filters).range(from, from + 999);
    if (error || !data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }

  const custom = Array.from(new Set(rows.flatMap((r) => Object.keys(r.data ?? {}))));
  const head = ['Received', 'Website', 'Form', 'Name', 'Email', 'Phone', 'Message', 'Status', 'Confidence', 'Source', 'Page URL', ...custom];
  const one = (x: any) => (Array.isArray(x) ? x[0] : x);
  const lines = [head.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push([r.submitted_at, one(r.website)?.name, one(r.form)?.name, r.name, r.email, r.phone, r.message, r.status, r.confidence, r.source, r.page_url, ...custom.map((k) => r.data?.[k])].map(csvCell).join(','));
  }
  return new Response('\ufeff' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
