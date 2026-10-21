import Link from 'next/link';
import { requirePlatformAdmin } from '@/lib/auth';

const nav = [['/admin', 'Overview'], ['/admin/workspaces', 'Workspaces'], ['/admin/websites', 'Websites'], ['/admin/delivery-errors', 'Delivery errors'], ['/admin/settings', 'Settings & audit']];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  return (
    <div className="min-h-screen">
      <header className="border-b hairline bg-surface">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <div className="flex items-center gap-3"><span className="display text-2xl">Leadscollector</span><span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-medium text-white">Platform admin</span></div>
          <Link href="/app" className="text-muted hover:text-ink">Back to dashboard</Link>
        </div>
        <nav className="mx-auto flex max-w-[1200px] gap-1 px-6" aria-label="Admin">
          {nav.map(([h, l]) => <Link key={h} href={h} className="px-3 py-2.5 text-muted hover:text-ink">{l}</Link>)}
        </nav>
      </header>
      <main className="mx-auto max-w-[1200px] px-6 py-10">{children}</main>
    </div>
  );
}
