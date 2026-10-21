'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { X } from 'lucide-react';
import { bulkDelete, bulkUpdateStatus, updateLeadStatus } from '@/app/actions/leads';
import { ConfidenceBadge, StatusPill, buttonClass } from '@/components/ui';
import { LEAD_STATUSES } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface LeadRowView {
  id: string; name: string | null; email: string | null; phone: string | null; message: string | null;
  website: string; form: string; status: string; confidence: string; received: string; source: string | null;
  page_url: string | null; data: Record<string, string | string[]>;
}

export function LeadsTable({ rows, canUpdate, canDelete }: { rows: LeadRowView[]; canUpdate: boolean; canDelete: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peek, setPeek] = useState<LeadRowView | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const ids = [...selected];

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <>
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md bg-tint px-4 py-2.5" role="region" aria-label="Bulk actions">
          <span className="font-medium">{selected.size} selected</span>
          {canUpdate && (
            <select aria-label="Change status of selected" className="field h-8 w-auto py-0 text-[13px]" defaultValue="" disabled={pending}
              onChange={(e) => { const v = e.target.value; if (!v) return; start(async () => { const r = await bulkUpdateStatus(ids, v); setMsg(`${r.count} updated`); setSelected(new Set()); }); e.target.value = ''; }}>
              <option value="">Set status...</option>
              {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          )}
          {canDelete && (
            <button className={buttonClass('danger', 'h-8 px-3 text-[13px]')} disabled={pending}
              onClick={() => { if (confirm(`Delete ${selected.size} lead(s)? This can be undone for 30 days by support.`)) start(async () => { const r = await bulkDelete(ids); setMsg(`${r.count} deleted`); setSelected(new Set()); }); }}>Delete</button>
          )}
          <button className="ml-auto text-[13px] text-muted hover:text-ink" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}
      {msg && <p role="status" className="mb-3 text-[13px] text-muted">{msg}</p>}

      <div className="overflow-x-auto border-y hairline">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr className="border-b hairline">
              <th className="th w-10"><input type="checkbox" aria-label="Select all" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} /></th>
              <th className="th">Name</th><th className="th">Phone</th><th className="th">Website / form</th><th className="th">Status</th><th className="th">Received</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={cn('border-t hairline first:border-t-0 hover:bg-tint/40', selected.has(r.id) && 'bg-tint/60')}>
                <td className="td"><input type="checkbox" aria-label={`Select ${r.name ?? r.email ?? 'lead'}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td className="td">
                  <button className="text-left font-medium hover:underline" onClick={() => setPeek(r)}>{r.name ?? r.email ?? 'Unnamed lead'}</button>
                  <div className="text-[12px] text-muted">{r.email}</div>
                  {r.confidence !== 'confirmed' && <div className="mt-1"><ConfidenceBadge confidence={r.confidence} /></div>}
                </td>
                <td className="td text-muted">{r.phone ?? '-'}</td>
                <td className="td text-muted">{r.website}<div className="text-[12px]">{r.form}</div></td>
                <td className="td">
                  {canUpdate ? (
                    <select aria-label="Status" defaultValue={r.status} className="field h-8 w-[130px] py-0 text-[13px]" onChange={(e) => start(async () => { await updateLeadStatus(r.id, e.target.value); })}>
                      {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  ) : <StatusPill status={r.status} />}
                </td>
                <td className="td whitespace-nowrap text-[12px] text-muted">{r.received}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {peek && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setPeek(null)} />
          <aside role="dialog" aria-label="Lead details" className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-surface p-6 shadow-pop">
            <div className="mb-6 flex items-start justify-between">
              <div><h2 className="display text-3xl leading-tight">{peek.name ?? peek.email ?? 'Unnamed lead'}</h2><div className="mt-1"><ConfidenceBadge confidence={peek.confidence} /></div></div>
              <button aria-label="Close" className="rounded-md p-2 hover:bg-tint" onClick={() => setPeek(null)}><X size={18} /></button>
            </div>
            <dl className="space-y-4">
              {([['Email', peek.email], ['Phone', peek.phone], ['Message', peek.message], ['Website', peek.website], ['Form', peek.form], ['Source', peek.source], ['Page', peek.page_url], ['Received', peek.received]] as [string, string | null][]).filter(([, v]) => v).map(([k, v]) => (
                <div key={k}><dt className="text-[12px] text-muted">{k}</dt><dd className="whitespace-pre-wrap break-words">{v}</dd></div>
              ))}
              {Object.entries(peek.data).map(([k, v]) => <div key={k}><dt className="text-[12px] text-muted">{k}</dt><dd className="whitespace-pre-wrap break-words">{Array.isArray(v) ? v.join(', ') : v}</dd></div>)}
            </dl>
            <Link href={`/app/leads/${peek.id}`} className={buttonClass('primary', 'mt-8 w-full')}>Open full page</Link>
          </aside>
        </div>
      )}
    </>
  );
}
