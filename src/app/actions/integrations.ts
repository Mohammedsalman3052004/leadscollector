'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { actionContext } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';
import { audit } from '@/lib/audit';
import { isEmail, splitList, str } from '@/lib/forms';
import { upsertEmailIntegration } from '@/lib/integrations';
import { parseSpreadsheetId } from '@/lib/delivery/sheets';
import { runDeliveries } from '@/lib/delivery/run';
import type { ActionState } from '@/lib/types';

export async function saveWorkspaceEmail(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext('manager');
  if (!ctx) return { error: 'You do not have permission to do that.' };
  const recipients = splitList(str(fd, 'recipients', 2000)).map((e) => e.toLowerCase());
  if (recipients.some((e) => !isEmail(e))) return { error: 'One of the email addresses is not valid.' };
  if (recipients.length > 10) return { error: 'Use at most 10 recipients.' };
  await upsertEmailIntegration(ctx.active.workspace.id, null, recipients, fd.get('enabled') === 'on');
  await audit(ctx.active.workspace.id, ctx.user.id, 'integration.email.saved');
  revalidatePath('/app/integrations');
  return { ok: true, message: 'Email notifications saved.' };
}

export async function saveSheetConfig(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext('manager');
  if (!ctx) return { error: 'You do not have permission to do that.' };
  const id = parseSpreadsheetId(str(fd, 'spreadsheet', 300));
  const sheet = str(fd, 'sheet_name', 80) || 'Leads';
  if (!id) return { error: 'Paste the Google Sheets link (or the spreadsheet ID).' };
  const { data } = await adminClient().from('integrations').update({ config: { spreadsheet_id: id, sheet_name: sheet }, status: 'active', last_error: null })
    .eq('id', str(fd, 'integration_id', 40)).eq('workspace_id', ctx.active.workspace.id).eq('type', 'google_sheets').select('id');
  if (!data?.length) return { error: 'Connect Google first.' };
  await adminClient().from('deliveries').update({ status: 'pending', attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null })
    .eq('integration_id', data[0].id).eq('status', 'failed').like('last_error', 'Spreadsheet is not configured%');
  await audit(ctx.active.workspace.id, ctx.user.id, 'integration.sheets.configured', data[0].id);
  revalidatePath('/app/integrations');
  return { ok: true, message: 'Sheet saved. New leads will sync automatically.' };
}

export async function disconnectIntegration(fd: FormData) {
  const ctx = await actionContext('manager');
  if (!ctx) return;
  await adminClient().from('integrations').delete().eq('id', str(fd, 'integration_id', 40)).eq('workspace_id', ctx.active.workspace.id).eq('type', 'google_sheets');
  await audit(ctx.active.workspace.id, ctx.user.id, 'integration.sheets.disconnected');
  revalidatePath('/app/integrations');
}

export async function retryDelivery(fd: FormData) {
  const ctx = await actionContext('manager');
  if (!ctx) return;
  await adminClient().from('deliveries').update({ status: 'pending', attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null })
    .eq('id', str(fd, 'delivery_id', 40)).eq('workspace_id', ctx.active.workspace.id).in('status', ['failed', 'retrying']);
  after(() => runDeliveries(5).catch(() => {}));
  revalidatePath('/app/integrations');
}
