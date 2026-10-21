export const metadata = { title: 'Terms of Service' };

export default function Terms() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 [&_h2]:display [&_h2]:mb-2 [&_h2]:mt-10 [&_h2]:text-[28px] [&_p]:my-3 [&_p]:text-muted">
      <h1 className="display text-[48px] leading-none">Terms of Service</h1>
      <p className="text-[12px]">Template for you to review with a lawyer before launch. Replace the bracketed items.</p>
      <h2>The service</h2>
      <p>Leadscollector lets you collect and manage submissions from forms on websites you own or are authorised to manage.</p>
      <h2>Your responsibilities</h2>
      <p>You must have the right to collect the data you send to us, give your website visitors any notices and obtain any consent the law requires, and must not use the service to collect sensitive credentials, payment card data or unlawful content, or to send spam.</p>
      <h2>Plans and limits</h2>
      <p>Each plan has limits on websites, monthly leads, client logins and retention. Leads above the monthly limit are stored but hidden until you upgrade. We may suspend websites or accounts that abuse the service.</p>
      <h2>Availability and liability</h2>
      <p>We work to keep the service reliable but cannot guarantee that every form submission on every website can be detected. Use the hosted endpoint or webhook where certainty matters. [Add your liability and warranty terms here.]</p>
      <h2>Contact</h2>
      <p>[Company name], [address], [contact email].</p>
    </article>
  );
}
