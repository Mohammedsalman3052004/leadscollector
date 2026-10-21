/**
 * Runs the real public/lc.js inside jsdom and checks what it sends: attempts vs confirmations,
 * failure handling, privacy filtering and opt-outs.
 */
import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const src = readFileSync(path.resolve(__dirname, '../public/lc.js'), 'utf8');
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

interface Sent { event: string; signal?: string; fields?: Record<string, unknown>; submission_id: string; promote?: boolean }

function setup(html: string, pageFetch: (url: string, init?: any) => Response | Promise<Response>, cfg: Record<string, unknown> = { excluded: ['dob'] }) {
  const dom = new JSDOM(`<!doctype html><html><head><script src="https://app.test/lc.js" data-site-id="lc_testsite123"></script></head><body>${html}</body></html>`, {
    url: 'https://client.test/contact', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window as any;
  const sent: Sent[] = [];
  w.fetch = vi.fn(async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('https://app.test/api/ingest')) { sent.push(JSON.parse(init.body)); return new Response('{}', { status: 202 }); }
    if (url.startsWith('https://app.test/api/tracker-config')) return new Response(JSON.stringify(cfg), { headers: { 'content-type': 'application/json' } });
    return pageFetch(url, init);
  });
  w.eval(src);
  const submit = (el: Element) => el.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  return { w, sent, submit, doc: w.document as Document };
}
const form = `<form id="f" action="/send"><input name="name" value="Priya"><input name="email" value="p@example.com"><textarea name="message">Hi there</textarea></form>`;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const ajax = (t: ReturnType<typeof setup>, call: () => void) => {
  const f = t.doc.getElementById('f')!;
  f.addEventListener('submit', (e) => { e.preventDefault(); call(); });
  t.submit(f);
};

describe('tracker behaviour (jsdom)', () => {
  it('sends an attempt, then confirms after a 2xx fetch response', async () => {
    const t = setup(form, () => json({ ok: true }));
    ajax(t, () => t.w.fetch('/send', { method: 'POST', body: JSON.stringify({ name: 'Priya', email: 'p@example.com' }) }));
    await tick(80);
    expect(t.sent.map((s) => s.event)).toEqual(['attempted', 'confirmed']);
    expect(t.sent[1].signal).toBe('network_2xx');
    expect(t.sent[0].submission_id).toBe(t.sent[1].submission_id);
    expect(t.sent[0].fields).toMatchObject({ name: 'Priya', email: 'p@example.com', message: 'Hi there' });
  });

  it('does NOT confirm when the backend returns HTTP 500', async () => {
    const t = setup(form, () => json({ error: 'boom' }, 500));
    ajax(t, () => t.w.fetch('/send', { method: 'POST', body: 'name=Priya' }));
    await tick(80);
    expect(t.sent.map((s) => s.event)).toEqual(['attempted']);
  });

  it('does NOT confirm a 200 response whose body says success:false', async () => {
    const t = setup(form, () => json({ success: false, error: 'invalid' }));
    ajax(t, () => t.w.fetch('/send', { method: 'POST', body: 'name=Priya' }));
    await tick(80);
    expect(t.sent.map((s) => s.event)).toEqual(['attempted']);
  });

  it('ignores unrelated POST requests made right after a submit (analytics)', async () => {
    const t = setup(form, () => json({ ok: true }));
    ajax(t, () => t.w.fetch('https://analytics.example/collect', { method: 'POST', body: 'v=1&t=event' }));
    await tick(80);
    expect(t.sent.map((s) => s.event)).toEqual(['attempted']);
  });

  it('never sends passwords, hidden inputs, card numbers, tokens or OTPs', async () => {
    const html = `<form id="f"><input name="name" value="A"><input type="password" name="pw" value="secret"><input type="hidden" name="h" value="x"><input name="card_number" value="4111111111111111"><input name="csrf_token" value="t"><input name="otp" value="123"><input name="notes" value="pay with 4111 1111 1111 1111 ok"></form>`;
    const t = setup(html, () => json({}));
    t.submit(t.doc.getElementById('f')!);
    await tick();
    const fields = t.sent[0].fields as Record<string, string>;
    expect(Object.keys(fields).sort()).toEqual(['name', 'notes']);
    expect(fields.notes).toBe('pay with [redacted] ok');
  });

  it('respects data-lc-ignore and server-configured excluded fields', async () => {
    const t = setup(`<form id="a" data-lc-ignore><input name="name" value="A"></form><form id="b"><input name="name" value="B"><input name="dob" value="1990"></form>`, () => json({}));
    await tick(60); // let the config load
    t.submit(t.doc.getElementById('a')!);
    t.submit(t.doc.getElementById('b')!);
    await tick();
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0].fields).toEqual({ name: 'B' });
  });

  it('confirms through the Contact Form 7 event and the public success event', async () => {
    const t = setup(form, () => json({}));
    const f = t.doc.getElementById('f')!;
    f.addEventListener('submit', (e) => e.preventDefault());
    t.submit(f);
    await tick();
    f.dispatchEvent(new t.w.CustomEvent('wpcf7mailsent', { bubbles: true }));
    await tick();
    expect(t.sent.map((s) => `${s.event}:${s.signal}`)).toEqual(['attempted:submit', 'confirmed:adapter']);

    const t2 = setup(form, () => json({}));
    ajax(t2, () => undefined);
    await tick();
    t2.w.dispatchEvent(new t2.w.Event('leadscollector:success'));
    await tick();
    expect(t2.sent.map((s) => s.signal)).toEqual(['submit', 'event']);
  });

  it('confirms when a built-in success message becomes visible', async () => {
    const t = setup(`${form}<div class="w-form-done" style="display:none">Thanks</div>`, () => json({}));
    ajax(t, () => undefined);
    await tick();
    const done = t.doc.querySelector('.w-form-done') as HTMLElement;
    Object.defineProperty(done, 'offsetWidth', { value: 100 }); // jsdom has no layout engine
    done.style.display = 'block';
    await tick(80);
    expect(t.sent.map((s) => s.signal)).toEqual(['submit', 'selector']);
  });

  it('offers a manual track() API that confirms and still filters sensitive keys', async () => {
    const t = setup('', () => json({}));
    t.w.leadscollector.track({ name: 'API', email: 'a@b.co', password: 'nope' }, { form: 'Custom' });
    await tick();
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toMatchObject({ event: 'confirmed', signal: 'api', fields: { name: 'API', email: 'a@b.co' } });
  });

  it('holds everything back in consent mode until consent is given', async () => {
    const t = setup(form, () => json({}), { consent: true });
    await tick(60); // config (consent: true) loads
    ajax(t, () => undefined);
    await tick();
    expect(t.sent).toHaveLength(0);
    t.w.leadscollector.consent(true);
    ajax(t, () => undefined);
    await tick();
    expect(t.sent.length).toBeGreaterThan(0);
  });
});
