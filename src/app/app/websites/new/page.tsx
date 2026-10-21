import { requireManager } from '@/lib/auth';
import { getUsage } from '@/lib/usage';
import { AddWebsiteWizard } from '@/components/websites/AddWebsiteWizard';
import { LinkButton, Notice, PageHeader } from '@/components/ui';
import { appUrl } from '@/lib/utils';

export const metadata = { title: 'Add website' };
export const dynamic = 'force-dynamic';

export default async function NewWebsite() {
  const ctx = await requireManager();
  const usage = await getUsage(ctx.active.workspace.id, ctx.active.workspace.plan);
  if (usage.websites >= usage.plan.websites) {
    return (
      <>
        <PageHeader title="Add website" />
        <Notice tone="info">Your {usage.plan.name} plan includes {usage.plan.websites} website{usage.plan.websites === 1 ? '' : 's'}. Upgrade to add more.</Notice>
        <div className="mt-6"><LinkButton href="/app/billing">See plans</LinkButton></div>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Add website" description="Three quick steps: details, install, verify." />
      <AddWebsiteWizard appUrl={appUrl()} defaultEmail={ctx.user.email} />
    </>
  );
}
