'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { actionContext, getAppContext } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { audit } from '@/lib/audit';
import { str } from '@/lib/forms';
import { slugify } from '@/lib/utils';
import type { ActionState } from '@/lib/types';

const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 365 };

export async function createWorkspace(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  if (!ctx) redirect('/login');
  const name = str(fd, 'name', 80);
  if (name.length < 2) return { error: 'Give your workspace a name (for example your agency name).' };
  const supabase = await createClient();
  let id: string | null = null;
  for (let i = 0; i < 4 && !id; i++) {
    const slug = i === 0 ? slugify(name) : `${slugify(name)}-${randomBytes(2).toString('hex')}`;
    const { data, error } = await supabase.rpc('create_workspace', { p_name: name, p_slug: slug });
    if (!error) id = data as string;
    else if (!/duplicate|unique/i.test(error.message)) return { error: 'Could not create the workspace. Please try again.' };
  }
  if (!id) return { error: 'Could not create the workspace. Please try again.' };
  (await cookies()).set('lc_ws', id, cookieOpts);
  redirect('/app');
}

export async function switchWorkspace(fd: FormData) {
  const ctx = await getAppContext();
  if (!ctx) redirect('/login');
  const id = str(fd, 'workspace', 40);
  if (ctx.memberships.some((m) => m.workspace.id === id)) (await cookies()).set('lc_ws', id, cookieOpts);
  redirect('/app');
}

export async function updateWorkspace(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext('manager');
  if (!ctx) return { error: 'You do not have permission to do that.' };
  const name = str(fd, 'name', 80);
  if (name.length < 2) return { error: 'Enter a workspace name.' };
  const patch: Record<string, string> = { name };
  const file = fd.get('logo');
  if (file instanceof File && file.size > 0) {
    const allowed: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
    const ext = allowed[file.type];
    if (!ext) return { error: 'Logo must be a PNG, JPG or WebP image.' };
    if (file.size > 1_000_000) return { error: 'Logo must be smaller than 1 MB.' };
    const path = `${ctx.active.workspace.id}/logo-${Date.now()}.${ext}`;
    const admin = adminClient();
    const { error } = await admin.storage.from('logos').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });
    if (error) return { error: 'Logo upload failed. Check that the "logos" storage bucket exists.' };
    patch.logo_url = admin.storage.from('logos').getPublicUrl(path).data.publicUrl;
  }
  await adminClient().from('workspaces').update(patch).eq('id', ctx.active.workspace.id);
  await audit(ctx.active.workspace.id, ctx.user.id, 'workspace.updated');
  revalidatePath('/app', 'layout');
  return { ok: true, message: 'Workspace updated.' };
}

export async function updateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  if (!ctx) redirect('/login');
  const name = str(fd, 'full_name', 80);
  if (name.length < 2) return { error: 'Enter your name.' };
  const supabase = await createClient();
  await supabase.from('profiles').update({ full_name: name }).eq('id', ctx.user.id);
  await adminClient().from('members').update({ display_name: name }).eq('user_id', ctx.user.id);
  revalidatePath('/app', 'layout');
  return { ok: true, message: 'Profile updated.' };
}

export async function deleteWorkspace(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext('owner');
  if (!ctx) return { error: 'Only the workspace owner can delete it.' };
  if (str(fd, 'confirm', 80) !== ctx.active.workspace.slug) return { error: 'Type the workspace slug exactly to confirm.' };
  await audit(null, ctx.user.id, 'workspace.deleted', ctx.active.workspace.slug);
  await adminClient().from('workspaces').delete().eq('id', ctx.active.workspace.id);
  (await cookies()).delete('lc_ws');
  redirect('/app');
}
