'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/submit-button';
import { Notice } from '@/components/ui';
import type { ActionState } from '@/lib/types';

/** Generic form wrapper: runs a server action and shows its error / success message. */
export function ActionForm({
  action, children, submit, variant = 'primary', className, pendingLabel,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submit: string;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  pendingLabel?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className ?? 'space-y-4'}>
      {children}
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.ok && state.message && <Notice tone="success">{state.message}</Notice>}
      <SubmitButton variant={variant} pendingLabel={pendingLabel}>{submit}</SubmitButton>
    </form>
  );
}
