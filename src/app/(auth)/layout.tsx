import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="display text-2xl">Leadscollector</Link>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">{children}</div>
      </main>
      <aside className="hidden flex-col justify-between border-l hairline bg-tint/60 p-12 lg:flex">
        <div />
        <div>
          <p className="display text-[44px] leading-[1.05]">One snippet.<br />Every lead.<br />Every client.</p>
          <p className="mt-5 max-w-sm text-muted">Collect form submissions from all your client websites in one calm dashboard, and give each client a login for only their own site.</p>
          <pre className="mt-8 overflow-x-auto rounded-lg bg-ink p-4 font-mono text-[12px] leading-relaxed text-[#F3EBDA]"><code>{`<script src="https://your-app.com/lc.js"\n  data-site-id="lc_a1b2c3..." async></script>`}</code></pre>
        </div>
        <p className="text-[12px] text-muted">Confirmed submissions only. No cookies. No passwords or card data, ever.</p>
      </aside>
    </div>
  );
}
