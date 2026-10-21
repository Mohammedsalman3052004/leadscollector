'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { createWebsite } from '@/app/actions/websites';
import { SubmitButton } from '@/components/submit-button';
import { Field, Notice, buttonClass } from '@/components/ui';
import { SnippetTabs } from '@/components/websites/Snippet';
import { cn } from '@/lib/utils';

function Stepper({ step }: { step: number }) {
  const items = ['Details', 'Install', 'Verify'];
  return (
    <ol className="mb-10 flex items-center gap-3" aria-label="Progress">
      {items.map((l, i) => (
        <li key={l} className="flex items-center gap-3" aria-current={step === i + 1 ? 'step' : undefined}>
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold', step > i + 1 ? 'bg-accent text-ink' : step === i + 1 ? 'bg-ink text-white' : 'bg-line text-muted')}>{step > i + 1 ? <Check size={14} /> : i + 1}</span>
          <span className={cn('font-medium', step === i + 1 ? 'text-ink' : 'text-muted')}>{l}</span>
          {i < items.length - 1 && <span className="h-px w-8 bg-line" />}
        </li>
      ))}
    </ol>
  );
}

export function AddWebsiteWizard({ appUrl, defaultEmail }: { appUrl: string; defaultEmail: string }) {
  const [state, action] = useActionState(createWebsite, null);
  const [step, setStep] = useState(1);
  const created = state?.ok ? (state.data as { id: string; siteId: string; domain: string }) : null;
  const [status, setStatus] = useState<{ status: string; leads: number; lastSeen: string | null } | null>(null);

  useEffect(() => { if (created && step === 1) setStep(2); }, [created, step]);
  useEffect(() => {
    if (step !== 3 || !created) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/websites/${created.id}/status`, { cache: 'no-store' });
        if (r.ok && alive) setStatus(await r.json());
      } catch { /* retry */ }
    };
    tick();
    const t = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [step, created]);

  const detected = !!status && (status.status === 'installed' || status.leads > 0);

  return (
    <div className="max-w-2xl">
      <Stepper step={step} />
      {step === 1 && (
        <form action={action} className="space-y-5">
          <Field label="Website name"><input name="name" required minLength={2} maxLength={120} placeholder="Teknix" className="field" /></Field>
          <Field label="Website domain" hint="Only the domain, for example example.com. Submissions from other domains are rejected."><input name="domain" required placeholder="example.com" className="field" /></Field>
          <Field label="Additional allowed domains (optional)" hint="Staging or landing page domains, one per line."><textarea name="allowed_domains" rows={2} className="field" placeholder="ads.example.com" /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Category (optional)"><select name="category" className="field" defaultValue=""><option value="">Select...</option>{['Real estate', 'Construction', 'Elevators', 'Healthcare', 'Education', 'E-commerce', 'Services', 'Other'].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Notification email (optional)"><input name="notification_email" type="email" defaultValue={defaultEmail} className="field" /></Field>
          </div>
          <Field label="Description (optional)"><textarea name="description" rows={2} maxLength={500} className="field" /></Field>
          {state?.error && <Notice tone="error">{state.error}</Notice>}
          <div className="flex gap-3"><SubmitButton pendingLabel="Adding...">Continue</SubmitButton><Link href="/app/websites" className={buttonClass('ghost')}>Cancel</Link></div>
        </form>
      )}
      {step === 2 && created && (
        <div>
          <h2 className="mb-1 text-[20px] font-semibold">Install the snippet</h2>
          <p className="mb-5 text-muted">Paste it once into the header of <b>{created.domain}</b>.</p>
          <SnippetTabs appUrl={appUrl} siteId={created.siteId} />
          <div className="mt-8 flex gap-3"><button className={buttonClass('primary')} onClick={() => setStep(3)}>I have added it</button></div>
        </div>
      )}
      {step === 3 && created && (
        <div>
          <h2 className="mb-1 text-[20px] font-semibold">{detected ? 'Connected' : 'Waiting for the first submission'}</h2>
          <p className="mb-6 text-muted">{detected ? 'We can see your website. New submissions will appear in your dashboard.' : 'Open your website and submit a test form. This page updates by itself.'}</p>
          <div className={cn('flex items-center gap-4 rounded-lg border p-5', detected ? 'border-green-200 bg-green-50' : 'border-line bg-surface')} role="status">
            {detected ? <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-white"><Check size={18} /></span> : <Loader2 size={22} className="animate-spin text-accent-ink" />}
            <div>
              <div className="font-medium">{detected ? (status!.leads > 0 ? `${status!.leads} submission${status!.leads === 1 ? '' : 's'} received` : 'Script detected on your site') : 'No signal yet'}</div>
              <div className="text-[13px] text-muted">{detected ? 'Everything is working.' : 'If nothing arrives, check the snippet is on the page and the domain matches.'}</div>
            </div>
          </div>
          <div className="mt-8 flex gap-3">
            <Link href={`/app/websites/${created.id}`} className={buttonClass('primary')}>Open website settings</Link>
            <Link href="/app/leads" className={buttonClass('secondary')}>View leads</Link>
          </div>
        </div>
      )}
    </div>
  );
}
