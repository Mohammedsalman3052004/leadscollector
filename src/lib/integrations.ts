import 'server-only';
import { adminClient } from '@/lib/supabase/admin';

/** One email integration per (workspace, website|null). Recipients empty or disabled => no deliveries. */
export async function upsertEmailIntegration(workspaceId: string, websiteId: string | null, recipients: string[], enabled = true) {
  const admin = adminClient();
  let q = admin.from('integrations').select('id').eq('workspace_id', workspaceId).eq('type', 'email');
  q = websiteId ? q.eq('website_id', websiteId) : q.is('website_id', null);
  const { data: existing } = await q.maybeSingle();
  const status = enabled && recipients.length ? 'active' : 'disabled';
  if (existing) {
    await admin.from('integrations').update({ config: { recipients }, status }).eq('id', existing.id);
    return existing.id as string;
  }
  if (!recipients.length) return null;
  const { data } = await admin.from('integrations').insert({
    workspace_id: workspaceId, website_id: websiteId, type: 'email', name: 'Email notifications', config: { recipients }, status,
  }).select('id').single();
  return (data?.id as string) ?? null;
}
