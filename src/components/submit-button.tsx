'use client';

import { useFormStatus } from 'react-dom';
import { buttonClass } from '@/components/ui';

export function SubmitButton({ children, variant = 'primary', className, pendingLabel }: { children: React.ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass(variant, className)}>
      {pending ? pendingLabel ?? 'Working...' : children}
    </button>
  );
}
