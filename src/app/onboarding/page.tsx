import { redirect } from 'next/navigation';
import { getAppContext } from '@/lib/auth';
import { createWorkspace } from '@/app/actions/workspace';
import { ActionForm } from '@/components/action-form';
import { Field } from '@/components/ui';

export const metadata = { title: 'Create your workspace' };

export default async function Onboarding() {
  const ctx = await getAppContext();
  if (!ctx) redirect('/login');
  if (ctx.active) redirect('/app');
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="display text-2xl">Leadscollector</p>
      <h1 className="display mt-10 text-[40px] leading-none">Name your workspace</h1>
      <p className="mb-8 mt-3 text-muted">Use your agency or business name. Your clients will see it at the top of their dashboard.</p>
      <ActionForm action={createWorkspace} submit="Create workspace" pendingLabel="Creating...">
        <Field label="Workspace name"><input name="name" required minLength={2} maxLength={80} placeholder="e.g. Pinakkaa" className="field" autoFocus /></Field>
      </ActionForm>
    </main>
  );
}
