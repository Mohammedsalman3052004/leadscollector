import Link from 'next/link';
import { requireManager } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';
import { planOf } from '@/lib/plans';
import { formatDateTime } from '@/lib/utils';
import { disconnectIntegration, retryDelivery } from '@/app/actions/integrations';
import { EmailForm, SheetForm } from '@/components/IntegrationForms';
import { LinkButton, Notice, PageHeader, Section, buttonClass } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { emailConfigured } from '@/lib/email';

export const metadata = { title: 'Integrations' };
export const dynamic = 'force-dynamic';
const one = (x: any) => (Array.isArray(x) ? x[0] : x);

const tone: Record<string, string> = { success: 'text-[#2F6B3F]', failed: 'text-red-700', retrying: 'text-[#8A5A0B]', pending: 'text-muted' };

export default async function Integrations({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireManager();
  const sp = await searchParams;
  const ws = ctx.active.workspace;
  const plan = planOf(ws.plan);
  const admin = adminClient();
  const filter = ['failed', 'retrying', 'pending', 'success'].includes(sp.status ?? '') ? sp.status! : '';

  const [{ data: sites }, { data: integ }, deliveries] = await Promise.all([
    admin.from('websites').select('id,name').eq('workspace_id', ws.id).order('name'),
    admin.from('integrations').select('id,website_id,type,status,config,last_synced_at,last_error').eq('workspace_id', ws.id),
    (() => {
      let q = admin.from('deliveries').select('id,status,attempts,last_error,created_at,next_attempt_at,lead:leads(id,name,email),integration:integrations(type,website:websites(name))').eq('workspace_id', ws.id).order('created_at', { ascending: false }).limit(50);
      if (filter) q = q.eq('status', filter);
      return q;
    })(),
  ]);
  const all = (integ ?? []) as any[];
  const email = all.find((i) => i.type === 'email' && !i.website_id);
  const sheets = new Map(all.filter((i) => i.type === 'google_sheets').map((i) => [i.website_id, i]));

  return (
    <>
      <PageHeader title="Integrations" description="Your dashboard is always the source of truth. These are extra copies, retried automatically if they fail." />
      {sp.connected && <div className="mb-6"><Notice tone="success">Google connected. Choose the spreadsheet below.</Notice></div>}
      {sp.error && <div className="mb-6"><Notice tone="error">{sp.error === 'google_not_configured' ? 'Google OAuth is not configured on this server yet (GOOGLE_CLIENT_ID).' : 'Could not connect Google. Please try again.'}</Notice></div>}

      <Section title="Email notifications">
        {!emailConfigured() && <div className="mb-4"><Notice tone="warn">Email sending is not configured on this server (RESEND_API_KEY). Notifications will fail until it is.</Notice></div>}
        <EmailForm recipients={(email?.config?.recipients ?? []).join('\n')} enabled={email ? email.status === 'active' : true} />
      </Section>

      <Section title="Google Sheets" description="Each website can sync new leads to its own spreadsheet. Custom fields become columns automatically.">
        {!plan.sheets ? (
          <Notice tone="info">Google Sheets sync is a Pro feature. <Link href="/app/billing" className="font-medium underline">See plans</Link></Notice>
        ) : (sites ?? []).length === 0 ? <p className="text-muted">Add a website first.</p> : (
          <div className="divide-y divide-line border-y hairline">
            {(sites as any[]).map((s) => {
              const i = sheets.get(s.id);
              return (
                <div key={s.id} className="py-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-[12px] text-muted">
                        {!i ? 'Not connected' : i.status === 'needs_reauth' ? 'Reconnect required' : i.status === 'error' ? 'Error' : i.config?.spreadsheet_id ? `Connected${i.last_synced_at ? ` - last synced ${formatDateTime(i.last_synced_at)}` : ''}` : 'Connected - choose a spreadsheet'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a href={`/api/integrations/google/connect?website=${s.id}`} className={buttonClass(i?.status === 'needs_reauth' ? 'primary' : 'secondary')}>{i ? (i.status === 'needs_reauth' ? 'Reconnect Google' : 'Reconnect') : 'Connect Google'}</a>
                      {i && <form action={disconnectIntegration}><input type="hidden" name="integration_id" value={i.id} /><SubmitButton variant="danger">Disconnect</SubmitButton></form>}
                    </div>
                  </div>
                  {i?.status === 'needs_reauth' && <div className="mt-3"><Notice tone="warn">Google access expired or was revoked. Leads are safe; syncing resumes after you reconnect.</Notice></div>}
                  {i && i.status !== 'needs_reauth' && i.last_error && <p className="mt-2 text-[12px] text-red-700">Last error: {i.last_error}</p>}
                  {i && <SheetForm integrationId={i.id} spreadsheet={i.config?.spreadsheet_id ?? ''} sheetName={i.config?.sheet_name ?? 'Leads'} />}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="CSV export" description="Download leads with your current filters from the Leads page."><LinkButton href="/api/leads/export?confidence=visible" variant="secondary">Download all leads (CSV)</LinkButton></Section>

      <section id="log" className="scroll-mt-24 border-t hairline pt-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-[20px] font-semibold">Delivery log</h2><p className="text-muted">Latest 50 email and Sheets deliveries.</p></div>
          <div className="flex gap-1 text-[13px]">
            {['', 'failed', 'retrying', 'pending', 'success'].map((s) => <Link key={s || 'all'} href={s ? `/app/integrations?status=${s}#log` : '/app/integrations#log'} className={`rounded-md px-3 py-1.5 capitalize ${filter === s ? 'bg-tint font-medium' : 'text-muted hover:bg-tint/60'}`}>{s || 'All'}</Link>)}
          </div>
        </div>
        {(deliveries.data ?? []).length === 0 ? <p className="text-muted">No deliveries.</p> : (
          <div className="overflow-x-auto border-y hairline"><table className="w-full min-w-[720px]">
            <thead><tr className="border-b hairline"><th className="th">Lead</th><th className="th">Destination</th><th className="th">Status</th><th className="th">When</th><th className="th" /></tr></thead>
            <tbody>
              {(deliveries.data as any[]).map((d) => (
                <tr key={d.id} className="border-t hairline align-top">
                  <td className="td"><Link href={`/app/leads/${one(d.lead)?.id}`} className="hover:underline">{one(d.lead)?.name ?? one(d.lead)?.email ?? 'Lead'}</Link></td>
                  <td className="td text-muted">{one(d.integration)?.type === 'email' ? 'Email' : 'Google Sheets'}<div className="text-[12px]">{one(one(d.integration)?.website)?.name}</div></td>
                  <td className="td"><span className={`font-medium capitalize ${tone[d.status]}`}>{d.status}</span>{d.attempts > 0 && <span className="text-[12px] text-muted"> - {d.attempts} attempt{d.attempts === 1 ? '' : 's'}</span>}{d.last_error && <div className="max-w-sm break-words text-[12px] text-muted">{d.last_error}</div>}</td>
                  <td className="td whitespace-nowrap text-[12px] text-muted">{formatDateTime(d.created_at)}</td>
                  <td className="td text-right">{(d.status === 'failed' || d.status === 'retrying') && <form action={retryDelivery}><input type="hidden" name="delivery_id" value={d.id} /><SubmitButton variant="secondary" className="h-8 px-3 text-[13px]">Retry</SubmitButton></form>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
