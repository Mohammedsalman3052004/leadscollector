'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="display text-4xl">Something went wrong</h1>
      <p className="mt-3 text-muted">An unexpected error occurred. Your data is safe.</p>
      {error.digest && <p className="mt-2 font-mono text-[12px] text-muted">Reference: {error.digest}</p>}
      <button onClick={reset} className="mt-6 inline-flex h-10 items-center rounded-md bg-accent px-4 font-medium text-ink">Try again</button>
    </main>
  );
}
