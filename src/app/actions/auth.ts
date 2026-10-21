'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { appUrl, safeNext } from '@/lib/utils';
import { isEmail, str } from '@/lib/forms';
import type { ActionState } from '@/lib/types';

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, 'email', 254).toLowerCase();
  const password = String(fd.get('password') ?? '');
  if (!isEmail(email) || !password) return { error: 'Enter your email and password.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'Invalid email or password.' };
  redirect(safeNext(fd.get('next')));
}

export async function signup(_: ActionState, fd: FormData): Promise<ActionState> {
  const name = str(fd, 'name', 80);
  const email = str(fd, 'email', 254).toLowerCase();
  const password = String(fd.get('password') ?? '');
  if (name.length < 2) return { error: 'Enter your name.' };
  if (!isEmail(email)) return { error: 'Enter a valid email address.' };
  if (password.length < 10) return { error: 'Use a password of at least 10 characters.' };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: name }, emailRedirectTo: `${appUrl()}/auth/callback?next=/app` },
  });
  if (error) return { error: error.message };
  if (data.session) redirect('/app');
  return { ok: true, message: 'Check your email to confirm your address, then sign in.' };
}

export async function forgotPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, 'email', 254).toLowerCase();
  if (!isEmail(email)) return { error: 'Enter a valid email address.' };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl()}/auth/callback?next=/reset-password` });
  return { ok: true, message: 'If that address has an account, a reset link is on its way.' };
}

export async function updatePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const password = String(fd.get('password') ?? '');
  const confirm = String(fd.get('confirm') ?? '');
  if (password.length < 10) return { error: 'Use a password of at least 10 characters.' };
  if (password !== confirm) return { error: 'Passwords do not match.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { ok: true, message: 'Password updated.' };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
