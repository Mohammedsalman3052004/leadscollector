export const metadata = { title: 'Privacy Policy' };

export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 [&_h2]:display [&_h2]:mb-2 [&_h2]:mt-10 [&_h2]:text-[28px] [&_p]:my-3 [&_p]:text-muted [&_li]:text-muted [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="display text-[48px] leading-none">Privacy Policy</h1>
      <p className="text-[12px]">Template for you to review with a lawyer before launch. Replace the bracketed items.</p>
      <h2>Who we are</h2>
      <p>[Company name] operates Leadscollector. For questions or requests write to [privacy contact email].</p>
      <h2>Two roles</h2>
      <p>For our customers' account data (name, email, billing) we are the data controller. For the form submissions our customers collect from their website visitors we act as a data processor on our customers' instructions, under a data processing agreement.</p>
      <h2>What the tracker collects</h2>
      <ul>
        <li>Submitted form values that are text-like (names, emails, phone numbers, messages, custom fields).</li>
        <li>Page URL, referrer, UTM parameters, form name, timestamp and browser user agent.</li>
        <li>A salted one-way hash of the visitor's IP address, used only for abuse protection.</li>
      </ul>
      <p>We never collect password fields, hidden fields, file uploads, fields that look like tokens or card or ID numbers, or values that match card number patterns. The script sets no cookies. Customers can exclude any field and can enable a consent mode.</p>
      <h2>How long we keep data</h2>
      <p>Lead data is kept for the retention period of the customer's plan, then deleted automatically. Customers can delete leads at any time and can export or delete their whole workspace from Settings.</p>
      <h2>Sub-processors</h2>
      <p>Supabase (database and authentication), Vercel (hosting), Resend (email), Google (Sign-in and Sheets, only if connected), Cloudflare (bot protection, only if enabled), Stripe (payments, only if enabled). [Update this list to match your setup.]</p>
      <h2>Your rights</h2>
      <p>Depending on where you live (for example under the GDPR or India's DPDP Act) you may have rights to access, correct, delete or port your data. Website visitors should contact the website owner whose form they used; we will assist them.</p>
      <h2>Security</h2>
      <p>Data is encrypted in transit and at rest by our providers, integration credentials are additionally encrypted, tenants are isolated with row level security, and administrator access to lead contents requires an explicit, time-limited, logged grant.</p>
    </article>
  );
}
