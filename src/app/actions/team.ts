'use server';

import { revalidatePath } from 'next/cache';
import { actionContext } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';
import { audit } from '@/lib/audit';
import { randomPassword } from '@/lib/crypto';
import { inviteEmail, sendEmail, emailConfigured } from '@/lib/email';
import { isEmail, str } from '@/lib/forms';
import { getUsage } from '@/lib/usage';
import { appUrl } from '@/lib/utils';
import type { ActionState } from '@/lib/types';

const uuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/**
 * Creates a login for a teammate or a client.
 *  - method "password": account is created with a password the agency shares (shown once)
 *  - method "invite":   a styled invite link is emailed (or shown if email is not configured)
 * Clients are linked to exactly ONE website through website_access.
 */
export async function createMemberLogin(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext('manager');
  if (!ctx) return { error: 'You do not have permission to do that.' };
  const ws = ctx.active.workspace;
  const kind = str(fd, 'kind', 10) === 'staff' ? 'staff' : 'client';
  const name = str(fd, 'name', 80);
  const email = str(fd, 'email', 254).toLowerCase();
  const method = str(fd, 'method', 10) === 'invite' ? 'invite' : 'password';
  if (name.length < 2) return { error: 'Enter the person\'s name.' };
  if (!isEmail(email)) return { error: 'Enter a valid email address.' };

  const usage = await getUsage(ws.id, ws.plan);
  let websiteId: string | null = null;
  let permission: 'view' | 'update' = 'view';
  let role: 'client' | 'admin' | 'member' = 'client';
  if (kind === 'client') {
    if (usage.plan.clientLogins === 0) return { error: 'Client logins are a Pro feature. Upgrade to give clients their own dashboard.' };
    if (usage.clients >= usage.plan.clientLogins) return { error: `Your plan allows ${usage.plan.clientLogins} client logins.` };
    websiteId = str(fd, 'website_id', 40);
    if (!uuid(websiteId)) return { error: 'Choose the website this client can access.' };
    const { data: site } = await adminClient().from('websites').select('id').eq('id', websiteId).eq('workspace_id', ws.id).maybeSingle();
    if (!site) return { error: 'Website not found.' };
    permission = str(fd, 'permission', 10) === 'update' ? 'update' : 'view';
  } else {
    if (usage.team >= usage.plan.teamMembers) return { error: `Your ${usage.plan.name} plan allows ${usage.plan.teamMembers} team member${usage.plan.teamMembers === 1 ? '' : 's'}.` };
    role = str(fd, 'role', 10) === 'admin' ? 'admin' : 'member';
  }

  const admin = adminClient();
  const { data: existingProfile } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
  let userId = existingProfile?.id as string | undefined;
  let managed = false;
  let password: string | undefined;
  let inviteLink: string | undefined;

  if (userId) {
    const { data: m } = await admin.from('members').select('id,role,status').eq('workspace_id', ws.id).eq('user_id', userId).maybeSingle();
    if (m && m.status !== 'revoked') return { error: 'This person already has access to this workspace.' };
    if (m?.role === 'owner') return { error: 'This person owns the workspace.' };
  } else {
    if (method === 'password') {
      password = str(fd, 'password', 100) || randomPassword();
      if (password.length < 10) return { error: 'Use a password of at least 10 characters.' };
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
      if (error || !data.user) return { error: error?.message ?? 'Could not create the login.' };
      userId = data.user.id;
    } else {
      const { data, error } = await admin.auth.admin.generateLink({ type: 'invite', email, options: { data: { full_name: name } } });
      if (error || !data.user) return { error: error?.message ?? 'Could not create the invite.' };
      userId = data.user.id;
      inviteLink = `${appUrl()}/auth/confirm?token_hash=${data.properties.hashed_token}&type=invite&next=/reset-password`;
    }
    managed = true;
  }

  const row = { workspace_id: ws.id, user_id: userId!, role, status: 'active', display_name: name, email, managed, invited_by: ctx.user.id };
  const { data: member, error: mErr } = await admin.from('members').upsert(row, { onConflict: 'workspace_id,user_id' }).select('id').single();
  if (mErr || !member) return { error: 'Could not add this person to the workspace.' };
  if (websiteId) {
    await admin.from('website_access').delete().eq('member_id', member.id);
    await admin.from('website_access').insert({ website_id: websiteId, member_id: member.id, permission });
  }

  let emailed = false;
  if (inviteLink && emailConfigured()) {
    try {
      await sendEmail({ to: [email], ...inviteEmail({ workspace: ws.name, inviter: ctx.profile?.full_name ?? ctx.user.email, link: inviteLink }) });
      emailed = true;
    } catch { /* fall back to showing the link */ }
  }
  await audit(ws.id, ctx.user.id, `member.${kind}.created`, member.id, { email, role, websiteId });
  revalidatePath('/app/team');
  return {
    ok: true,
    message: userId && !password && !inviteLink ? 'Existing account added. They can sign in with their current password.' : 'Login created.',
    data: { email, password, inviteLink: emailed ? undefined : inviteLink, emailed, loginUrl: `${appUrl()}/login` },
  };
}

export async function resetMemberPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext('manager');
  if (!ctx) return { error: 'You do not have permission to do that.' };
  const id = str(fd, 'member_id', 40);
  if (!uuid(id)) return { error: 'Member not found.' };
  const admin = adminClient();
  const { data: m } = await admin.from('members').select('id,user_id,email,managed,role').eq('id', id).eq('workspace_id', ctx.active.workspace.id).maybeSingle();
  // Security: only accounts this workspace created can have their password set by the workspace.
  if (!m || !m.managed || m.role === 'owner') return { error: 'You can only reset passwords for logins created by this workspace. Ask the person to use "Forgot password".' };
  const password = randomPassword();
  const { error } = await admin.auth.admin.updateUserById(m.user_id, { password });
  if (error) return { error: 'Could not reset the password.' };
  await audit(ctx.active.workspace.id, ctx.user.id, 'member.password_reset', m.id);
  return { ok: true, message: 'Password reset.', data: { email: m.email, password, loginUrl: `${appUrl()}/login` } };
}

export async function revokeMember(fd: FormData) {
  const ctx = await actionContext('manager');
  if (!ctx) return;
  const id = str(fd, 'member_id', 40);
  if (!uuid(id)) return;
  const admin = adminClient();
  const { data: m } = await admin.from('members').select('id,user_id,role').eq('id', id).eq('workspace_id', ctx.active.workspace.id).maybeSingle();
  if (!m || m.role === 'owner' || m.user_id === ctx.user.id) return;
  await admin.from('members').update({ status: 'revoked' }).eq('id', m.id);
  await admin.from('website_access').delete().eq('member_id', m.id);
  await audit(ctx.active.workspace.id, ctx.user.id, 'member.revoked', m.id);
  revalidatePath('/app/team');
}

export async function updateClientAccess(fd: FormData) {
  const ctx = await actionContext('manager');
  if (!ctx) return;
  const memberId = str(fd, 'member_id', 40);
  const permission = str(fd, 'permission', 10) === 'update' ? 'update' : 'view';
  if (!uuid(memberId)) return;
  const admin = adminClient();
  const { data: m } = await admin.from('members').select('id').eq('id', memberId).eq('workspace_id', ctx.active.workspace.id).eq('role', 'client').maybeSingle();
  if (!m) return;
  await admin.from('website_access').update({ permission }).eq('member_id', m.id);
  await audit(ctx.active.workspace.id, ctx.user.id, 'member.access_updated', m.id, { permission });
  revalidatePath('/app/team');
}
