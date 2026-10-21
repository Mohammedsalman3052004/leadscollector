import { CodeBlock } from '@/components/ui';

export const metadata = { title: 'Install guide' };

const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.com';

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="display mb-3 mt-14 scroll-mt-24 text-[34px] leading-tight">{children}</h2>;
}

export default function Docs() {
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[220px_1fr]">
      <nav aria-label="On this page" className="hidden lg:block">
        <ul className="sticky top-24 space-y-2 text-muted">
          {[['quick', 'Quick start'], ['html', 'HTML'], ['nextjs', 'Next.js'], ['wordpress', 'WordPress'], ['webflow', 'Webflow'], ['confidence', 'Confirmation levels'], ['attributes', 'Attributes and API'], ['endpoint', 'Hosted form endpoint'], ['webhook', 'Webhook'], ['privacy', 'What is collected'], ['csp', 'CSP and ad blockers'], ['limits', 'Known limitations']].map(([id, l]) => (
            <li key={id}><a href={`#${id}`} className="hover:text-ink">{l}</a></li>
          ))}
        </ul>
      </nav>
      <article className="max-w-3xl [&_p]:my-3 [&_p]:text-muted [&_li]:text-muted [&_code]:rounded [&_code]:bg-tint [&_code]:px-1 [&_code]:text-[13px] [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5">
        <h1 className="display text-[56px] leading-none">Install guide</h1>
        <p>Add a website in the dashboard to get your snippet. Replace <code>lc_YOUR_SITE_ID</code> below with your site ID.</p>

        <H id="quick">Quick start</H>
        <p>Paste this once into the global <code>&lt;head&gt;</code> of your website. Every form on every page is then covered, including forms added later.</p>
        <CodeBlock>{`<script src="${APP}/lc.js" data-site-id="lc_YOUR_SITE_ID" async></script>`}</CodeBlock>

        <H id="html">HTML</H>
        <p>Place the snippet before <code>&lt;/head&gt;</code> in your layout or template.</p>

        <H id="nextjs">Next.js</H>
        <p>Use <code>next/script</code> in the root layout. Server actions submit through an opaque request, so for those forms add the success event (below) or use the hosted endpoint.</p>
        <CodeBlock>{`import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html><body>
      {children}
      <Script src="${APP}/lc.js" data-site-id="lc_YOUR_SITE_ID" strategy="afterInteractive" />
    </body></html>
  );
}

// After your server action succeeds (client side):
window.dispatchEvent(new Event('leadscollector:success'));`}</CodeBlock>

        <H id="wordpress">WordPress</H>
        <p>Add the snippet with a header/footer plugin or your theme's <code>header.php</code>. Built-in adapters confirm Contact Form 7, WPForms, Gravity Forms and Elementor forms automatically.</p>

        <H id="webflow">Webflow</H>
        <p>Project Settings, Custom Code, Head Code: paste the snippet and publish. Webflow's success message is detected automatically.</p>

        <H id="confidence">Confirmation levels</H>
        <ul>
          <li><b>Confirmed</b>: a 2xx response to the form request, a visible success message, your success URL, a plugin event, a webhook, or the hosted endpoint.</li>
          <li><b>Probable</b>: a normal form submit where the page navigated, but acceptance was not observed.</li>
          <li><b>Unconfirmed attempt</b>: a submit with no success signal. Hidden by default and never emailed.</li>
        </ul>
        <p>If your form shows up as unconfirmed, set a <b>success URL</b> or <b>success selector</b> in the website's settings, or dispatch the <code>leadscollector:success</code> event.</p>

        <H id="attributes">Attributes and API</H>
        <CodeBlock>{`<form data-lc-name="Quote form">…</form>      <!-- friendly form name -->
<form data-lc-ignore>…</form>                  <!-- never capture this form -->
<div data-lc-ignore><input name="x"></div>     <!-- never capture these fields -->

// Manual tracking for fully custom forms (after your own success check):
window.leadscollector.track({ name: 'Priya', email: 'p@example.com' }, { form: 'Quote form' });

// Consent mode (enable in website settings): hold data until consent is given
window.leadscollector.consent(true);`}</CodeBlock>

        <H id="endpoint">Hosted form endpoint</H>
        <p>The most reliable no-code option: point your form at us. Accepted submissions are always <b>Confirmed</b>.</p>
        <CodeBlock>{`<form action="${APP}/api/f/lc_YOUR_SITE_ID" method="POST">
  <input name="name"> <input name="email" type="email">
  <textarea name="message"></textarea>
  <input type="hidden" name="_redirect" value="https://yoursite.com/thanks">
  <input type="text" name="_hp" style="display:none" tabindex="-1" autocomplete="off"> <!-- honeypot -->
  <button>Send</button>
</form>

// or with fetch
fetch('${APP}/api/f/lc_YOUR_SITE_ID', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Priya', email: 'p@example.com' })
});`}</CodeBlock>
        <p>The request must come from your registered domain (or enable "open endpoint" in settings).</p>

        <H id="webhook">Webhook (server to server)</H>
        <p>Call this from your backend after your own database or email step succeeds. Sign the raw body with your website's webhook secret.</p>
        <CodeBlock>{`import crypto from 'node:crypto';

const body = JSON.stringify({
  form_name: 'Quote form',
  fields: { name: 'Priya', email: 'priya@example.com', 'Building type': 'Residential' }
});
const sig = crypto.createHmac('sha256', process.env.LC_WEBHOOK_SECRET).update(body).digest('hex');

await fetch('${APP}/api/webhook/lc_YOUR_SITE_ID', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-lc-signature': 'sha256=' + sig },
  body
});`}</CodeBlock>

        <H id="privacy">What is collected</H>
        <ul>
          <li>Text, email, phone, select, checkbox, radio and textarea values that were submitted.</li>
          <li>Page URL, referrer, UTM parameters, form name and time.</li>
          <li><b>Never</b>: password fields, hidden inputs, file inputs, fields named like tokens, OTPs, card or ID numbers, and values that look like card numbers.</li>
          <li>Visitor IP addresses are stored only as a salted hash. The script sets no cookies.</li>
        </ul>

        <H id="csp">CSP and ad blockers</H>
        <p>If your site uses a Content-Security-Policy, allow <code>script-src {APP}</code> and <code>connect-src {APP}</code>. Some ad blockers and privacy browsers block third-party scripts; for those visitors use the hosted endpoint or the webhook.</p>

        <H id="limits">Known limitations</H>
        <ul>
          <li>Forms inside cross-origin iframes (for example Typeform) cannot be read. Use their webhook or integration instead.</li>
          <li>Native form posts to a third-party URL cannot be confirmed from your page.</li>
          <li>Server-side-only success (no visible change, no network call) needs a success URL, the success event, or the webhook.</li>
        </ul>
      </article>
    </div>
  );
}
