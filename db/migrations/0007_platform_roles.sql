-- Two roles in the platform console, mirroring a workspace's admin/employee split:
--   admin: manages the Lasan team (adds people, sets roles, deactivates, gives temporary passwords)
--   staff: works in the console; can't see or manage the team
-- Anyone who forgets their password asks a particular admin for a temporary one; the request waits
-- in that admin's console until they act on it.

create type app.platform_role as enum ('admin', 'staff');

alter table app.platform_admins add column role app.platform_role not null default 'staff';
-- Accounts that already exist were made from the terminal or by the people who run the console.
update app.platform_admins set role = 'admin';

create table app.platform_password_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references app.platform_admins (id) on delete cascade,
  asked_admin_id uuid not null references app.platform_admins (id) on delete cascade,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references app.platform_admins (id) on delete set null
);
-- One open request per person at a time.
create unique index platform_password_requests_open_uq on app.platform_password_requests (requester_id) where resolved_at is null;
revoke all on app.platform_password_requests from public;

-- Return types change, so these are dropped and recreated.
drop function app.platform_admin_by_email(text);
drop function app.platform_admin_by_id(uuid);
drop function app.platform_admins();
drop function app.platform_admin_create(text, text, text, uuid);

create function app.platform_admin_by_email(p_email text)
  returns table (id uuid, email varchar, name varchar, role app.platform_role, password_hash text, token_version integer,
                 is_active boolean, must_change_password boolean)
  language sql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$
    select a.id, a.email, a.name, a.role, a.password_hash, a.token_version, a.is_active, a.must_change_password
      from app.platform_admins a where lower(a.email) = lower(p_email)
  $$;

create function app.platform_admin_by_id(p_id uuid)
  returns table (id uuid, email varchar, name varchar, role app.platform_role, password_hash text, token_version integer,
                 is_active boolean, must_change_password boolean, last_login_at timestamptz)
  language sql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$
    select a.id, a.email, a.name, a.role, a.password_hash, a.token_version, a.is_active, a.must_change_password, a.last_login_at
      from app.platform_admins a where a.id = p_id
  $$;

create function app.platform_admins()
  returns table (id uuid, email varchar, name varchar, role app.platform_role, is_active boolean, must_change_password boolean,
                 last_login_at timestamptz, created_at timestamptz, created_by_name varchar)
  language sql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$
    select a.id, a.email, a.name, a.role, a.is_active, a.must_change_password, a.last_login_at, a.created_at, c.name
      from app.platform_admins a
      left join app.platform_admins c on c.id = a.created_by
     order by a.role, a.created_at
  $$;

create function app.platform_admin_create(p_email text, p_name text, p_role app.platform_role, p_password_hash text, p_created_by uuid)
  returns uuid
  language sql security definer
  set search_path = pg_catalog, pg_temp
  as $$
    insert into app.platform_admins (email, name, role, password_hash, must_change_password, created_by)
    values (lower(p_email), p_name, p_role, p_password_hash, true, p_created_by)
    returning id
  $$;

-- Refuses to leave the console without an active admin. Returns false if there's no such person.
create function app.platform_admin_set_role(p_id uuid, p_role app.platform_role)
  returns boolean
  language plpgsql security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  -- Serialise role and activation changes so two admins can't demote each other at once.
  lock table app.platform_admins in share row exclusive mode;
  if p_role = 'staff' and not exists (
    select 1 from app.platform_admins where role = 'admin' and is_active and id <> p_id
  ) then
    raise exception 'The console needs at least one active admin' using errcode = 'P0001';
  end if;
  update app.platform_admins set role = p_role, token_version = token_version + 1 where id = p_id;
  return found;
end $$;

create or replace function app.platform_admin_set_active(p_id uuid, p_active boolean)
  returns boolean
  language plpgsql security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  lock table app.platform_admins in share row exclusive mode;
  if not p_active and not exists (
    select 1 from app.platform_admins where role = 'admin' and is_active and id <> p_id
  ) and exists (select 1 from app.platform_admins where id = p_id and role = 'admin') then
    raise exception 'The console needs at least one active admin' using errcode = 'P0001';
  end if;
  update app.platform_admins set is_active = p_active, token_version = token_version + 1 where id = p_id;
  return found;
end $$;

-- A forgotten-password request, from the sign-in page (so no session). Quietly does nothing
-- unless both people exist, are active and the one asked is an admin, and never says which, so
-- the form can't be used to discover accounts.
create function app.platform_request_password_reset(p_email text, p_admin_email text)
  returns void
  language plpgsql security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_requester uuid;
  v_admin uuid;
begin
  select id into v_requester from app.platform_admins where lower(email) = lower(p_email) and is_active;
  select id into v_admin from app.platform_admins where lower(email) = lower(p_admin_email) and is_active and role = 'admin';
  if v_requester is null or v_admin is null or v_requester = v_admin then
    return;
  end if;
  insert into app.platform_password_requests (requester_id, asked_admin_id) values (v_requester, v_admin)
  on conflict (requester_id) where resolved_at is null do update set asked_admin_id = excluded.asked_admin_id, created_at = now();
end $$;

-- Open requests addressed to one admin.
create function app.platform_password_requests_for(p_admin_id uuid)
  returns table (id uuid, requester_id uuid, name varchar, email varchar, role app.platform_role, created_at timestamptz)
  language sql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$
    select r.id, a.id, a.name, a.email, a.role, r.created_at
      from app.platform_password_requests r
      join app.platform_admins a on a.id = r.requester_id
     where r.asked_admin_id = p_admin_id and r.resolved_at is null
     order by r.created_at
  $$;

-- Closes a person's open request, when an admin gives them a temporary password or dismisses it.
create function app.platform_password_request_close(p_requester_id uuid, p_by uuid)
  returns boolean
  language sql security definer
  set search_path = pg_catalog, pg_temp
  as $$
    with closed as (
      update app.platform_password_requests set resolved_at = now(), resolved_by = p_by
       where requester_id = p_requester_id and resolved_at is null
      returning 1
    )
    select exists (select 1 from closed)
  $$;

revoke all on function app.platform_admin_by_email(text), app.platform_admin_by_id(uuid), app.platform_admins(),
  app.platform_admin_create(text, text, app.platform_role, text, uuid), app.platform_admin_set_role(uuid, app.platform_role),
  app.platform_admin_set_active(uuid, boolean), app.platform_request_password_reset(text, text),
  app.platform_password_requests_for(uuid), app.platform_password_request_close(uuid, uuid) from public;
grant usage on type app.platform_role to lasan_pro_app;
grant execute on function app.platform_admin_by_email(text), app.platform_admin_by_id(uuid), app.platform_admins(),
  app.platform_admin_create(text, text, app.platform_role, text, uuid), app.platform_admin_set_role(uuid, app.platform_role),
  app.platform_admin_set_active(uuid, boolean), app.platform_request_password_reset(text, text),
  app.platform_password_requests_for(uuid), app.platform_password_request_close(uuid, uuid) to lasan_pro_app;
