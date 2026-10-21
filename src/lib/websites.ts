import 'server-only';
import { adminClient } from '@/lib/supabase/admin';

/** Full website row (including secrets). Caller MUST already have verified the user is a manager of workspaceId. */
export async function getWebsiteForManager(id: string, workspaceId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await adminClient().from('websites').select('*').eq('id', id).eq('workspace_id', workspaceId).maybeSingle();
  return data as any | null;
}
