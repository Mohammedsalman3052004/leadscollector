'use client';

import { useActionState, useState, useTransition } from 'react';
import { addNote, assignLead, setFollowup, updateLeadStatus } from '@/app/actions/leads';
import { SubmitButton } from '@/components/submit-button';
import { Notice } from '@/components/ui';
import { LEAD_STATUSES } from '@/lib/types';

export function StatusControl({ id, status, canUpdate }: { id: string; status: string; canUpdate: boolean }) {
  const [pending, start] = useTransition();
  return (
    <select aria-label="Status" disabled={!canUpdate || pending} defaultValue={status} className="field" onChange={(e) => start(async () => { await updateLeadStatus(id, e.target.value); })}>
      {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </select>
  );
}

export function AssignControl({ id, assigned, staff }: { id: string; assigned: string | null; staff: { user_id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <select aria-label="Assignee" disabled={pending} defaultValue={assigned ?? ''} className="field" onChange={(e) => start(async () => { await assignLead(id, e.target.value); })}>
      <option value="">Unassigned</option>
      {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
    </select>
  );
}

export function FollowupControl({ id, value, canUpdate }: { id: string; value: string; canUpdate: boolean }) {
  const [pending, start] = useTransition();
  const [v, setV] = useState(value);
  return (
    <div className="flex gap-2">
      <input type="datetime-local" aria-label="Follow-up" className="field" value={v} disabled={!canUpdate} onChange={(e) => setV(e.target.value)} />
      <button type="button" disabled={!canUpdate || pending} className="inline-flex h-10 items-center rounded-md border border-line bg-surface px-3 hover:bg-tint disabled:opacity-50"
        onClick={() => start(async () => { await setFollowup(id, v ? new Date(v).toISOString() : ''); })}>{pending ? '...' : 'Set'}</button>
    </div>
  );
}

export function NoteForm({ leadId }: { leadId: string }) {
  const [state, action] = useActionState(addNote, null);
  return (
    <form action={action} className="space-y-3" key={state?.ok ? Date.now() : 'n'}>
      <input type="hidden" name="lead_id" value={leadId} />
      <label className="sr-only" htmlFor="note">Internal note</label>
      <textarea id="note" name="body" required maxLength={4000} placeholder="Add an internal note (only your team and permitted clients can see it)" className="field" />
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <SubmitButton variant="secondary">Add note</SubmitButton>
    </form>
  );
}
