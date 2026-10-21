'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BarChart3, Globe, Inbox, LogOut, Menu, Plug, Search, Settings, Users, CreditCard, X } from 'lucide-react';
import { cn, initials } from '@/lib/utils';
import { logout } from '@/app/actions/auth';
import { switchWorkspace } from '@/app/actions/workspace';
import { UsageMeter } from '@/components/ui';
import { RealtimeLeads } from '@/components/layout/Realtime';

interface Props {
  role: 'owner' | 'admin' | 'member' | 'client';
  workspace: { id: string; name: string; logo_url: string | null };
  workspaces: { id: string; name: string }[];
  user: { name: string; email: string };
  usage: { used: number; cap: number; planName: string } | null;
  showLogo: boolean;
  poweredBy: boolean;
  isPlatformAdmin: boolean;
  children: React.ReactNode;
}

export function AppShell({ role, workspace, workspaces, user, usage, showLogo, poweredBy, isPlatformAdmin, children }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isClient = role === 'client';
  const manager = role === 'owner' || role === 'admin';

  const nav = [
    { href: '/app', label: 'Overview', icon: BarChart3, show: true, exact: true },
    { href: '/app/leads', label: 'Leads', icon: Inbox, show: true },
    { href: '/app/websites', label: 'Websites', icon: Globe, show: !isClient },
    { href: '/app/integrations', label: 'Integrations', icon: Plug, show: manager },
    { href: '/app/team', label: 'Team & clients', icon: Users, show: manager },
    { href: '/app/billing', label: 'Plan & billing', icon: CreditCard, show: manager },
    { href: '/app/settings', label: 'Settings', icon: Settings, show: true },
  ].filter((n) => n.show);

  const brand = (
    <div className="flex items-center gap-3">
      {showLogo && workspace.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={workspace.logo_url} alt="" className="h-8 w-8 rounded-md object-cover" />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-[12px] font-semibold text-[#F3EBDA]">{initials(workspace.name)}</span>
      )}
      <span className="truncate text-[15px] font-semibold">{workspace.name}</span>
    </div>
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-4 pt-5">
        {workspaces.length > 1 && !isClient ? (
          <form action={switchWorkspace}>
            <label className="sr-only" htmlFor="ws">Workspace</label>
            <select id="ws" name="workspace" defaultValue={workspace.id} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="field h-10 font-semibold">
              {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </form>
        ) : brand}
      </div>
      <nav className="flex-1 space-y-0.5 px-3" aria-label="Dashboard">
        {nav.map((n) => {
          const active = n.exact ? path === n.href : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined}
              className={cn('flex h-10 items-center gap-3 rounded-md px-3 transition-colors', active ? 'bg-tint font-medium text-ink' : 'text-muted hover:bg-tint/60 hover:text-ink')}>
              <n.icon size={17} strokeWidth={1.6} />{n.label}
            </Link>
          );
        })}
        {isPlatformAdmin && !isClient && (
          <Link href="/admin" className="mt-4 flex h-10 items-center gap-3 rounded-md px-3 text-accent-ink hover:bg-tint/60"><Settings size={17} strokeWidth={1.6} />Platform admin</Link>
        )}
      </nav>
      <div className="space-y-4 border-t hairline p-4">
        {usage && !isClient && <UsageMeter used={usage.used} cap={usage.cap} label={`${usage.planName} plan - leads this month`} />}
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tint text-[12px] font-semibold text-accent-ink">{initials(user.name)}</span>
          <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{user.name}</div><div className="truncate text-[12px] text-muted">{user.email}</div></div>
          <form action={logout}><button aria-label="Sign out" title="Sign out" className="rounded-md p-2 text-muted hover:bg-tint hover:text-ink"><LogOut size={16} /></button></form>
        </div>
        {poweredBy && <p className="text-[11px] text-muted">Powered by Leadscollector</p>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r hairline bg-surface lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] bg-surface shadow-pop">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b hairline bg-bg/90 px-4 backdrop-blur sm:px-8">
          <button className="rounded-md p-2 hover:bg-tint lg:hidden" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
          {isClient ? <div className="hidden sm:block">{brand}</div> : <span className="hidden text-[13px] font-medium text-muted sm:block">{workspace.name}</span>}
          <form action="/app/leads" className="relative mx-auto w-full max-w-md">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input name="q" type="search" placeholder="Search leads, emails, phone numbers" aria-label="Search leads" className="field pl-9" />
          </form>
          <div className="w-0 sm:w-[120px]" />
        </header>
        <RealtimeLeads workspaceId={workspace.id} />
        <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
