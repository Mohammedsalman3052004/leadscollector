// Seeds a demo workspace. Usage: npm run seed   (reads .env.local)
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'); process.exit(1); }
if (process.env.NODE_ENV === 'production') { console.error('Refusing to seed in production.'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

const OWNER = { email: 'owner@leadscollector.test', password: 'Demo-owner-12345', name: 'Salman Demo' };
const CLIENT = { email: 'client@leadscollector.test', password: 'Demo-client-12345', name: 'Teknix Client' };

async function ensureUser(u) {
  const { data: existing } = await db.from('profiles').select('id').eq('email', u.email).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await db.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true, user_metadata: { full_name: u.name } });
  if (error) throw error;
  return data.user.id;
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const ownerId = await ensureUser(OWNER);
const clientId = await ensureUser(CLIENT);

let { data: ws } = await db.from('workspaces').select('id').eq('slug', 'pinakkaa-demo').maybeSingle();
if (ws) { console.log('Demo workspace already exists - nothing to do.'); process.exit(0); }

({ data: ws } = await db.from('workspaces').insert({ name: 'Pinakkaa Demo', slug: 'pinakkaa-demo', owner_id: ownerId, plan: 'pro' }).select('id').single());
const { data: ownerMember } = await db.from('members').insert({ workspace_id: ws.id, user_id: ownerId, role: 'owner', status: 'active', display_name: OWNER.name, email: OWNER.email }).select('id').single();
const { data: clientMember } = await db.from('members').insert({ workspace_id: ws.id, user_id: clientId, role: 'client', status: 'active', display_name: CLIENT.name, email: CLIENT.email, managed: true, invited_by: ownerId }).select('id').single();

const sitesDef = [
  { name: 'Teknix', domain: 'teknix.in', category: 'Elevators' },
  { name: 'Homely', domain: 'homely.in', category: 'Real estate' },
  { name: 'Tula Properties', domain: 'tulaproperties.com', category: 'Real estate' },
];
const sites = [];
for (const s of sitesDef) {
  const { data } = await db.from('websites').insert({ workspace_id: ws.id, ...s, status: 'installed', last_seen_at: new Date().toISOString(), first_event_at: new Date().toISOString(), notification_email: OWNER.email }).select('id,name').single();
  sites.push(data);
}
await db.from('website_access').insert({ website_id: sites[0].id, member_id: clientMember.id, permission: 'view' });
await db.from('integrations').insert({ workspace_id: ws.id, website_id: null, type: 'email', name: 'Email notifications', config: { recipients: [OWNER.email] }, status: 'active' });

const names = ['Priya Raman', 'Arjun Mehta', 'Karthik S', 'Divya Nair', 'Rahul Verma', 'Ananya Iyer', 'Vikram Rao', 'Meera Pillai', 'Suresh Kumar', 'Lakshmi Devi'];
const statuses = ['new', 'new', 'new', 'contacted', 'follow_up', 'qualified', 'converted', 'lost'];
const confs = ['confirmed', 'confirmed', 'confirmed', 'confirmed', 'probable'];
const sources = ['google', 'direct', 'instagram', 'facebook', 'newsletter'];
const forms = {};
for (const s of sites) {
  for (const f of ['Contact Us', 'Get a Quote']) {
    const { data } = await db.from('forms').insert({ website_id: s.id, fingerprint: `seed-${s.id.slice(0, 6)}-${f}`, name: f }).select('id,name').single();
    (forms[s.id] ??= []).push(data);
  }
}
const rows = [];
for (let i = 0; i < 45; i++) {
  const site = sites[i % 3];
  const form = pick(forms[site.id]);
  const n = pick(names);
  const first = n.split(' ')[0].toLowerCase();
  const when = new Date(Date.now() - Math.floor(Math.random() * 28 * 86400_000));
  const data = site.name === 'Teknix'
    ? { 'Building type': pick(['Residential', 'Commercial', 'Hospital']), 'Number of floors': String(2 + Math.floor(Math.random() * 14)) }
    : { 'Property type': pick(['Apartment', 'Villa', 'Plot']), Budget: pick(['50L-75L', '75L-1Cr', '1Cr+']) };
  rows.push({
    workspace_id: ws.id, website_id: site.id, form_id: form.id, status: pick(statuses), confidence: pick(confs), signal: 'network_2xx',
    name: n, email: `${first}${i}@example.com`, phone: '98' + String(10000000 + Math.floor(Math.random() * 89999999)),
    message: pick(['Please call me back.', 'Need a quote for this month.', 'Looking for details and pricing.', 'Can we schedule a site visit?']),
    data, page_url: `https://${site.name.toLowerCase()}.example/contact`, source: pick(sources), utm: {}, submission_id: randomBytes(8).toString('hex'),
    submitted_at: when.toISOString(), confirmed_at: when.toISOString(),
  });
}
const { error } = await db.from('leads').insert(rows);
if (error) throw error;
await db.from('usage_counters').upsert({ workspace_id: ws.id, month: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10), lead_count: rows.length });
console.log('\nSeeded demo workspace "Pinakkaa Demo" (Pro) with 3 websites and', rows.length, 'leads.');
console.log('Owner :', OWNER.email, '/', OWNER.password);
console.log('Client:', CLIENT.email, '/', CLIENT.password, '(sees only Teknix)');
