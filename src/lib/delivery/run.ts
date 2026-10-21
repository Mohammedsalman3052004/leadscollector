import 'server-only';
import { adminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto';
import { DeliveryError, newLeadEmail, reauthEmail, sendEmail } from '@/lib/email';
import { planOf } from '@/lib/plans';
import { appUrl } from '@/lib/utils';
import { appendLeadToSheet, refreshAccessToken } from './sheets';

const MAX_ATTEMPTS = 6;

/**
 * Outbox worker. Leads are ALWAYS stored first; this only sends copies.
 * - claim_deliveries() pre-schedules the next retry, so a crash can never lose a delivery
 * - transient errors (429/5xx/network) retry with exponential backoff, max 6 attempts
 * - expired Google auth stops retries and flags the integration (needs_reauth)
 * - email uses an idempotency key and Sheets checks the lead ID before appending
 */
export async function runDeliveries(limit = 25) {
  const admin = adminClient();
  await admin
    .from('deliveries')
    .update({ status: 'failed', last_error: 'Gave up after maximum attempts' })
    .eq('status', 'retrying')
    .gte('attempts', MAX_ATTEMPTS)
    .lte('next_attempt_at', new Date().toISOString());

  const { data: claimed, error } = await admin.rpc('claim_deliveries', { p_limit: limit });
  if (error) throw new Error(error.message);
  const results = { processed: 0, success: 0, failed: 0, retrying: 0 };

  for (const d of (claimed ?? []) as any[]) {
    results.processed++;
    try {
      await processOne(d);
      await admin.from('deliveries').update({ status: 'success', completed_at: new Date().toISOString(), last_error: null }).eq('id', d.id);
      await admin.from('integrations').update({ last_synced_at: new Date().toISOString(), last_error: null }).eq('id', d.integration_id);
      results.success++;
    } catch (e: any) {
      const err = e instanceof DeliveryError ? e : new DeliveryError(e?.message ?? 'Unknown error', false);
      const exhausted = d.attempts >= MAX_ATTEMPTS;
      if (err.permanent || err.reauth || exhausted) {
        await admin.from('deliveries').update({ status: 'failed', last_error: err.message.slice(0, 500) }).eq('id', d.id);
        results.failed++;
      } else {
        await admin.from('deliveries').update({ status: 'retrying', last_error: err.message.slice(0, 500) }).eq('id', d.id);
        results.retrying++;
      }
      await admin.from('integrations').update({ last_error: err.message.slice(0, 500) }).eq('id', d.integration_id);
    }
  }
  return results;
}

async function processOne(d: any) {
  const admin = adminClient();
  const [{ data: integ }, { data: lead }] = await Promise.all([
    admin.from('integrations').select('*').eq('id', d.integration_id).maybeSingle(),
    admin
      .from('leads')
      .select('id,workspace_id,website_id,name,email,phone,message,data,page_url,source,status,confidence,submitted_at,form:forms(name),website:websites(name),workspace:workspaces(plan,owner_id,name)')
      .eq('id', d.lead_id)
      .maybeSingle(),
  ]);
  if (!integ) throw new DeliveryError('Integration was removed', true);
  if (!lead) throw new DeliveryError('Lead no longer exists', true);
  if (integ.status === 'disabled') throw new DeliveryError('Integration is disabled', true);
  const l: any = lead;
  const formName = (Array.isArray(l.form) ? l.form[0]?.name : l.form?.name) ?? 'Form';
  const siteName = (Array.isArray(l.website) ? l.website[0]?.name : l.website?.name) ?? 'Website';
  const ws = Array.isArray(l.workspace) ? l.workspace[0] : l.workspace;

  if (integ.type === 'email') {
    const recipients: string[] = integ.config?.recipients ?? [];
    if (!recipients.length) throw new DeliveryError('No email recipients configured', true);
    const mail = newLeadEmail({
      website: siteName, form: formName,
      lead: { name: l.name, email: l.email, phone: l.phone, message: l.message, data: l.data ?? {}, page_url: l.page_url, confidence: l.confidence },
      link: `${appUrl()}/app/leads/${l.id}`,
    });
    await sendEmail({ to: recipients, ...mail, idempotencyKey: `delivery-${d.id}` });
    return;
  }

  if (integ.type === 'google_sheets') {
    if (!planOf(ws?.plan).sheets) throw new DeliveryError('Google Sheets sync requires the Pro plan', true);
    const spreadsheetId: string | undefined = integ.config?.spreadsheet_id;
    const sheetName: string = integ.config?.sheet_name || 'Leads';
    if (!spreadsheetId) throw new DeliveryError('Spreadsheet is not configured yet', true);
    if (!integ.encrypted_credentials || integ.status === 'needs_reauth') throw new DeliveryError('needs_reauth: reconnect Google', false, true);
    try {
      const creds = JSON.parse(decrypt(integ.encrypted_credentials)) as { refresh_token: string };
      const token = await refreshAccessToken(creds.refresh_token);
      await appendLeadToSheet(token, spreadsheetId, sheetName, {
        id: l.id, submitted_at: l.submitted_at, website: siteName, form: formName, name: l.name, email: l.email,
        phone: l.phone, message: l.message, status: l.status, confidence: l.confidence, page_url: l.page_url,
        source: l.source, data: l.data ?? {},
      });
    } catch (e: any) {
      if (e instanceof DeliveryError && e.reauth) await flagReauth(integ, siteName, ws?.owner_id);
      else if (e instanceof DeliveryError && e.permanent) await admin.from('integrations').update({ status: 'error' }).eq('id', integ.id);
      throw e;
    }
    return;
  }
  throw new DeliveryError(`Unknown integration type ${integ.type}`, true);
}

async function flagReauth(integ: any, siteName: string, ownerId?: string) {
  const admin = adminClient();
  if (integ.status === 'needs_reauth') return;
  await admin.from('integrations').update({ status: 'needs_reauth' }).eq('id', integ.id);
  if (!ownerId) return;
  try {
    const { data: owner } = await admin.from('profiles').select('email').eq('id', ownerId).maybeSingle();
    if (owner?.email) {
      const mail = reauthEmail({ website: siteName, link: `${appUrl()}/app/integrations` });
      await sendEmail({ to: [owner.email], ...mail });
    }
  } catch {
    /* notification is best effort */
  }
}
