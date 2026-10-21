import Link from 'next/link';
import { Pricing } from '@/components/marketing/Pricing';
import { CodeBlock } from '@/components/ui';

const steps = [
  { n: '01', t: 'Add website', d: 'Register the domain and, optionally, where notifications and backups should go.' },
  { n: '02', t: 'Paste the snippet', d: 'One script tag in the site header. It works with plain HTML, Next.js, WordPress, Webflow and more.' },
  { n: '03', t: 'Receive leads', d: 'Submissions appear in the dashboard in real time, with email alerts and a Google Sheets copy.' },
];
const agency = [
  { t: 'Every client in one place', d: 'Switch between websites without switching tools. Search and filter across all of them.' },
  { t: 'Client logins that stay in their lane', d: 'Create a login for one website. Your client sees only their leads, under your agency name and logo.' },
  { t: 'Google Sheets and email, as backup', d: 'The dashboard is the source of truth. Sheets and email are copies that retry on their own.' },
  { t: 'White-label ready', d: 'Your workspace name and logo sit at the top of every client dashboard.' },
];
const faq = [
  ['Can one script really capture every form?', 'No tool can, and we do not pretend to. The snippet handles most native, AJAX and popular plugin forms. For the rest, use the hosted form endpoint or a server-side webhook, which are fully reliable.'],
  ['How do you know a submission actually worked?', 'Every lead carries a confidence level. Confirmed means the site accepted it (a successful response, a success message, or a webhook). Unconfirmed attempts are kept separately and never counted as leads.'],
  ['What do you collect?', 'Only text-like fields. Passwords, hidden fields, tokens, files and anything that looks like a card number are never sent. You can exclude any field by name.'],
  ['Does it need cookies or a consent banner?', 'The snippet sets no cookies. A consent mode is available if you want to hold submissions until your visitor agrees.'],
  ['What if I outgrow the free plan?', 'Leads over your monthly limit are still stored safely and unlock the moment you upgrade.'],
];

export default function Landing() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-20 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <p className="mb-5 text-[12px] font-medium uppercase tracking-[0.18em] text-accent-ink">Lead collection for agencies</p>
          <h1 className="display text-[56px] leading-[1.02] sm:text-[72px]">Paste one snippet.<br />Receive every lead.</h1>
          <p className="mt-6 max-w-xl text-[17px] text-muted">Leadscollector gathers form submissions from all your client websites into one dashboard, tells you which ones really went through, and lets each client see only their own.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="inline-flex h-11 items-center rounded-md bg-accent px-6 font-medium text-ink hover:brightness-95">Start free</Link>
            <Link href="/docs" className="inline-flex h-11 items-center rounded-md border border-line bg-surface px-6 font-medium hover:bg-tint">Read the install guide</Link>
          </div>
        </div>
        <div className="space-y-4">
          <CodeBlock>{`<script
  src="https://your-app.com/lc.js"
  data-site-id="lc_9f2a1c4e7b03d5a8c1e6f290"
  async></script>`}</CodeBlock>
          <div className="rounded-lg border hairline bg-surface">
            {[['Priya Raman', 'Get a Quote', 'Confirmed'], ['Arjun Mehta', 'Contact Us', 'Confirmed'], ['Karthik S', 'Contact Us', 'Probable']].map(([n, f, c], i) => (
              <div key={n} className={`flex items-center justify-between px-4 py-3 ${i ? 'border-t hairline' : ''}`}>
                <div><div className="font-medium">{n}</div><div className="text-[12px] text-muted">{f}</div></div>
                <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${c === 'Confirmed' ? 'text-[#2F6B3F]' : 'text-[#8A5A0B]'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{c}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="border-y hairline bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="display text-[44px] leading-none">How it works</h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n}><div className="display text-accent-ink text-3xl">{s.n}</div><h3 className="mt-3 text-[18px] font-semibold">{s.t}</h3><p className="mt-2 text-muted">{s.d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="display text-[44px] leading-none">Built for agencies</h2>
        <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {agency.map((a) => (
            <div key={a.t} className="border-t hairline pt-5"><h3 className="text-[18px] font-semibold">{a.t}</h3><p className="mt-2 text-muted">{a.d}</p></div>
          ))}
        </div>
      </section>

      <section className="border-y hairline bg-tint/50">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2">
          <div>
            <h2 className="display text-[44px] leading-none">Honest about what is a lead</h2>
            <p className="mt-5 text-muted">A browser script can see that a visitor pressed submit. It cannot always see whether the website accepted it. Leadscollector never blurs the two.</p>
          </div>
          <ul className="space-y-5">
            <li><b>Confirmed</b><p className="text-muted">A successful response, a success message, a plugin event, a webhook, or the hosted endpoint accepted it.</p></li>
            <li><b>Probable</b><p className="text-muted">The form submitted and the page moved on, but acceptance was not directly observed.</p></li>
            <li><b>Unconfirmed attempt</b><p className="text-muted">A submit was seen with no success signal. Kept aside, never counted, never emailed.</p></li>
          </ul>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="display text-[44px] leading-none">Simple pricing</h2>
        <p className="mb-10 mt-3 text-muted">Start free. Upgrade when you add client logins and more sites.</p>
        <Pricing />
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="display text-[44px] leading-none">Questions</h2>
        <div className="mt-8 divide-y divide-line border-y hairline">
          {faq.map(([q, a]) => (
            <details key={q} className="group py-5"><summary className="cursor-pointer list-none text-[16px] font-medium">{q}</summary><p className="mt-3 text-muted">{a}</p></details>
          ))}
        </div>
      </section>
    </>
  );
}
