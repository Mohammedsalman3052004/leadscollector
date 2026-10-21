import { notFound } from 'next/navigation';
import Script from 'next/script';
import { TestForms } from './TestForms';

export const metadata = { title: 'Test forms (dev)' };
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_TEST_FORMS) notFound();
  const sp = await searchParams;
  const site = (sp.site ?? '').replace(/[^A-Za-z0-9_]/g, '');
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="display text-5xl">Test forms</h1>
      <p className="mt-3 max-w-2xl text-muted">Development page with about 15 form types to measure what the tracker captures and what it must not. Add a website with domain <code className="rounded bg-tint px-1">localhost</code> (or enable &quot;Allow localhost&quot;), then open <code className="rounded bg-tint px-1">/test-forms?site=YOUR_SITE_ID</code>.</p>
      {!site ? (
        <p className="mt-8 rounded-md border-l-[3px] border-l-amber-500 bg-amber-50 px-4 py-3">Add <code>?site=lc_...</code> to the URL to load the tracker.</p>
      ) : (
        <>
          <Script src="/lc.js" data-site-id={site} strategy="afterInteractive" />
          <TestForms site={site} />
        </>
      )}
    </main>
  );
}
