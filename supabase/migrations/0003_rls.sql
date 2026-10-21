-- Row Level Security. Principle: the browser/API role ("authenticated") can only READ what it is
-- allowed to see and update a few harmless lead columns. Every other write goes through server
-- code using the service role after explicit authorization checks.

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.members enable row level security;
alter table public.websites enable row level security;
alter table public.website_access enable row level security;
alter table public.forms enable row level security;
alter table public.leads enable row level security;
alter table public.lead_notes enable row level security;
alter table public.lead_activity enable row level security;
alter table public.integrations enable row level security;
alter table public.deliveries enable row level security;
alter table public.audit_log enable row level security;
alter table public.admin_support_access enable row level security;
alter table public.usage_counters enable row level security;
alter table public.rate_limits enable row level security; -- no policies: service role only

revoke all on all tables in schema public from anon;

-- profiles
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- workspaces (hide stripe ids; owners/admins may only rename / change logo)
create policy ws_select on public.workspaces for select to authenticated
  using (public.is_member(id) or public.is_platform_admin());
create policy ws_update on public.workspaces for update to authenticated
  using (public.is_manager(id)) with check (public.is_manager(id));
revoke select, update on public.workspaces from authenticated;
grant select (id, name, slug, logo_url, plan, suspended, owner_id, created_at) on public.workspaces to authenticated;
grant update (name, logo_url) on public.workspaces to authenticated;

-- members: staff see everyone in the workspace; clients only themselves
create policy members_select on public.members for select to authenticated
  using (public.is_staff(workspace_id) or user_id = auth.uid());

-- websites: clients may only see websites they were granted. Sensitive columns are not selectable.
create policy websites_select on public.websites for select to authenticated using (public.can_see_website(id));
revoke select on public.websites from authenticated;
grant select (id, workspace_id, name, domain, category, status, last_seen_at, public_site_id, created_at)
  on public.websites to authenticated;

create policy access_select on public.website_access for select to authenticated
  using (
    exists (select 1 from public.websites w where w.id = website_id and public.is_staff(w.workspace_id))
    or exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid())
  );

create policy forms_select on public.forms for select to authenticated using (public.can_see_website(website_id));

-- leads
create policy leads_select on public.leads for select to authenticated
  using ((public.can_see_website(website_id) and locked = false) or public.has_support_access(workspace_id));
create policy leads_update on public.leads for update to authenticated
  using (public.can_update_website(website_id) and locked = false and deleted_at is null)
  with check (public.can_update_website(website_id));
revoke update on public.leads from authenticated;
grant update (status, followup_at) on public.leads to authenticated;

create policy notes_select on public.lead_notes for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy notes_insert on public.lead_notes for insert to authenticated
  with check (author_id = auth.uid() and exists (
    select 1 from public.leads l where l.id = lead_id and public.can_update_website(l.website_id)));

create policy activity_select on public.lead_activity for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy activity_insert on public.lead_activity for insert to authenticated
  with check (actor_id = auth.uid() and exists (
    select 1 from public.leads l where l.id = lead_id and public.can_update_website(l.website_id)));

-- integrations: managers only; credentials column is never selectable from the browser
create policy integrations_select on public.integrations for select to authenticated using (public.is_manager(workspace_id));
revoke select on public.integrations from authenticated;
grant select (id, workspace_id, website_id, type, name, config, status, last_synced_at, last_error, created_at, updated_at)
  on public.integrations to authenticated;

create policy deliveries_select on public.deliveries for select to authenticated using (public.is_manager(workspace_id));

create policy audit_select on public.audit_log for select to authenticated using (public.is_manager(workspace_id));

create policy support_select on public.admin_support_access for select to authenticated
  using (admin_id = auth.uid() or public.is_manager(workspace_id));

create policy usage_select on public.usage_counters for select to authenticated using (public.is_staff(workspace_id));
