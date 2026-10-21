'use client';

import { buttonClass } from '@/components/ui';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="py-24 text-center">
      <h1 className="display text-4xl">Something went wrong</h1>
      <p className="mx-auto mt-3 max-w-md text-muted">We could not load this page. Your leads are safe.</p>
      {error.digest && <p className="mt-2 font-mono text-[12px] text-muted">Reference: {error.digest}</p>}
      <button onClick={reset} className={buttonClass('primary', 'mt-6')}>Try again</button>
    </div>
  );
}
