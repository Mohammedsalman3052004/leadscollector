# Leadscollector

Multi-tenant website lead collection platform. **Register website -> paste one script tag -> receive leads.**
Agencies create a workspace, add client websites, and give each client a login that sees only their own website, under the agency's name and logo.

Stack: **Next.js 15 (App Router, TypeScript) on Vercel**, **Supabase** (Postgres, Auth, Row Level Security, Realtime, Storage), Tailwind CSS, Recharts, Zod. Email through Resend, Sheets through the Google Sheets REST API, spam protection through Cloudflare Turnstile (optional).

---------------------------------------------------------------------------

## 1. Quick start (local)

Requirements: Node.js 20.6+ and a Supabase project.

```bash
npm install
cp .env.example .env.local        # fill in the values (see section 3)
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push              # applies supabase/migrations/*.sql (schema, functions, RLS)
npm run seed                      # optional demo workspace + sample leads (never run in production)
npm run dev                       # http://localhost:3000
```

Make yourself platform admin (once, in the Supabase SQL editor, after signing up):

```sql
update public.profiles set is_platform_admin = true where email = 'you@example.com';
```

Demo logins created by `npm run seed`:

| Role   | Email                         | Password            |
|--------|-------------------------------|---------------------|
| Owner  | owner@leadscollector.test     | Demo-owner-12345    |
| Client | client@leadscollector.test    | Demo-client-12345   |

The client sees only the "Teknix" website. Sign in with each to see the difference.

## 2. Scripts

| Command            | What it does                                                                   |
|--------------------|--------------------------------------------------------------------------------|
| `npm run dev`      | Development server                                                             |
| `npm run build`    | Production build                                                               |
| `npm run typecheck`| TypeScript check                                                               |
| `npm test`         | Unit tests + tracker behaviour tests (jsdom). RLS tests are skipped by default |
| `npm run test:rls` | Tenant-isolation tests against your real Supabase project (needs env vars)     |
| `npm run seed`     | Demo data                                                                      |

`test:rls` creates temporary users/workspaces, tries to read and change other tenants' data, and cleans up. Run it with the variables from `.env.local` exported (for example `set -a; source .env.local; set +a; npm run test:rls`).

## 3. Environment variables

See `.env.example`. Required: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `ENCRYPTION_KEY` (`openssl rand -base64 32`), `CRON_SECRET`, `IP_HASH_SALT`.
Optional: `RESEND_API_KEY` + `EMAIL_FROM`, `GOOGLE_CLIENT_ID/SECRET/SHEETS_REDIRECT_URI`, `TURNSTILE_*`, `STRIPE_*`.

## 4. Supabase setup

1. Create a project; copy the URL, anon key and service-role key.
2. **Authentication -> URL Configuration:** Site URL = your app URL; add `https://YOUR-DOMAIN/auth/callback` (and the localhost one) to Redirect URLs.
3. **Authentication -> Providers -> Google:** enable and paste the Google OAuth client ID and secret. In Google Cloud add Supabase's callback URL (`https://<ref>.supabase.co/auth/v1/callback`) as an authorized redirect URI.
4. **Authentication -> SMTP:** configure your own SMTP (Resend works). Supabase's built-in sender is for testing only.
5. Optional: paste `supabase/templates/*.html` into Authentication -> Email Templates for branded emails.
6. The migrations create the `logos` storage bucket and enable Realtime on `leads`.

## 5. Google Sheets (Pro feature)

