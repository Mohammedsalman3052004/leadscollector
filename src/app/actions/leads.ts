'use server';

import { revalidatePath } from 'next/cache';
import { actionContext } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { str } from '@/lib/forms';
import { LEAD_STATUSES, type ActionState } from '@/lib/types';

const valid = (s: string) => LEAD_STATUSES.some((x) => x.value === s);
const uuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export async function updateLeadStatus(id: string, status: string): Promise<{ ok: boolean }> {
  const ctx = await actionContext();
  if (!ctx || !valid(status) || !uuid(id)) return { ok: false };
  const supabase = await createClient(); // RLS decides whether this user may update this lead
  const { data } = await supabase.from('leads').update({ status }).eq('id', id).select('id');
  if (!data?.length) return { ok: false };
  await supabase.from('lead_activity').insert({ lead_id: id, actor_id: ctx.user.id, actor_name: ctx.profile?.full_name ?? ctx.user.email, type: 'status', meta: { status } });
  revalidatePath('/app/leads');
  revalidatePath(`/app/leads/${id}`);
  return { ok: true };
}

export async function bulkUpdateStatus(ids: string[], status: string): Promise<{ ok: boolean; count: number }> {
  const ctx = await actionContext();
  const clean = ids.filter(uuid).slice(0, 200);
  if (!ctx || !valid(status) || !clean.length) return { ok: false, count: 0 };
  const supabase = await createClient();
  const { data } = await supabase.from('leads').update({ status }).in('id', clean).select('id');
  const done = (data ?? []).map((r: any) => r.id as string);
  if (done.length) {
    await supabase.from('lead_activity').insert(done.map((lead_id) => ({ lead_id, actor_id: ctx.user.id, actor_name: ctx.profile?.full_name ?? ctx.user.email, type: 'status', meta: { status, bulk: true } })));
  }
  revalidatePath('/app/leads');
  return { ok: true, count: done.length };
}

/** Soft delete. Staff only (clients can never delete leads, even with "update" permission). */
export async function bulkDelete(ids: string[]): Promise<{ ok: boolean; count: number }> {
  const ctx = await actionContext('staff');
  const clean = ids.filter(uuid).slice(0, 200);
  if (!ctx || !clean.length) return { ok: false, count: 0 };
  const { data } = await adminClient().from('leads').update({ deleted_at: new Date().toISOString() }).in('id', clean).eq('workspace_id', ctx.active.workspace.id).select('id');
  revalidatePath('/app/leads');
  return { ok: true, count: data?.length ?? 0 };
}

export async function assignLead(id: string, userId: string): Promise<{ ok: boolean }> {
  const ctx = await actionContext('staff');
  if (!ctx || !uuid(id)) return { ok: false };
  const admin = adminClient();
  let name: string | null = null;
  if (userId) {
    const { data: m } = await admin.from('members').select('display_name,email').eq('workspace_id', ctx.active.workspace.id).eq('user_id', userId).eq('status', 'active').in('role', ['owner', 'admin', 'member']).maybeSingle();
    if (!m) return { ok: false };
    name = m.display_name ?? m.email;
  }
  const { data } = await admin.from('leads').update({ assigned_to: userId || null }).eq('id', id).eq('workspace_id', ctx.active.workspace.id).select('id');
  if (!data?.length) return { ok: false };
  await admin.from('lead_activity').insert({ lead_id: id, actor_id: ctx.user.id, actor_name: ctx.profile?.full_name ?? ctx.user.email, type: 'assigned', meta: { to: name } });
  revalidatePath(`/app/leads/${id}`);
  return { ok: true };
}

export async function setFollowup(id: string, date: string): Promise<{ ok: boolean }> {
  const ctx = await actionContext();
  if (!ctx || !uuid(id)) return { ok: false };
  const when = date ? new Date(date) : null;
  if (date && Number.isNaN(when!.getTime())) return { ok: false };
  const supabase = await createClient();
  const { data } = await supabase.from('leads').update({ followup_at: when ? when.toISOString() : null }).eq('id', id).select('id');
  if (!data?.length) return { ok: false };
  await supabase.from('lead_activity').insert({ lead_id: id, actor_id: ctx.user.id, actor_name: ctx.profile?.full_name ?? ctx.user.email, type: 'followup', meta: { at: when?.toISOString() ?? null } });
  revalidatePath(`/app/leads/${id}`);
  return { ok: true };
}

export async function addNote(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext();
  const id = str(fd, 'lead_id', 40);
  const body = str(fd, 'body', 4000);
  if (!ctx || !uuid(id)) return { error: 'Not allowed.' };
  if (!body) return { error: 'Write a note first.' };
  const supabase = await createClient();
  const name = ctx.profile?.full_name ?? ctx.user.email;
  const { error } = await supabase.from('lead_notes').insert({ lead_id: id, author_id: ctx.user.id, author_name: name, body });
  if (error) return { error: 'You do not have permission to add notes to this lead.' };
  await supabase.from('lead_activity').insert({ lead_id: id, actor_id: ctx.user.id, actor_name: name, type: 'note', meta: {} });
  revalidatePath(`/app/leads/${id}`);
  return { ok: true, message: 'Note added.' };
}
