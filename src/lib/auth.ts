
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Membership, Role, WorkspaceRow } from '@/lib/types';

export interface AppContext {
  user: { id: string; email: string };
  profile: {
    full_name: string | null;
    is_platform_admin: boolean;
  } | null;
  memberships: Membership[];
  active: Membership | null;
}

export const isStaffRole = (r?: Role | null) =>
  r === 'owner' || r === 'admin' || r === 'member';

export const isManagerRole = (r?: Role | null) =>
  r === 'owner' || r === 'admin';

export const getAppContext = cache(async (): Promise<AppContext | null> => {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('[getAppContext] Auth error:', userError.message);
  }

  if (!user) {
    console.log('[getAppContext] No authenticated user.');
    return null;
  }

  const [
    { data: profile, error: profileError },
    { data: rows, error: membersError },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name,is_platform_admin')
      .eq('id', user.id)
      .maybeSingle(),

    supabase
      .from('members')
      .select(
        'id, role, workspace:workspaces(id,name,slug,logo_url,plan,suspended)'
      )
      .eq('user_id', user.id)
      .eq('status', 'active'),
  ]);

  if (profileError) {
    console.error(
      '[getAppContext] Profile query failed:',
      profileError.message
    );
  }

  if (membersError) {
    console.error(
      '[getAppContext] Membership query failed:',
      membersError.message
    );
  }

  console.log('[getAppContext] User authenticated:', Boolean(user.id));
  console.log(
    '[getAppContext] Active membership rows:',
    rows?.length ?? 0
  );

  const memberships: Membership[] = (rows ?? [])
    .filter((r: any) => r.workspace)
    .map((r: any) => ({
      id: r.id,
      role: r.role as Role,
      workspace: r.workspace as WorkspaceRow,
    }));

  const store = await cookies();
  const wanted = store.get('lc_ws')?.value;

  const active =
    memberships.find((m) => m.workspace.id === wanted) ??
    memberships[0] ??
    null;

  console.log('[getAppContext] Memberships with workspace:', memberships.length);
  console.log(
    '[getAppContext] Active workspace found:',
    Boolean(active)
  );

  return {
    user: {
      id: user.id,
      email: user.email ?? '',
    },
    profile: profile ?? null,
    memberships,
    active,
  };
});

export async function requireContext() {
  const ctx = await getAppContext();

  if (!ctx) redirect('/login');
  if (!ctx.active) redirect('/onboarding');

  return ctx as AppContext & { active: Membership };
}

export async function requireManager() {
  const ctx = await requireContext();

  if (!isManagerRole(ctx.active.role)) {
    redirect('/app');
  }

  return ctx;
}

export async function requireStaff() {
  const ctx = await requireContext();

  if (!isStaffRole(ctx.active.role)) {
    redirect('/app');
  }

  return ctx;
}

export async function requirePlatformAdmin() {
  const ctx = await getAppContext();

  if (!ctx) redirect('/login');

  if (!ctx.profile?.is_platform_admin) {
    redirect('/app');
  }

  return ctx;
}

/** For server actions: returns the context or null instead of redirecting. */
export async function actionContext(
  min: 'any' | 'staff' | 'manager' | 'owner' = 'any'
) {
  const ctx = await getAppContext();

  if (!ctx?.active) return null;

  const r = ctx.active.role;

  if (min === 'staff' && !isStaffRole(r)) return null;
  if (min === 'manager' && !isManagerRole(r)) return null;
  if (min === 'owner' && r !== 'owner') return null;

  return ctx as AppContext & { active: Membership };
}
