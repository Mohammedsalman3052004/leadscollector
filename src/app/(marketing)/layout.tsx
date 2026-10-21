import Link from 'next/link';

const nav = [
  { href: '/#how', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs', label: 'Docs' },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b hairline bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="display text-2xl">Leadscollector</Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
            {nav.map((n) => <Link key={n.href} href={n.href} className="text-muted hover:text-ink">{n.label}</Link>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden h-10 items-center px-3 text-muted hover:text-ink sm:inline-flex">Sign in</Link>
            <Link href="/signup" className="inline-flex h-10 items-center rounded-md bg-ink px-4 font-medium text-white hover:opacity-90">Get started</Link>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t hairline">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-muted">
          <span className="display text-xl text-ink">Leadscollector</span>
          <nav className="flex gap-6" aria-label="Footer">
            <Link href="/pricing">Pricing</Link><Link href="/docs">Docs</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link>
          </nav>
          <span className="text-[12px]">&copy; {new Date().getFullYear()} Leadscollector</span>
        </div>
      </footer>
    </div>
  );
}
