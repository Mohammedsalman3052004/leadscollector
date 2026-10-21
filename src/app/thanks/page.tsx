export const metadata = { title: 'Thank you' };

export default function Thanks() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-4xl font-semibold">Thank you</h1>
      <p className="mt-3 text-muted">Your message was received.</p>
    </main>
  );
}
