'use client';

import { useActionState, useState } from 'react';
import { createMemberLogin, resetMemberPassword } from '@/app/actions/team';
import { SubmitButton } from '@/components/submit-button';
import { CopyButton } from '@/components/copy-button';
import { Field, Notice, buttonClass } from '@/components/ui';
import type { ActionState } from '@/lib/types';

function Credentials({ state }: { state: NonNullable<ActionState> }) {
  const d = state.data ?? {};
  const text = d.password ? `Dashboard: ${d.loginUrl}\nEmail: ${d.email}\nPassword: ${d.password}` : d.inviteLink ? `Invite link: ${d.inviteLink}` : '';
  return (
    <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4" role="status">
      <p className="font-medium text-green-900">{state.message}</p>
      {d.emailed && <p className="text-[13px] text-green-900">An invite email was sent to {d.email}.</p>}
      {text && (
        <>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-surface p-3 font-mono text-[12.5px]">{text}</pre>
          <div className="flex items-center justify-between gap-3"><p className="text-[12px] text-green-900">Shown once. Share it securely; it cannot be viewed again.</p><CopyButton text={text} label="Copy" /></div>
        </>
      )}
    </div>
  );
}

export function CreateLoginForm({ websites, canClient, canStaff }: { websites: { id: string; name: string }[]; canClient: boolean; canStaff: boolean }) {
  const [state, action] = useActionState(createMemberLogin, null);
  const [kind, setKind] = useState<'client' | 'staff'>(canClient || !canStaff ? 'client' : 'staff');
  const [method, setMethod] = useState<'password' | 'invite'>('password');
  return (
    <form action={action} className="max-w-xl space-y-5">
      <fieldset className="flex gap-6">
        <legend className="label">Type of login</legend>
        <label className="flex items-center gap-2"><input type="radio" name="kind" value="client" checked={kind === 'client'} onChange={() => setKind('client')} /> Client (one website)</label>
        <label className="flex items-center gap-2"><input type="radio" name="kind" value="staff" checked={kind === 'staff'} onChange={() => setKind('staff')} /> Team member</label>
      </fieldset>
      {kind === 'client' && !canClient && <Notice tone="info">Client logins are available on the Pro plan or when under your plan limit.</Notice>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name"><input name="name" required minLength={2} className="field" placeholder="Priya Raman" /></Field>
        <Field label="Email"><input name="email" type="email" required className="field" placeholder="priya@client.com" /></Field>
      </div>
      {kind === 'client' ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Website they can see"><select name="website_id" required className="field" defaultValue=""><option value="" disabled>Choose a website</option>{websites.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
          <Field label="Permission"><select name="permission" className="field" defaultValue="view"><option value="view">View only</option><option value="update">Can update status and add notes</option></select></Field>
        </div>
      ) : (
        <Field label="Role"><select name="role" className="field" defaultValue="member"><option value="member">Team member</option><option value="admin">Admin (manages websites, team and integrations)</option></select></Field>
      )}
      <fieldset className="space-y-2">
        <legend className="label">How should they get access?</legend>
        <label className="flex items-start gap-2"><input type="radio" name="method" value="password" checked={method === 'password'} onChange={() => setMethod('password')} className="mt-1" /><span><b>Create an ID and password</b> and share it yourself</span></label>
        <label className="flex items-start gap-2"><input type="radio" name="method" value="invite" checked={method === 'invite'} onChange={() => setMethod('invite')} className="mt-1" /><span><b>Send an invite link</b> so they choose their own password</span></label>
      </fieldset>
      {method === 'password' && <Field label="Password (optional)" hint="Leave empty to generate a strong one. Minimum 10 characters."><input name="password" minLength={10} className="field font-mono" autoComplete="off" /></Field>}
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.ok && <Credentials state={state} />}
      <SubmitButton pendingLabel="Creating...">Create login</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ memberId }: { memberId: string }) {
  const [state, action] = useActionState(resetMemberPassword, null);
  return (
    <form action={action} className="inline-block">
      <input type="hidden" name="member_id" value={memberId} />
      {!state?.ok && <SubmitButton variant="secondary" className="h-8 px-3 text-[13px]" pendingLabel="...">Reset password</SubmitButton>}
      {state?.error && <p className="mt-1 max-w-xs text-[12px] text-red-700">{state.error}</p>}
      {state?.ok && state.data && (
        <div className="mt-2 rounded-md border border-green-200 bg-green-50 p-2 text-[12px]">
          <div className="font-mono break-all">{state.data.email} / {state.data.password}</div>
          <CopyButton text={`Dashboard: ${state.data.loginUrl}\nEmail: ${state.data.email}\nPassword: ${state.data.password}`} label="Copy" variant="ghost" />
        </div>
      )}
    </form>
  );
}

export { buttonClass };
