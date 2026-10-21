/**
 * Tenant-isolation tests against a REAL Supabase project (migrations applied).
 * They create two workspaces and prove that users cannot read or change each other's data.
 * Run:  npm run test:rls      (needs .env.local values exported, or use `node --env-file`)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const run = process.env.RUN_RLS_TESTS === '1';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const d = run ? describe : describe.skip;

d('row level security', () => {
  let admin: SupabaseClient;
  const tag = Math.random().toString(36).slice(2, 8);
  const users: Record<string, { id: string; email: string; client?: SupabaseClient }> = {};
  const ws: Record<string, string> = {};
  const site: Record<string, string> = {};
  const lead: Record<string, string> = {};
  const pw = 'Test-password-12345';

  async function mkUser(key: string) {
    const email = `rls-${key}-${tag}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
    if (error) throw error;
    const client = createClient(url, anon, { auth: { persistSession: false } });
    const { error: e2 } = await client.auth.signInWithPassword({ email, password: pw });
    if (e2) throw e2;
    users[key] = { id: data.user.id, email, client };
  }

  beforeAll(async () => {
    admin = createClient(url, service, { auth: { persistSession: false } });
    await Promise.all(['a', 'b', 'client', 'admin'].map(mkUser));
    for (const k of ['a', 'b']) {
      const { data: w } = await admin.from('workspaces').insert({ name: `WS ${k}`, slug: `rls-${k}-${tag}`, owner_id: users[k].id, plan: 'pro' }).select('id').single();
      ws[k] = w!.id;
      await admin.from('members').insert({ workspace_id: ws[k], user_id: users[k].id, role: 'owner', status: 'active', display_name: k, email: users[k].email });
      for (const n of [1, 2]) {
        const { data: s } = await admin.from('websites').insert({ workspace_id: ws[k], name: `${k}${n}`, domain: `${k}${n}-${tag}.test` }).select('id').single();
        site[`${k}${n}`] = s!.id;
        const { data: l } = await admin.from('leads').insert({ workspace_id: ws[k], website_id: s!.id, name: `Lead ${k}${n}`, email: `${k}${n}@x.test`, confidence: 'confirmed' }).select('id').single();
        lead[`${k}${n}`] = l!.id;
      }
    }
    // client of workspace A, only website a1
    const { data: m } = await admin.from('members').insert({ workspace_id: ws.a, user_id: users.client.id, role: 'client', status: 'active', display_name: 'c', email: users.client.email }).select('id').single();
    await admin.from('website_access').insert({ website_id: site.a1, member_id: m!.id, permission: 'view' });
    await admin.from('profiles').update({ is_platform_admin: true }).eq('id', users.admin.id);
  });

  afterAll(async () => {
    if (!admin) return;
    for (const k of ['a', 'b']) if (ws[k]) await admin.from('workspaces').delete().eq('id', ws[k]);
    for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  });

  it('a user cannot read another workspace, website or lead', async () => {
    const a = users.a.client!;
    expect((await a.from('workspaces').select('id')).data?.map((r) => r.id)).toEqual([ws.a]);
    expect((await a.from('websites').select('id').eq('workspace_id', ws.b)).data).toEqual([]);
    expect((await a.from('leads').select('id').eq('id', lead.b1)).data).toEqual([]);
  });

  it('a user cannot update or delete another tenant\'s lead', async () => {
    const a = users.a.client!;
    const upd = await a.from('leads').update({ status: 'lost' }).eq('id', lead.b1).select('id');
    expect(upd.data ?? []).toEqual([]);
    await a.from('leads').delete().eq('id', lead.b1);
    expect((await admin.from('leads').select('id,status').eq('id', lead.b1).single()).data?.status).toBe('new');
  });

  it('a client sees only the one website they were granted', async () => {
    const c = users.client.client!;
    expect((await c.from('websites').select('id')).data?.map((r) => r.id)).toEqual([site.a1]);
    expect((await c.from('leads').select('id')).data?.map((r) => r.id)).toEqual([lead.a1]);
    expect((await c.from('leads').select('id').eq('id', lead.a2)).data).toEqual([]);
  });

  it('a client cannot read secrets, integrations, members or other clients', async () => {
    const c = users.client.client!;
    expect((await c.from('websites').select('webhook_secret')).error).not.toBeNull();
    expect((await c.from('integrations').select('id')).data ?? []).toEqual([]);
    expect((await c.from('members').select('id')).data?.length).toBe(1); // only themselves
  });

  it('nobody can change a plan, move a lead or write columns outside the allow-list', async () => {
    const a = users.a.client!;
    expect((await a.from('workspaces').update({ plan: 'free' }).eq('id', ws.a)).error).not.toBeNull();
    expect((await a.from('leads').update({ website_id: site.b1 }).eq('id', lead.a1)).error).not.toBeNull();
    expect((await a.from('leads').update({ name: 'tampered' }).eq('id', lead.a1)).error).not.toBeNull();
    expect((await a.from('websites').insert({ workspace_id: ws.a, name: 'x', domain: 'x.test' })).error).not.toBeNull();
  });

  it('a platform admin cannot read leads without a support grant, and can with one', async () => {
    const adm = users.admin.client!;
    expect((await adm.from('leads').select('id').eq('workspace_id', ws.a)).data ?? []).toEqual([]);
    await admin.from('admin_support_access').insert({ admin_id: users.admin.id, workspace_id: ws.a, reason: 'rls test grant', expires_at: new Date(Date.now() + 3600_000).toISOString() });
    expect(((await adm.from('leads').select('id').eq('workspace_id', ws.a)).data ?? []).length).toBe(2);
    expect((await adm.from('leads').select('id').eq('workspace_id', ws.b)).data ?? []).toEqual([]);
  });

  it('service-only functions are not callable by users', async () => {
    const a = users.a.client!;
    expect((await a.rpc('ingest_lead', { p: {} })).error).not.toBeNull();
    expect((await a.rpc('claim_deliveries', { p_limit: 1 })).error).not.toBeNull();
  });
});