Create a **separate** OAuth client (Web application) with redirect URI `https://YOUR-DOMAIN/api/integrations/google/callback`, enable the Google Sheets API, and set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_SHEETS_REDIRECT_URI`.
The requested scope is `spreadsheets`, which Google treats as sensitive: while the consent screen is in *Testing* only listed test users can connect, and a public launch needs Google's app verification.

## 6. Deploying to Vercel

1. Push to GitHub, import the repo in Vercel (framework: Next.js).
2. Add every environment variable (production values, new secrets).
3. Add your domain, then update Supabase redirect URLs and Google origins/redirects.
4. **Background jobs.** `vercel.json` schedules `/api/jobs/deliver` and `/api/jobs/cleanup` daily (the Hobby plan only allows daily crons). New leads trigger delivery immediately after the response, so cron is only the *retry safety net*. For minute-level retries either raise the schedule on a paid Vercel plan or use `supabase/optional/pg_cron.sql` (pg_cron + pg_net). Both job routes require `Authorization: Bearer $CRON_SECRET`; Vercel sends it automatically when `CRON_SECRET` is set.
5. Vercel's free Hobby plan is for non-commercial use; use a paid plan for a commercial product.

---------------------------------------------------------------------------

## 7. How capture works (and what it cannot do)

Every lead carries a **confidence level**, and only `confirmed` and `probable` leads are counted, shown by default and notified.

| Method | Confidence | Reliability | Needs config |
|---|---|---|---|
| Server **webhook** (`/api/webhook/<site>`, HMAC signed) | confirmed | Highest: your backend vouches for it | Yes (code) |
| **Hosted endpoint** (`/api/f/<site>` as form action or fetch target) | confirmed | Highest | One-line form change |
| **Library adapters** (Contact Form 7, WPForms, Gravity, Elementor, HubSpot, Webflow message) | confirmed | High | None |
| **Network observation** (fetch/XHR wrapped; 2xx confirms; HTTP errors and `success:false` bodies do not) | confirmed | Medium-high. Request is matched to the form by URL or body | None |
| **Success signals** (success URL, success selector, `leadscollector:success` event, `track()` API) | confirmed | Medium-high | Per-site setting or one line of code |
| **Navigation heuristic** (native form post, page moved on, tracker present on next page) | probable | Medium. Acceptance not observed | None |
| Raw submit with nothing else | attempted | Low. Hidden by default, never counted or emailed | - |

Known limitations (also in `/docs`):
- Forms inside **cross-origin iframes** cannot be read (Typeform etc.). Use their webhook, the hosted endpoint or the webhook route.
- A native form posting to a **third-party URL** cannot be confirmed from the page.
- Success that produces **no network call and no visible change** needs a success URL, the success event, or a webhook.
- Ad blockers and strict CSPs can block `lc.js`; the hosted endpoint and webhook are unaffected.
- Next.js **server actions** use opaque requests; dispatch `window.dispatchEvent(new Event('leadscollector:success'))` after success (documented, tested on `/test-forms`).
- A generic script can never prove acceptance by a backend it cannot observe, which is why confidence levels exist.

Use `/test-forms?site=<id>` (development only; add a website with domain `localhost`) to try 17 form types and compare against the expected result printed on each card.

## 8. Security model

- **Tenant isolation is enforced by Postgres RLS**, not just the UI. Browser/API users can only *read* what they may see, plus update `leads.status`/`followup_at`, add notes and edit their profile (column-level grants). Everything else is written by server code using the service role after an explicit role check.
- Clients get access through `website_access` (one website per client login, `view` or `update`). They cannot see other websites, members, integrations, secrets, billing or other clients, and cannot delete leads.
- Sensitive columns are not selectable by browser users: `websites.webhook_secret`, `integrations.encrypted_credentials`, Stripe ids.
- Platform admins **cannot read lead contents** unless a logged, time-limited **support grant** exists (`admin_support_access`); RLS enforces it. Admin pages show counts and delivery errors only.
- Public ingestion: site ID lookup, Origin/Referer allow-list against the registered domains, payload size and shape validation (Zod), fixed-window rate limits per site and per IP (Postgres, no extra service), honeypot, optional Turnstile, server-side re-filtering of sensitive fields, card-number redaction (Luhn), idempotency/dedupe, per-plan monthly caps.
- Integration credentials are AES-256-GCM encrypted (`ENCRYPTION_KEY`). Google OAuth uses a signed, expiring state bound to the user and a cookie.
- Passwords for client logins can only be reset by the workspace that created that account (`members.managed`), so an agency can never take over an account that belongs to someone else.
- Visitor IPs are stored only as a salted hash. The tracker sets no cookies.
- Lead content is rendered through React (escaped) and exported to CSV with formula-injection protection. Dashboard pages send a strict CSP and security headers.

## 9. Reliability model

1. `ingest_lead()` stores the lead, its confidence, activity and **pending delivery rows in one database transaction**.
2. The response returns immediately; `after()` then tries deliveries for that lead.
3. `deliveries` is an outbox. `claim_deliveries()` pre-schedules the next retry (1, 5, 25, 125, 625 minutes, max 6 attempts) so a crash never loses work.
4. Email uses an idempotency key; Sheets checks the lead ID in column A before appending, so retries never duplicate rows. Values are written RAW (no formula execution).
5. Expired/revoked Google access marks the integration `needs_reauth`, stops retries, emails the owner, and resumes automatically after reconnecting.
6. Over-quota leads are **stored but locked** (never dropped) and released on upgrade.
7. A queue service is not required for this volume; the outbox + cron is the simple, robust choice.

## 10. Plans

Defined in `src/lib/plans.ts` (edit prices and limits there). Free: 1 website, 100 leads/month, email, CSV, 30-day retention. Pro: 25 websites, 5,000 leads/month, client logins, Google Sheets, white-label, 2-year retention. Limits are enforced on the server (ingestion cap, website/team/client caps, feature gates). Stripe checkout and webhook handlers are scaffolded (`/api/billing/*`); set the `STRIPE_*` variables to enable them.

## 11. Project structure

```
src/app/(marketing)    landing, pricing, docs, privacy, terms
src/app/(auth)         login, signup, forgot/reset password;  src/app/auth  callback + token-hash confirm
src/app/app            dashboard: overview, leads, websites, integrations, team, settings, billing
src/app/admin          platform admin: metrics, workspaces, websites, delivery errors, support grants, audit log
src/app/api            ingest, f/[siteId], webhook/[siteId], tracker-config, jobs/*, export, billing/*, integrations/google/*
src/app/actions        server actions (auth, workspace, websites, leads, team, integrations, admin)
src/app/test-forms     dev-only page with 17 form types
src/lib                supabase clients, auth guards, plans, crypto, ingest/*, delivery/*, email, billing
src/components         ui primitives, layout shell, leads table, websites wizard, forms
public/lc.js           the tracker (about 5.7 KB gzipped, no dependencies, no cookies)
supabase/migrations    0001 schema, 0002 functions, 0003 RLS
supabase/optional      pg_cron job definitions
supabase/templates     branded Supabase auth emails
scripts/seed.mjs       demo data
tests/                 unit, tracker behaviour (jsdom), RLS isolation
```

## 12. Decisions taken (change freely)

- Search uses a trigram index over name, email, phone, message and custom fields (fast substring search) rather than Postgres full-text.
- Client logins can be created with a shared password or an invite link; existing accounts are added without touching their password.
- Dates render in `NEXT_PUBLIC_TIMEZONE` (default Asia/Kolkata).
- Fonts load from Google Fonts at runtime; self-host them if your CSP policy requires it.
- Not included: end-to-end browser tests (Playwright). Covered instead by unit tests, jsdom tracker tests, RLS integration tests and the manual checklist in the setup guide.
- Legal pages (`/privacy`, `/terms`) are templates to review with a lawyer. Check GDPR / India DPDP obligations for the regions you serve.
