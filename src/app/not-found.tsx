import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-[12px] font-medium uppercase tracking-widest text-accent-ink">404</p>
      <h1 className="display mt-2 text-5xl">Page not found</h1>
      <p className="mt-3 text-muted">The page you are looking for does not exist or you do not have access to it.</p>
      <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-md bg-accent px-4 font-medium text-ink">Back to home</Link>
    </main>
  );
}
