-- Leadscollector schema. Run with: npx supabase db push
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));

-- -------------------------------------------------------------- workspaces
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique,
  logo_url text,
  plan text not null default 'free' check (plan in ('free','pro')),
  owner_id uuid not null references auth.users(id),
  suspended boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','client')),
  status text not null default 'active' check (status in ('invited','active','revoked')),
  display_name text,
  email text,
  managed boolean not null default false, -- account was created by this workspace (password can be reset by it)
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index members_user_idx on public.members (user_id, status);

-- ---------------------------------------------------------------- websites
create table public.websites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  domain text not null,
  allowed_domains text[] not null default '{}',
  category text,
  description text,
  public_site_id text not null unique default ('lc_' || encode(extensions.gen_random_bytes(12), 'hex')),
  webhook_secret text not null default ('whsec_' || encode(extensions.gen_random_bytes(24), 'hex')),
  notification_email text,
  status text not null default 'pending' check (status in ('pending','installed','disabled')),
  last_seen_at timestamptz,
  first_event_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index websites_ws_idx on public.websites (workspace_id);

create table public.website_access (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  permission text not null default 'view' check (permission in ('view','update')),
  created_at timestamptz not null default now(),
  unique (website_id, member_id)
);
create index website_access_member_idx on public.website_access (member_id);

create table public.forms (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  fingerprint text not null,
  name text not null default 'Form',
  field_mapping jsonb not null default '{}'::jsonb,
  excluded_fields text[] not null default '{}',
  success_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, fingerprint)
);

-- ------------------------------------------------------------------- leads
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  form_id uuid references public.forms(id) on delete set null,
  status text not null default 'new' check (status in ('new','contacted','follow_up','qualified','converted','lost')),
  confidence text not null default 'confirmed' check (confidence in ('confirmed','probable','attempted')),
  signal text,
  name text,
  email text,
  phone text,
  message text,
  data jsonb not null default '{}'::jsonb,
  page_url text,
  referrer text,
  utm jsonb not null default '{}'::jsonb,
  source text,
  ip_hash text,
  user_agent text,
  dedupe_key text,
  submission_id text,
  assigned_to uuid references auth.users(id) on delete set null,
  followup_at timestamptz,
  locked boolean not null default false, -- stored but hidden: monthly plan cap exceeded
  submitted_at timestamptz not null default now(),
  confirmed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (
    lower(coalesce(name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'') || ' ' ||
          coalesce(message,'') || ' ' || coalesce(data::text,''))
  ) stored
);
create unique index leads_submission_key on public.leads (website_id, submission_id) where submission_id is not null;
create index leads_ws_time_idx on public.leads (workspace_id, submitted_at desc) where deleted_at is null;
create index leads_site_status_idx on public.leads (website_id, status);
create index leads_dedupe_idx on public.leads (website_id, dedupe_key, submitted_at desc);
create index leads_search_trgm on public.leads using gin (search_text extensions.gin_trgm_ops);

create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lead_notes_lead_idx on public.lead_notes (lead_id, created_at);

create table public.lead_activity (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  type text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index lead_activity_lead_idx on public.lead_activity (lead_id, created_at);

-- ------------------------------------------------------ integrations/outbox
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  website_id uuid references public.websites(id) on delete cascade,
  type text not null check (type in ('email','google_sheets')),
  name text,
  config jsonb not null default '{}'::jsonb,
  encrypted_credentials text,
  status text not null default 'active' check (status in ('active','needs_reauth','error','disabled')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index integrations_scope_key on public.integrations
  (workspace_id, type, coalesce(website_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','success','failed','retrying')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, integration_id)
);
create index deliveries_queue_idx on public.deliveries (status, next_attempt_at);
create index deliveries_ws_idx on public.deliveries (workspace_id, created_at desc);

-- ------------------------------------------------------------ audit/support
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_ws_idx on public.audit_log (workspace_id, created_at desc);

create table public.admin_support_access (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  reason text not null check (char_length(reason) >= 10),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.usage_counters (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  month date not null,
  lead_count int not null default 0,
  primary key (workspace_id, month)
);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- updated_at triggers
create trigger t_profiles_u before update on public.profiles for each row execute function public.set_updated_at();
create trigger t_workspaces_u before update on public.workspaces for each row execute function public.set_updated_at();
create trigger t_members_u before update on public.members for each row execute function public.set_updated_at();
create trigger t_websites_u before update on public.websites for each row execute function public.set_updated_at();
create trigger t_forms_u before update on public.forms for each row execute function public.set_updated_at();
create trigger t_leads_u before update on public.leads for each row execute function public.set_updated_at();
create trigger t_notes_u before update on public.lead_notes for each row execute function public.set_updated_at();
create trigger t_integrations_u before update on public.integrations for each row execute function public.set_updated_at();
create trigger t_deliveries_u before update on public.deliveries for each row execute function public.set_updated_at();

-- new auth user -> profile
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- realtime for the dashboard (RLS still applies to realtime messages)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.leads;
  end if;
exception when duplicate_object then null; end $$;

-- storage bucket for workspace logos (uploads happen server-side)
insert into storage.buckets (id, name, public) values ('logos', 'logos', true) on conflict (id) do nothing;
