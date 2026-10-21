import 'server-only';
import { adminClient } from '@/lib/supabase/admin';
import { planOf } from '@/lib/plans';

export async function getUsage(workspaceId: string, planId: string) {
  const admin = adminClient();
  const plan = planOf(planId);
  const month = new Date();
  const monthStart = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const [sites, clients, team, usage, locked] = await Promise.all([
    admin.from('websites').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    admin.from('members').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('role', 'client').neq('status', 'revoked'),
    admin.from('members').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).in('role', ['owner', 'admin', 'member']).neq('status', 'revoked'),
    admin.from('usage_counters').select('lead_count').eq('workspace_id', workspaceId).eq('month', monthStart).maybeSingle(),
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('locked', true).is('deleted_at', null),
  ]);
  return {
    plan,
    websites: sites.count ?? 0,
    clients: clients.count ?? 0,
    team: team.count ?? 0,
    leads: usage.data?.lead_count ?? 0,
    locked: locked.count ?? 0,
  };
}
