import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { getWebsiteForManager } from '@/lib/websites';
import { adminClient } from '@/lib/supabase/admin';
import { appUrl, formatDateTime } from '@/lib/utils';
import { deleteWebsite, regenerateSecret, regenerateSiteId, renameForm, toggleWebsite, updateWebsite } from '@/app/actions/websites';
import { ActionForm } from '@/components/action-form';
import { CopyButton } from '@/components/copy-button';
import { CodeBlock, Field, Notice, PageHeader, Section, buttonClass } from '@/components/ui';
import { SnippetTabs } from '@/components/websites/Snippet';
import { SubmitButton } from '@/components/submit-button';

export const dynamic = 'force-dynamic';

export default async function WebsiteSettings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireManager();
  const site = await getWebsiteForManager(id, ctx.active.workspace.id);
  if (!site) notFound();
  const admin = adminClient();
  const { data: forms } = await admin.from('forms').select('id,name,fingerprint,created_at').eq('website_id', site.id).order('created_at');
  const { count: leadCount } = await admin.from('leads').select('id', { count: 'exact', head: true }).eq('website_id', site.id).neq('confidence', 'attempted');
  const s = site.settings ?? {};
  const base = appUrl();

  return (
    <>
      <Link href="/app/websites" className="mb-6 inline-block text-muted hover:text-ink">&larr; Websites</Link>
      <PageHeader title={site.name} description={`${site.domain} - ${leadCount ?? 0} leads - ${site.status === 'installed' ? 'Installed' : site.status === 'disabled' ? 'Paused' : 'Waiting for first signal'}${site.last_seen_at ? ` (seen ${formatDateTime(site.last_seen_at)})` : ''}`} />

      <Section title="Installation" description="Paste this once into the header of your website.">
        <SnippetTabs appUrl={base} siteId={site.public_site_id} />
      </Section>

      <Section title="Website details">
        <ActionForm action={updateWebsite} submit="Save settings">
          <input type="hidden" name="id" value={site.id} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Website name"><input name="name" defaultValue={site.name} required className="field" /></Field>
            <Field label="Primary domain"><input name="domain" defaultValue={site.domain} required className="field" /></Field>
          </div>
          <Field label="Allowed domains" hint="Extra domains that may send submissions (subdomains of the primary domain are already allowed). One per line."><textarea name="allowed_domains" rows={2} defaultValue={(site.allowed_domains ?? []).join('\n')} className="field" /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Category"><input name="category" defaultValue={site.category ?? ''} className="field" /></Field>
            <Field label="Notification email" hint="Receives an email for each confirmed lead."><input name="notification_email" type="email" defaultValue={site.notification_email ?? ''} className="field" /></Field>
          </div>
          <Field label="Description"><textarea name="description" rows={2} defaultValue={site.description ?? ''} className="field" /></Field>

          <h3 className="pt-4 text-[16px] font-semibold">Capture rules</h3>
          <Field label="Excluded field names" hint="Never captured, comma or line separated. Passwords, tokens and card-like fields are always excluded."><textarea name="excluded_fields" rows={2} defaultValue={(s.excluded_fields ?? []).join(', ')} className="field" placeholder="ssn, date_of_birth" /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Success URL contains (optional)" hint="After a normal form post, a page whose URL contains this text confirms the lead. Example: /thank-you"><input name="success_url" defaultValue={s.success_url ?? ''} className="field" placeholder="/thank-you" /></Field>
            <Field label="Success message selector (optional)" hint="A CSS selector that becomes visible after success. Example: .form-success"><input name="success_selector" defaultValue={s.success_selector ?? ''} className="field" placeholder=".form-success" /></Field>
          </div>
          <div className="space-y-2.5">
            {([['consent', 'Consent mode: only send submissions after window.leadscollector.consent(true)', s.consent], ['turnstile', 'Require Cloudflare Turnstile verification on submissions (needs TURNSTILE keys; add the widget to your forms)', s.turnstile], ['allow_localhost', 'Allow localhost (for testing only)', s.allow_localhost], ['endpoint_open', 'Open hosted endpoint: accept posts from any origin (not recommended)', s.endpoint_open]] as [string, string, boolean][]).map(([name, label, on]) => (
              <label key={name} className="flex items-start gap-2.5"><input type="checkbox" name={name} defaultChecked={!!on} className="mt-1" /><span>{label}</span></label>
            ))}
          </div>
        </ActionForm>
      </Section>

      <Section title="Detected forms" description="Forms are discovered automatically the first time they are submitted.">
        {(forms ?? []).length === 0 ? <p className="text-muted">No forms seen yet.</p> : (
          <ul className="divide-y divide-line border-y hairline">
            {(forms as any[]).map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <form action={renameForm} className="flex items-center gap-2">
                  <input type="hidden" name="website_id" value={site.id} /><input type="hidden" name="form_id" value={f.id} />
                  <input name="name" defaultValue={f.name} aria-label="Form name" className="field h-9 w-64" />
                  <button className={buttonClass('secondary', 'h-9 px-3')}>Rename</button>
                </form>
                <span className="font-mono text-[12px] text-muted">{f.fingerprint}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Hosted form endpoint" description="The most reliable no-code option. Point any form at this URL; accepted submissions are always Confirmed.">
        <div className="mb-3 flex items-center justify-between gap-3"><code className="break-all rounded bg-tint px-2 py-1 text-[13px]">{base}/api/f/{site.public_site_id}</code><CopyButton text={`${base}/api/f/${site.public_site_id}`} /></div>
        <CodeBlock>{`<form action="${base}/api/f/${site.public_site_id}" method="POST">\n  <input name="name"> <input name="email" type="email">\n  <input type="hidden" name="_redirect" value="https://${site.domain}/thanks">\n  <button>Send</button>\n</form>`}</CodeBlock>
      </Section>

      <Section title="Webhook (server to server)" description="Call this from your own backend after your submission succeeds. Sign the raw body with the secret (HMAC SHA-256).">
        <div className="mb-3 flex items-center justify-between gap-3"><code className="break-all rounded bg-tint px-2 py-1 text-[13px]">{base}/api/webhook/{site.public_site_id}</code><CopyButton text={`${base}/api/webhook/${site.public_site_id}`} /></div>
        <div className="flex items-center justify-between gap-3"><code className="break-all rounded bg-tint px-2 py-1 text-[13px]">{site.webhook_secret}</code><CopyButton text={site.webhook_secret} label="Copy secret" /></div>
        <p className="mt-3 text-[13px] text-muted">See the <Link href="/docs#webhook" className="underline">docs</Link> for a signing example.</p>
      </Section>

      <Section title="Danger zone">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-xl text-muted">{site.status === 'disabled' ? 'Submissions are currently rejected.' : 'Pausing makes the snippet, endpoint and webhook reject submissions until you resume.'}</p>
            <form action={toggleWebsite}><input type="hidden" name="id" value={site.id} /><SubmitButton variant="secondary">{site.status === 'disabled' ? 'Resume website' : 'Pause website'}</SubmitButton></form>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-xl text-muted">Regenerate the site ID if it was abused. You must update the snippet on the website afterwards.</p>
            <div className="flex gap-2">
              <form action={regenerateSiteId}><input type="hidden" name="id" value={site.id} /><SubmitButton variant="secondary">New site ID</SubmitButton></form>
              <form action={regenerateSecret}><input type="hidden" name="id" value={site.id} /><SubmitButton variant="secondary">New webhook secret</SubmitButton></form>
            </div>
          </div>
          <form action={deleteWebsite} className="space-y-3 border-t hairline pt-6">
            <Notice tone="error">Deleting removes this website and <b>all of its leads</b> permanently. Client logins for it lose access.</Notice>
            <input type="hidden" name="id" value={site.id} />
            <div className="flex flex-wrap items-center gap-3"><input name="confirm" placeholder={`Type ${site.domain} to confirm`} aria-label="Confirm domain" className="field max-w-xs" /><SubmitButton variant="danger">Delete website</SubmitButton></div>
          </form>
        </div>
      </Section>
    </>
  );
}
