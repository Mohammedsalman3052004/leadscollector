import { requireContext } from '@/lib/auth';
import { getUsage } from '@/lib/usage';
import { planOf } from '@/lib/plans';
import { AppShell } from '@/components/layout/AppShell';
import { Notice } from '@/components/ui';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const { workspace, role } = ctx.active;
  const plan = planOf(workspace.plan);
  const isClient = role === 'client';
  const usage = isClient ? null : await getUsage(workspace.id, workspace.plan);

  if (workspace.suspended && !ctx.profile?.is_platform_admin) {
    return <main className="mx-auto max-w-md px-6 py-24 text-center"><h1 className="display text-4xl">Workspace suspended</h1><p className="mt-3 text-muted">This workspace has been suspended. Please contact support.</p></main>;
  }

  return (
    <AppShell
      role={role}
      workspace={{ id: workspace.id, name: workspace.name, logo_url: workspace.logo_url }}
      workspaces={ctx.memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name }))}
      user={{ name: ctx.profile?.full_name ?? ctx.user.email, email: ctx.user.email }}
      usage={usage ? { used: usage.leads, cap: plan.leadsPerMonth, planName: plan.name } : null}
      showLogo={plan.whiteLabel || !isClient}
      poweredBy={isClient ? !plan.whiteLabel : false}
      isPlatformAdmin={!!ctx.profile?.is_platform_admin}
    >
      {usage && usage.locked > 0 && role !== 'member' && (
        <div className="mb-6"><Notice tone="warn"><b>{usage.locked} lead{usage.locked === 1 ? '' : 's'} locked.</b> You reached your {plan.name} plan limit of {plan.leadsPerMonth} leads this month. They are stored safely and unlock when you upgrade.</Notice></div>
      )}
      {children}
    </AppShell>
  );
}
