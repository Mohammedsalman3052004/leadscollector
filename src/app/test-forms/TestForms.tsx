'use client';

import { useEffect, useRef, useState } from 'react';
import { fakeServerAction } from './actions';

type Expect = 'confirmed' | 'probable' | 'attempted' | 'not captured' | 'confirmed (endpoint)';
const badge: Record<string, string> = { confirmed: 'bg-green-100 text-green-900', probable: 'bg-amber-100 text-amber-900', attempted: 'bg-stone-200 text-stone-800', 'not captured': 'bg-red-100 text-red-900' };

function Card({ n, title, expect, note, children }: { n: number; title: string; expect: Expect; note: string; children: React.ReactNode }) {
  const key = expect.startsWith('confirmed') ? 'confirmed' : expect;
  return (
    <section className="border-t hairline py-8">
      <div className="mb-4 flex flex-wrap items-center gap-3"><span className="display text-2xl text-accent-ink">{String(n).padStart(2, '0')}</span><h2 className="text-[16px] font-semibold">{title}</h2><span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${badge[key]}`}>Expected: {expect}</span></div>
      <p className="mb-4 max-w-2xl text-[13px] text-muted">{note}</p>
      {children}
    </section>
  );
}

const Inputs = ({ extra }: { extra?: React.ReactNode }) => (
  <div className="grid max-w-xl gap-3 sm:grid-cols-2">
    <input name="name" placeholder="Name" defaultValue="Test Person" className="field" />
    <input name="email" type="email" placeholder="Email" defaultValue={`test${Math.floor(Math.random() * 9999)}@example.com`} className="field" />
    <input name="phone" placeholder="Phone" defaultValue="9876543210" className="field" />
    <input name="Building type" placeholder="Building type" defaultValue="Residential" className="field" />
    <textarea name="message" placeholder="Message" defaultValue="Hello from the test page" className="field sm:col-span-2" />
    {extra}
  </div>
);
const Btn = ({ children = 'Submit' }: { children?: React.ReactNode }) => <button className="mt-4 inline-flex h-10 items-center rounded-md bg-ink px-5 font-medium text-white">{children}</button>;

async function post(url: string, form: HTMLFormElement) {
  const body = JSON.stringify(Object.fromEntries(new FormData(form).entries()));
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
}

export function TestForms({ site }: { site: string }) {
  const [log, setLog] = useState<Record<number, string>>({});
  const [done, setDone] = useState(false);
  const [popup, setPopup] = useState(false);
  const [dyn, setDyn] = useState(false);
  const cf7 = useRef<HTMLFormElement>(null);
  const set = (n: number, v: string) => setLog((l) => ({ ...l, [n]: v }));
  useEffect(() => { const t = setTimeout(() => setDyn(true), 1500); return () => clearTimeout(t); }, []);
  const [rc, setRc] = useState({ name: 'React Person', email: 'react@example.com', message: 'Controlled inputs' });

  return (
    <div className="mt-8">
      <Card n={1} title="Native HTML form posting to the hosted endpoint" expect="confirmed (endpoint)" note="Real navigation to /api/f/<site>. The endpoint confirms server side, then redirects to /thanks. The snippet may also record an attempt; they merge by dedupe.">
        <form action={`/api/f/${site}`} method="POST"><Inputs extra={<input type="text" name="_hp" tabIndex={-1} autoComplete="off" className="hidden" />} /><Btn /></form>
      </Card>

      <Card n={2} title="Native GET form that reloads this page" expect="probable" note="Page navigates, so acceptance is not observed. The next page load promotes the attempt to Probable.">
        <form action="/test-forms" method="get"><input type="hidden" name="site" value={site} /><Inputs /><Btn /></form>
      </Card>

      <Card n={3} title="fetch() POST that succeeds (200)" expect="confirmed" note="The tracker matches the request body to the form and sees a 2xx response.">
        <form onSubmit={async (e) => { e.preventDefault(); const r = await post('/api/test/ok', e.currentTarget); set(3, `Server said ${r.status}`); }}><Inputs /><Btn /></form><p className="mt-2 text-[13px]">{log[3]}</p>
      </Card>

      <Card n={4} title="fetch() POST that fails (HTTP 500)" expect="attempted" note="Must NOT be reported as a lead. Check Leads, filter Unconfirmed attempts.">
        <form onSubmit={async (e) => { e.preventDefault(); const r = await post('/api/test/fail', e.currentTarget); set(4, `Server said ${r.status}`); }}><Inputs /><Btn /></form><p className="mt-2 text-[13px]">{log[4]}</p>
      </Card>

      <Card n={5} title="fetch() returns 200 with success:false" expect="attempted" note="Many backends return 200 with an error body. The tracker reads common failure shapes and does not confirm.">
        <form onSubmit={async (e) => { e.preventDefault(); const r = await post('/api/test/json-fail', e.currentTarget); set(5, `Server said ${r.status} (body success:false)`); }}><Inputs /><Btn /></form><p className="mt-2 text-[13px]">{log[5]}</p>
      </Card>

      <Card n={6} title="XMLHttpRequest POST (jQuery-style AJAX)" expect="confirmed" note="XHR is wrapped the same way as fetch.">
        <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const x = new XMLHttpRequest(); x.open('POST', '/api/test/ok'); x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded'); x.onload = () => set(6, `XHR ${x.status}`); x.send(new URLSearchParams(new FormData(f) as unknown as Record<string, string>).toString()); }}><Inputs /><Btn /></form><p className="mt-2 text-[13px]">{log[6]}</p>
      </Card>

      <Card n={7} title="React controlled form" expect="confirmed" note="State-driven inputs still expose their values to the DOM at submit time.">
        <form onSubmit={async (e) => { e.preventDefault(); const r = await fetch('/api/test/ok', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rc) }); set(7, `Server said ${r.status}`); }}>
          <div className="grid max-w-xl gap-3 sm:grid-cols-2"><input name="name" value={rc.name} onChange={(e) => setRc({ ...rc, name: e.target.value })} className="field" /><input name="email" value={rc.email} onChange={(e) => setRc({ ...rc, email: e.target.value })} className="field" /><textarea name="message" value={rc.message} onChange={(e) => setRc({ ...rc, message: e.target.value })} className="field sm:col-span-2" /></div><Btn /></form><p className="mt-2 text-[13px]">{log[7]}</p>
      </Card>

      <Card n={8} title="Next.js server action form" expect="attempted" note="Server actions use an opaque POST, so the tracker cannot confirm. This form dispatches the documented leadscollector:success event after success, which confirms it. Remove the dispatch to see it stay unconfirmed.">
        <form action={async (fd) => { await fakeServerAction(fd); window.dispatchEvent(new Event('leadscollector:success')); set(8, 'Action done, success event dispatched'); }}><Inputs /><Btn /></form><p className="mt-2 text-[13px]">{log[8]}</p>
      </Card>

      <Card n={9} title="Contact Form 7 style (wpcf7mailsent event)" expect="confirmed" note="Simulates the CF7 DOM event the adapter listens for.">
        <form ref={cf7} onSubmit={(e) => { e.preventDefault(); setTimeout(() => cf7.current?.dispatchEvent(new CustomEvent('wpcf7mailsent', { bubbles: true, detail: {} })), 400); set(9, 'wpcf7mailsent dispatched'); }}><Inputs /><Btn /></form><p className="mt-2 text-[13px]">{log[9]}</p>
      </Card>

      <Card n={10} title="Form injected after page load" expect="confirmed" note="Created 1.5 seconds after load. Delegated listeners catch forms that did not exist at install time.">
        {dyn ? <form onSubmit={async (e) => { e.preventDefault(); const r = await post('/api/test/ok', e.currentTarget); set(10, `Server said ${r.status}`); }}><Inputs /><Btn /></form> : <p className="text-muted">Loading form...</p>}<p className="mt-2 text-[13px]">{log[10]}</p>
      </Card>

      <Card n={11} title="Popup / modal form" expect="confirmed" note="Forms inside modals work like any other form.">
        <button className="inline-flex h-10 items-center rounded-md border border-line bg-surface px-4" onClick={() => setPopup(true)}>Open popup</button>
        {popup && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"><div className="w-full max-w-lg rounded-lg bg-surface p-6"><form onSubmit={async (e) => { e.preventDefault(); await post('/api/test/ok', e.currentTarget); set(11, 'Sent'); setPopup(false); }}><Inputs /><div className="flex gap-2"><Btn /><button type="button" className="mt-4 px-4" onClick={() => setPopup(false)}>Close</button></div></form></div></div>}
        <p className="mt-2 text-[13px]">{log[11]}</p>
      </Card>

      <Card n={12} title="Privacy filter: password, card, token and OTP fields" expect="confirmed" note="The lead must be stored WITHOUT password, card number, token, OTP and hidden fields. Open the lead and verify only Name, Email and Message exist.">
        <form onSubmit={async (e) => { e.preventDefault(); await post('/api/test/ok', e.currentTarget); set(12, 'Sent. Check the stored lead for leaked fields.'); }}>
          <Inputs extra={<><input name="password" type="password" defaultValue="hunter2hunter2" className="field" /><input name="card_number" defaultValue="4111 1111 1111 1111" className="field" /><input name="csrf_token" defaultValue="abc123" className="field" /><input name="otp" defaultValue="918273" className="field" /><input type="hidden" name="session" value="should-not-be-sent" /><input name="notes" defaultValue="Call me on 4242 4242 4242 4242 tomorrow" className="field sm:col-span-2" /></>} /><Btn /></form><p className="mt-2 text-[13px]">{log[12]}</p>
      </Card>

      <Card n={13} title="Form marked data-lc-ignore" expect="not captured" note="Opt-out attribute. No event should be sent at all.">
        <form data-lc-ignore onSubmit={async (e) => { e.preventDefault(); await post('/api/test/ok', e.currentTarget); set(13, 'Sent (ignored by Leadscollector)'); }}><Inputs /><Btn /></form><p className="mt-2 text-[13px]">{log[13]}</p>
      </Card>

      <Card n={14} title="Webflow-style success message (.w-form-done)" expect="confirmed" note="No network call at all. The built-in selector detects the success block becoming visible.">
        <div>
          <form onSubmit={(e) => { e.preventDefault(); setTimeout(() => setDone(true), 300); }} style={{ display: done ? 'none' : 'block' }}><Inputs /><Btn /></form>
          <div className="w-form-done rounded-md bg-green-50 p-4" style={{ display: done ? 'block' : 'none' }}>Thank you! Your submission has been received.</div>
        </div>
      </Card>

      <Card n={15} title="Manual API: window.leadscollector.track()" expect="confirmed" note="For fully custom forms. Call it after your own success check.">
        <button className="inline-flex h-10 items-center rounded-md bg-ink px-5 font-medium text-white" onClick={() => { // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).leadscollector?.track({ name: 'API Person', email: 'api@example.com', message: 'Sent via track()' }, { form: 'Custom API form' }); set(15, 'track() called'); }}>Call track()</button><p className="mt-2 text-[13px]">{log[15]}</p>
      </Card>

      <Card n={16} title="Honeypot filled in (bot behaviour)" expect="not captured" note="A hidden field named _hp is filled. The server accepts silently and stores nothing.">
        <form onSubmit={async (e) => { e.preventDefault(); await post('/api/test/ok', e.currentTarget); set(16, 'Sent'); }}><Inputs extra={<input name="_hp" defaultValue="i am a bot" className="field" />} /><Btn /></form><p className="mt-2 text-[13px]">{log[16]}</p>
      </Card>

      <Card n={17} title="Form inside an iframe (srcdoc)" expect="not captured" note="Cross-document forms cannot be observed from the parent page. Use the hosted endpoint or webhook for these.">
        <iframe title="Embedded form" className="h-64 w-full max-w-xl rounded-md border border-line" srcDoc={`<form onsubmit="event.preventDefault();document.body.append('Submitted inside iframe')"><p><input name=name value='Iframe Person'></p><p><input name=email value='iframe@example.com'></p><button>Send</button></form>`} />
      </Card>
    </div>
  );
}
