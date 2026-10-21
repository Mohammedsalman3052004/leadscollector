import 'server-only';
import { adminClient } from '@/lib/supabase/admin';

export async function audit(workspaceId: string | null, actorId: string | null, action: string, target?: string, meta: Record<string, unknown> = {}) {
  try {
    await adminClient().from('audit_log').insert({ workspace_id: workspaceId, actor_id: actorId, action, target: target ?? null, meta });
  } catch {
    /* auditing must never break the request */
  }
}
