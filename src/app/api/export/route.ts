import { actionContext } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** Full workspace data export (JSON). Owner only. */
export async function GET() {
  const ctx = await actionContext('owner');
  if (!ctx) return new Response('Forbidden', { status: 403 });
  const ws = ctx.active.workspace.id;
  const admin = adminClient();
  const [websites, leads, notes, members] = await Promise.all([
    admin.from('websites').select('id,name,domain,allowed_domains,category,description,status,created_at').eq('workspace_id', ws),
    admin.from('leads').select('*').eq('workspace_id', ws).limit(50000),
    admin.from('lead_notes').select('*, lead:leads!inner(workspace_id)').eq('lead.workspace_id', ws).limit(50000),
    admin.from('members').select('role,status,display_name,email,created_at').eq('workspace_id', ws),
  ]);
  await audit(ws, ctx.user.id, 'workspace.export');
  const body = JSON.stringify({ exported_at: new Date().toISOString(), workspace: ctx.active.workspace, websites: websites.data, members: members.data, leads: leads.data, notes: (notes.data ?? []).map(({ lead, ...n }: any) => n) }, null, 2);
  return new Response(body, {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${ctx.active.workspace.slug}-export.json"`, 'Cache-Control': 'no-store' },
  });
}
