'use server';

import { revalidatePath } from 'next/cache';
import { getAppContext } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';
import { audit } from '@/lib/audit';
import { str } from '@/lib/forms';
import type { ActionState } from '@/lib/types';

async function platformAdmin() {
  const ctx = await getAppContext();
  return ctx?.profile?.is_platform_admin ? ctx : null;
}

/** Admins can only read customer lead contents through an explicit, time-limited, logged grant. */
export async function grantSupportAccess(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await platformAdmin();
  if (!ctx) return { error: 'Forbidden.' };
  const workspaceId = str(fd, 'workspace_id', 40);
  const reason = str(fd, 'reason', 500);
  const hours = Math.min(72, Math.max(1, Number(str(fd, 'hours', 3)) || 1));
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return { error: 'Choose a workspace.' };
  if (reason.length < 10) return { error: 'Give a reason (at least 10 characters). It is recorded in the audit log.' };
  await adminClient().from('admin_support_access').insert({ admin_id: ctx.user.id, workspace_id: workspaceId, reason, expires_at: new Date(Date.now() + hours * 3600_000).toISOString() });
  await audit(workspaceId, ctx.user.id, 'admin.support_access.granted', undefined, { reason, hours });
  revalidatePath('/admin/settings');
  return { ok: true, message: `Access granted for ${hours} hour${hours === 1 ? '' : 's'}.` };
}

export async function setWorkspaceSuspended(fd: FormData) {
  const ctx = await platformAdmin();
  if (!ctx) return;
  const id = str(fd, 'id', 40);
  const suspended = str(fd, 'suspended', 5) === 'true';
  await adminClient().from('workspaces').update({ suspended }).eq('id', id);
  await audit(id, ctx.user.id, suspended ? 'admin.workspace.suspended' : 'admin.workspace.unsuspended');
  revalidatePath('/admin/workspaces');
}

export async function setWebsiteDisabled(fd: FormData) {
  const ctx = await platformAdmin();
  if (!ctx) return;
  const id = str(fd, 'id', 40);
  const disabled = str(fd, 'disabled', 5) === 'true';
  const { data } = await adminClient().from('websites').update({ status: disabled ? 'disabled' : 'pending' }).eq('id', id).select('workspace_id').maybeSingle();
  await audit(data?.workspace_id ?? null, ctx.user.id, disabled ? 'admin.website.suspended' : 'admin.website.unsuspended', id);
  revalidatePath('/admin/websites');
}

export async function setWorkspacePlan(fd: FormData) {
  const ctx = await platformAdmin();
  if (!ctx) return;
  const id = str(fd, 'id', 40);
  const plan = str(fd, 'plan', 5) === 'pro' ? 'pro' : 'free';
  await adminClient().from('workspaces').update({ plan }).eq('id', id);
  if (plan === 'pro') await adminClient().rpc('release_locked_leads', { p_ws: id });
  await audit(id, ctx.user.id, 'admin.workspace.plan_changed', undefined, { plan });
  revalidatePath('/admin/workspaces');
}
