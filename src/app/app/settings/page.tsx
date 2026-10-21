import { requireContext, isManagerRole } from '@/lib/auth';
import { updateProfile, updateWorkspace, deleteWorkspace } from '@/app/actions/workspace';
import { updatePassword } from '@/app/actions/auth';
import { ActionForm } from '@/components/action-form';
import { Field, LinkButton, PageHeader, Section } from '@/components/ui';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function Settings() {
  const ctx = await requireContext();
  const { workspace, role } = ctx.active;
  const manager = isManagerRole(role);

  return (
    <>
      <PageHeader title="Settings" />
      <Section title="Profile">
        <ActionForm action={updateProfile} submit="Save profile" className="max-w-md space-y-4">
          <Field label="Your name"><input name="full_name" defaultValue={ctx.profile?.full_name ?? ''} required className="field" /></Field>
          <Field label="Email"><input value={ctx.user.email} disabled className="field" readOnly /></Field>
        </ActionForm>
      </Section>

      <Section title="Security" description="Choose a strong password of at least 10 characters.">
        <ActionForm action={updatePassword} submit="Change password" className="max-w-md space-y-4">
          <Field label="New password"><input name="password" type="password" minLength={10} required autoComplete="new-password" className="field" /></Field>
          <Field label="Confirm password"><input name="confirm" type="password" minLength={10} required autoComplete="new-password" className="field" /></Field>
        </ActionForm>
      </Section>

      {manager && (
        <Section title="Workspace" description="Your workspace name and logo appear at the top of every client dashboard (logo on the Pro plan).">
          <ActionForm action={updateWorkspace} submit="Save workspace" className="max-w-md space-y-4">
            <Field label="Workspace name"><input name="name" defaultValue={workspace.name} required className="field" /></Field>
            <Field label="Logo (PNG, JPG or WebP, max 1 MB)">
              {workspace.logo_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={workspace.logo_url} alt="Current logo" className="mb-3 h-12 w-12 rounded-md object-cover" />}
              <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="field h-auto py-2" />
            </Field>
          </ActionForm>
        </Section>
      )}

      {role === 'owner' && (
        <>
          <Section title="Your data" description="Download everything in this workspace (websites, leads, notes, members) as JSON.">
            <LinkButton href="/api/export" variant="secondary">Export workspace data</LinkButton>
          </Section>
          <Section title="Delete workspace" description="Permanently deletes this workspace, its websites and all leads. This cannot be undone.">
            <ActionForm action={deleteWorkspace} submit="Delete workspace" variant="danger" className="max-w-md space-y-4">
              <Field label={`Type "${workspace.slug}" to confirm`}><input name="confirm" className="field" autoComplete="off" /></Field>
            </ActionForm>
          </Section>
        </>
      )}
    </>
  );
}
