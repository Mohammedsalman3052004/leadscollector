-- Helper + ingestion functions

-- ---------- RLS helpers (security definer to avoid policy recursion) ----------
create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.ws_role(ws uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.members where workspace_id = ws and user_id = auth.uid() and status = 'active' limit 1
$$;

create or replace function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$ select public.ws_role(ws) is not null $$;

create or replace function public.is_staff(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.ws_role(ws) in ('owner','admin','member'), false)
$$;

create or replace function public.is_manager(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.ws_role(ws) in ('owner','admin'), false)
$$;

create or replace function public.can_see_website(site uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.websites w
    where w.id = site and (
      public.is_staff(w.workspace_id)
      or exists (select 1 from public.website_access a join public.members m on m.id = a.member_id
                 where a.website_id = w.id and m.user_id = auth.uid() and m.status = 'active' and m.workspace_id = w.workspace_id)
    )
  )
$$;

create or replace function public.can_update_website(site uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.websites w
    where w.id = site and (
      public.is_staff(w.workspace_id)
      or exists (select 1 from public.website_access a join public.members m on m.id = a.member_id
                 where a.website_id = w.id and a.permission = 'update' and m.user_id = auth.uid()
                   and m.status = 'active' and m.workspace_id = w.workspace_id)
    )
  )
$$;

create or replace function public.has_support_access(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() and exists (
    select 1 from public.admin_support_access s
    where s.workspace_id = ws and s.admin_id = auth.uid() and s.expires_at > now())
$$;

-- ---------- workspace creation (caller becomes owner) ----------
create or replace function public.create_workspace(p_name text, p_slug text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_uid uuid := auth.uid(); v_prof public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_prof from public.profiles where id = v_uid;
  insert into public.workspaces (name, slug, owner_id) values (trim(p_name), p_slug, v_uid) returning id into v_id;
  insert into public.members (workspace_id, user_id, role, status, display_name, email)
  values (v_id, v_uid, 'owner', 'active', coalesce(v_prof.full_name, split_part(v_prof.email,'@',1)), v_prof.email);
  return v_id;
end $$;

-- ---------- rate limiting (fixed window) ----------
create or replace function public.rl_hit(p_key text, p_limit int, p_window int) returns boolean
language plpgsql security definer set search_path = public as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window) * p_window); c int;
begin
  insert into public.rate_limits (key, window_start, count) values (p_key, w, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into c;
  return c <= p_limit;
end $$;

-- ---------- delivery rows (outbox) ----------
create or replace function public.create_lead_deliveries(p_lead uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.deliveries (lead_id, integration_id, workspace_id)
  select l.id, i.id, l.workspace_id
  from public.leads l
  join public.integrations i on i.workspace_id = l.workspace_id and i.status = 'active'
       and (i.website_id is null or i.website_id = l.website_id)
  where l.id = p_lead
  on conflict (lead_id, integration_id) do nothing
$$;

create or replace function public.bump_usage(p_ws uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_month date := date_trunc('month', now())::date; v_prev int;
begin
  select coalesce(lead_count, 0) into v_prev from public.usage_counters where workspace_id = p_ws and month = v_month;
  v_prev := coalesce(v_prev, 0);
  insert into public.usage_counters (workspace_id, month, lead_count) values (p_ws, v_month, 1)
  on conflict (workspace_id, month) do update set lead_count = public.usage_counters.lead_count + 1;
  return v_prev; -- count BEFORE this lead
end $$;

-- ---------- the ingestion transaction ----------
-- Stores (or merges into) a lead and its pending deliveries in ONE transaction.
-- Confidence only ever moves up: attempted -> probable -> confirmed.
create or replace function public.ingest_lead(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_site uuid := (p->>'website_id')::uuid;
  v_ws uuid := (p->>'workspace_id')::uuid;
  v_conf text := coalesce(p->>'confidence', 'attempted');
  v_cap int := nullif(p->>'monthly_cap', '')::int;
  v_sub text := nullif(p->>'submission_id', '');
  v_dk text := nullif(p->>'dedupe_key', '');
  v_promote_only boolean := coalesce((p->>'promote_only')::boolean, false);
  v_form uuid;
  v_lead public.leads%rowtype;
  v_new_rank int;
  v_old_rank int;
  v_prev int;
  v_locked boolean := false;
  v_id uuid;
begin
  v_new_rank := case v_conf when 'confirmed' then 3 when 'probable' then 2 else 1 end;

  if v_sub is not null then
    select * into v_lead from public.leads
    where website_id = v_site and submission_id = v_sub and deleted_at is null limit 1;
  end if;
  if v_lead.id is null and v_dk is not null and not v_promote_only then
    select * into v_lead from public.leads
    where website_id = v_site and dedupe_key = v_dk and deleted_at is null
      and submitted_at > now() - interval '2 minutes'
    order by submitted_at desc limit 1;
  end if;

  if v_lead.id is not null then
    v_old_rank := case v_lead.confidence when 'confirmed' then 3 when 'probable' then 2 else 1 end;
    if v_new_rank > v_old_rank then
      v_locked := v_lead.locked;
      if v_old_rank = 1 then
        v_prev := public.bump_usage(v_ws);
        v_locked := (v_cap is not null and v_prev >= v_cap);
      end if;
      update public.leads set
        confidence = v_conf,
        signal = coalesce(p->>'signal', signal),
        confirmed_at = case when v_conf = 'confirmed' then now() else confirmed_at end,
        data = data || coalesce(p->'data', '{}'::jsonb),
        name = coalesce(name, nullif(p->>'name', '')),
        email = coalesce(email, nullif(p->>'email', '')),
        phone = coalesce(phone, nullif(p->>'phone', '')),
        message = coalesce(message, nullif(p->>'message', '')),
        locked = v_locked
      where id = v_lead.id;
      insert into public.lead_activity (lead_id, type, meta)
      values (v_lead.id, v_conf, jsonb_build_object('signal', p->>'signal'));
      if v_old_rank = 1 and not v_locked then perform public.create_lead_deliveries(v_lead.id); end if;
      return jsonb_build_object('status', case when v_locked then 'locked' else 'updated' end, 'lead_id', v_lead.id, 'promoted', true);
    end if;
    return jsonb_build_object('status', 'duplicate', 'lead_id', v_lead.id);
  end if;

  if v_promote_only then return jsonb_build_object('status', 'not_found'); end if;

  insert into public.forms (website_id, fingerprint, name)
  values (v_site, coalesce(p->>'form_fingerprint', 'default'), coalesce(nullif(p->>'form_name', ''), 'Form'))
  on conflict (website_id, fingerprint) do update set fingerprint = excluded.fingerprint
  returning id into v_form;

  if v_new_rank > 1 then
    v_prev := public.bump_usage(v_ws);
    v_locked := (v_cap is not null and v_prev >= v_cap);
  end if;

  insert into public.leads (
    workspace_id, website_id, form_id, confidence, signal, name, email, phone, message, data,
    page_url, referrer, utm, source, ip_hash, user_agent, dedupe_key, submission_id, locked,
    submitted_at, confirmed_at)
  values (
    v_ws, v_site, v_form, v_conf, p->>'signal', nullif(p->>'name', ''), nullif(p->>'email', ''),
    nullif(p->>'phone', ''), nullif(p->>'message', ''), coalesce(p->'data', '{}'::jsonb),
    nullif(p->>'page_url', ''), nullif(p->>'referrer', ''), coalesce(p->'utm', '{}'::jsonb),
    nullif(p->>'source', ''), p->>'ip_hash', left(p->>'user_agent', 400), v_dk, v_sub, v_locked,
    coalesce(nullif(p->>'submitted_at', '')::timestamptz, now()),
    case when v_conf = 'confirmed' then now() end)
  returning id into v_id;

  insert into public.lead_activity (lead_id, type, meta)
  values (v_id, 'received', jsonb_build_object('confidence', v_conf, 'signal', p->>'signal'));

  if v_new_rank > 1 and not v_locked then perform public.create_lead_deliveries(v_id); end if;

  update public.websites set
    last_seen_at = now(),
    first_event_at = coalesce(first_event_at, now()),
    status = case when status = 'pending' then 'installed' else status end
  where id = v_site;

  return jsonb_build_object('status', case when v_locked then 'locked' else 'created' end, 'lead_id', v_id);
exception when unique_violation then
  return jsonb_build_object('status', 'duplicate');
end $$;

-- ---------- delivery queue ----------
-- Claims due deliveries and pre-schedules the next retry (1, 5, 25, 125, 625 minutes) so a crash never loses work.
create or replace function public.claim_deliveries(p_limit int) returns setof public.deliveries
language sql security definer set search_path = public as $$
  update public.deliveries d set
    status = 'retrying',
    attempts = d.attempts + 1,
    next_attempt_at = now() + (interval '1 minute' * power(5, least(d.attempts, 4)))
  where d.id in (
    select id from public.deliveries
    where status in ('pending','retrying') and next_attempt_at <= now() and attempts < 6
    order by next_attempt_at limit p_limit for update skip locked)
  returning d.*
$$;

-- When a workspace upgrades, release leads that were stored but hidden by the plan cap.
create or replace function public.release_locked_leads(p_ws uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int; r record;
begin
  update public.leads set locked = false where workspace_id = p_ws and locked = true and confidence <> 'attempted';
  get diagnostics v_n = row_count;
  for r in select id from public.leads where workspace_id = p_ws and confidence <> 'attempted' and deleted_at is null
           and submitted_at > now() - interval '31 days' loop
    perform public.create_lead_deliveries(r.id);
  end loop;
  return v_n;
end $$;

-- ---------- retention / housekeeping ----------
create or replace function public.run_cleanup(p_free_days int, p_pro_days int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a int; b int; c int; d int; e int;
begin
  delete from public.leads where workspace_id in (select id from public.workspaces where plan = 'free')
    and submitted_at < now() - make_interval(days => p_free_days);
  get diagnostics a = row_count;
  delete from public.leads where workspace_id in (select id from public.workspaces where plan = 'pro')
    and submitted_at < now() - make_interval(days => p_pro_days);
  get diagnostics b = row_count;
  delete from public.leads where deleted_at is not null and deleted_at < now() - interval '30 days';
  get diagnostics c = row_count;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  get diagnostics d = row_count;
  delete from public.deliveries where status = 'success' and completed_at < now() - interval '30 days';
  get diagnostics e = row_count;
  delete from public.admin_support_access where expires_at < now() - interval '90 days';
  return jsonb_build_object('free_expired', a, 'pro_expired', b, 'soft_deleted', c, 'rate_limits', d, 'deliveries', e);
end $$;

-- ---------- permissions: service-only functions ----------
revoke all on function public.rl_hit(text, int, int) from public, anon, authenticated;
revoke all on function public.ingest_lead(jsonb) from public, anon, authenticated;
revoke all on function public.claim_deliveries(int) from public, anon, authenticated;
revoke all on function public.create_lead_deliveries(uuid) from public, anon, authenticated;
revoke all on function public.bump_usage(uuid) from public, anon, authenticated;
revoke all on function public.release_locked_leads(uuid) from public, anon, authenticated;
revoke all on function public.run_cleanup(int, int) from public, anon, authenticated;
grant execute on function public.rl_hit(text, int, int) to service_role;
grant execute on function public.ingest_lead(jsonb) to service_role;
grant execute on function public.claim_deliveries(int) to service_role;
grant execute on function public.create_lead_deliveries(uuid) to service_role;
grant execute on function public.bump_usage(uuid) to service_role;
grant execute on function public.release_locked_leads(uuid) to service_role;
grant execute on function public.run_cleanup(int, int) to service_role;

revoke all on function public.create_workspace(text, text) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;
