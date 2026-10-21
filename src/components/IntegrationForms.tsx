'use client';

import { useActionState } from 'react';
import { saveSheetConfig, saveWorkspaceEmail } from '@/app/actions/integrations';
import { SubmitButton } from '@/components/submit-button';
import { Field, Notice } from '@/components/ui';

export function EmailForm({ recipients, enabled }: { recipients: string; enabled: boolean }) {
  const [state, action] = useActionState(saveWorkspaceEmail, null);
  return (
    <form action={action} className="max-w-xl space-y-4">
      <Field label="Send an email for every confirmed lead to" hint="One address per line. Per-website addresses can also be set in each website's settings."><textarea name="recipients" rows={3} defaultValue={recipients} className="field" placeholder="leads@youragency.com" /></Field>
      <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={enabled} /> Notifications enabled</label>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.ok && <Notice tone="success">{state.message}</Notice>}
      <SubmitButton variant="secondary">Save</SubmitButton>
    </form>
  );
}

export function SheetForm({ integrationId, spreadsheet, sheetName }: { integrationId: string; spreadsheet: string; sheetName: string }) {
  const [state, action] = useActionState(saveSheetConfig, null);
  return (
    <form action={action} className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
      <input type="hidden" name="integration_id" value={integrationId} />
      <Field label="Spreadsheet link"><input name="spreadsheet" defaultValue={spreadsheet} placeholder="https://docs.google.com/spreadsheets/d/..." className="field" required /></Field>
      <Field label="Sheet tab"><input name="sheet_name" defaultValue={sheetName} className="field" /></Field>
      <SubmitButton variant="secondary">Save</SubmitButton>
      {state?.error && <div className="sm:col-span-3"><Notice tone="error">{state.error}</Notice></div>}
      {state?.ok && <div className="sm:col-span-3"><Notice tone="success">{state.message}</Notice></div>}
    </form>
  );
}
