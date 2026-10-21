export const PAGE_SIZE = 25;

export interface LeadFilters {
  q?: string;
  website?: string;
  status?: string;
  confidence?: string; // visible (default) | all | attempted
  source?: string;
  from?: string;
  to?: string;
  sort?: string;
  page?: number;
}

export const LEAD_SELECT =
  'id,name,email,phone,message,data,status,confidence,signal,source,page_url,referrer,utm,submitted_at,website_id,form_id,assigned_to,followup_at,website:websites(name,domain),form:forms(name)';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** Applies filters to a Supabase query builder (typed loosely on purpose). */
export function applyLeadFilters(qb: any, f: LeadFilters) {
  qb = qb.is('deleted_at', null);
  if (f.confidence === 'attempted') qb = qb.eq('confidence', 'attempted');
  else if (f.confidence !== 'all') qb = qb.neq('confidence', 'attempted');
  if (f.website && /^[0-9a-f-]{36}$/i.test(f.website)) qb = qb.eq('website_id', f.website);
  if (f.status && ['new', 'contacted', 'follow_up', 'qualified', 'converted', 'lost'].includes(f.status)) qb = qb.eq('status', f.status);
  if (f.source) qb = qb.eq('source', f.source.slice(0, 100));
  if (f.from && isoDate.test(f.from)) qb = qb.gte('submitted_at', f.from + 'T00:00:00Z');
  if (f.to && isoDate.test(f.to)) qb = qb.lte('submitted_at', f.to + 'T23:59:59Z');
  const q = (f.q ?? '').replace(/[^\p{L}\p{N}@.+\- _]/gu, '').trim().toLowerCase().slice(0, 80);
  if (q) qb = qb.ilike('search_text', `%${q.replace(/_/g, '\\_')}%`);
  const sort = f.sort ?? 'newest';
  if (sort === 'oldest') qb = qb.order('submitted_at', { ascending: true });
  else if (sort === 'name') qb = qb.order('name', { ascending: true, nullsFirst: false });
  else qb = qb.order('submitted_at', { ascending: false });
  return qb;
}

export function parseFilters(sp: Record<string, string | string[] | undefined>): LeadFilters {
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    q: one('q'), website: one('website'), status: one('status'), confidence: one('confidence'),
    source: one('source'), from: one('from'), to: one('to'), sort: one('sort'),
    page: Math.max(1, Number(one('page')) || 1),
  };
}
