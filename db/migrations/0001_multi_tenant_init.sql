-- Lasan People Pro: multi-tenant schema with Postgres row-level security.
--
-- Isolation model
--   * Every business table carries tenant_id. It defaults to app.current_tenant_id(), so the
--     application never has to (and can't forget to) pass it.
--   * The app connects as lasan_pro_app: not the owner, no BYPASSRLS. Each request runs in a
--     transaction that sets app.tenant_id / app.user_id / app.role with set_config(..., true).
--     Outside that context every policy evaluates against NULL and matches nothing.
--   * Child rows reference parents by (tenant_id, id), so even a guessed UUID from another
--     tenant can't be linked to: the foreign key itself fails.
--   * Inside a tenant, employees only see their own personal rows; catalog tables are
--     read-only to them. Admin status comes from the database row, never from the token.

create schema if not exists app;

/* ------------------------------ Context helpers ------------------------------ */

create or replace function app.current_tenant_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.tenant_id', true), '')::uuid $$;

create or replace function app.current_user_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

create or replace function app.is_admin() returns boolean
  language sql stable
  as $$ select coalesce(current_setting('app.role', true) = 'admin', false) $$;

/* ---------------------------------- Types ---------------------------------- */

create type tenant_status as enum ('active', 'suspended');
create type role as enum ('admin', 'employee');
create type gender as enum ('male', 'female', 'other');
create type user_status as enum ('active', 'revoked');
create type leave_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type leave_gender as enum ('any', 'male', 'female');
create type half_day as enum ('none', 'first_half', 'second_half');
create type attendance_source as enum ('geo', 'manual', 'remote');

/* --------------------------------- Tenants --------------------------------- */

create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug varchar(40) not null,
  name varchar(120) not null,
  status tenant_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_slug_ck check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$')
);
create unique index tenants_slug_uq on tenants (lower(slug));

-- Sign-in happens before any tenant context exists, so resolving a workspace name goes through
-- this narrow definer function instead of opening the tenants table to everyone.
create or replace function app.tenant_by_slug(p_slug text)
  returns table (id uuid, slug varchar, name varchar, status tenant_status)
  language sql stable security definer
  set search_path = public, pg_temp
  as $$ select t.id, t.slug, t.name, t.status from public.tenants t where lower(t.slug) = lower(p_slug) $$;

/* ---------------------------------- People ---------------------------------- */

create table users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.current_tenant_id() references tenants (id) on delete cascade,
  employee_code varchar(32) not null,
  email varchar(255) not null,
  password_hash text not null,
  role role not null default 'employee',
  name varchar(120) not null,
  gender gender not null,
  designation varchar(120),
  department varchar(120),
  date_of_joining date,
  status user_status not null default 'active',
  must_change_password boolean not null default true,
  -- Bumped on revoke / password change / reset to invalidate every issued token.
  token_version integer not null default 0,
  last_login_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_tenant_id_uq unique (tenant_id, id)
);
-- IDs and emails are unique per workspace: two companies can both have an "LS001".
create unique index users_employee_code_uq on users (tenant_id, lower(employee_code));
create unique index users_email_uq on users (tenant_id, lower(email));

create table profiles (
  user_id uuid primary key,
  tenant_id uuid not null default app.current_tenant_id(),
  avatar text,
  phone varchar(32),
  date_of_birth date,
  blood_group varchar(4),
  address text,
  emergency_contact_name varchar(120),
  emergency_contact_relation varchar(60),
  emergency_contact_phone varchar(32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, user_id) references users (tenant_id, id) on delete cascade
);

/* ---------------------------------- Leave ---------------------------------- */

create table leave_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.current_tenant_id() references tenants (id) on delete cascade,
  code varchar(24) not null,
  name varchar(60) not null,
  description text,
  annual_quota numeric(5, 1) not null,
  eligible_gender leave_gender not null default 'any',
  counts_calendar_days boolean not null default false,
  allow_half_day boolean not null default true,
  color varchar(16) not null default '#6366f1',
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_types_tenant_id_uq unique (tenant_id, id)
);
create unique index leave_types_code_uq on leave_types (tenant_id, code);

create table leave_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.current_tenant_id(),
  user_id uuid not null,
  leave_type_id uuid not null,
  year smallint not null,
  days numeric(5, 1) not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, user_id) references users (tenant_id, id) on delete cascade,
  foreign key (tenant_id, leave_type_id) references leave_types (tenant_id, id) on delete cascade
);
create unique index leave_alloc_uq on leave_allocations (user_id, leave_type_id, year);

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.current_tenant_id(),
  user_id uuid not null,
  leave_type_id uuid not null,
  start_date date not null,
  end_date date not null,
  half_day half_day not null default 'none',
  days numeric(5, 1) not null,
  reason text not null,
  status leave_status not null default 'pending',
  reviewer_id uuid,
  review_comment text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_req_range_ck check (end_date >= start_date),
  foreign key (tenant_id, user_id) references users (tenant_id, id) on delete cascade,
  foreign key (tenant_id, leave_type_id) references leave_types (tenant_id, id),
  foreign key (tenant_id, reviewer_id) references users (tenant_id, id) on delete set null (reviewer_id)
);
create index leave_req_user_idx on leave_requests (user_id, start_date);
create index leave_req_status_idx on leave_requests (tenant_id, status);

create table holidays (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.current_tenant_id() references tenants (id) on delete cascade,
  date date not null,
  name varchar(120) not null,
  is_optional boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, created_by) references users (tenant_id, id) on delete set null (created_by)
);
create unique index holidays_date_uq on holidays (tenant_id, date);

/* ------------------------------ Ratings & places ------------------------------ */

create table ratings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.current_tenant_id(),
  user_id uuid not null,
  rated_by uuid,
  score smallint not null,
  period varchar(16) not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ratings_score_ck check (score between 1 and 5),
  foreign key (tenant_id, user_id) references users (tenant_id, id) on delete cascade,
  foreign key (tenant_id, rated_by) references users (tenant_id, id) on delete set null (rated_by)
);
create index ratings_user_idx on ratings (user_id, created_at);

create table office_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.current_tenant_id() references tenants (id) on delete cascade,
  name varchar(120) not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  radius_meters integer not null default 150,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_locations_tenant_id_uq unique (tenant_id, id)
);

/* -------------------------------- Attendance -------------------------------- */

create table attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.current_tenant_id(),
  user_id uuid not null,
  date date not null,
  source attendance_source not null default 'geo',
  check_in_at timestamptz not null,
  check_in_lat double precision,
  check_in_lng double precision,
  check_in_accuracy double precision,
  check_in_office_id uuid,
  check_in_distance double precision,
  check_out_at timestamptz,
  check_out_lat double precision,
  check_out_lng double precision,
  check_out_accuracy double precision,
  check_out_office_id uuid,
  check_out_distance double precision,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, user_id) references users (tenant_id, id) on delete cascade,
  foreign key (tenant_id, check_in_office_id) references office_locations (tenant_id, id) on delete set null (check_in_office_id),
  foreign key (tenant_id, check_out_office_id) references office_locations (tenant_id, id) on delete set null (check_out_office_id)
);
create unique index attendance_user_date_uq on attendance (user_id, date);
create index attendance_date_idx on attendance (tenant_id, date);

/* ---------------------------- Settings & auditing ---------------------------- */

create table settings (
  tenant_id uuid not null default app.current_tenant_id() references tenants (id) on delete cascade,
  key varchar(64) not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.current_tenant_id() references tenants (id) on delete cascade,
  actor_id uuid,
  action varchar(64) not null,
  entity varchar(64) not null,
  entity_id uuid,
  meta jsonb,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, actor_id) references users (tenant_id, id) on delete set null (actor_id)
);
create index audit_entity_idx on audit_logs (tenant_id, entity, entity_id);

/* ------------------------------ Row-level security ------------------------------ */

do $$
declare t text;
begin
  foreach t in array array['tenants', 'users', 'profiles', 'leave_types', 'leave_allocations', 'leave_requests',
                           'holidays', 'ratings', 'office_locations', 'attendance', 'settings', 'audit_logs']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- Tenants: a session sees and edits only its own workspace. Creating one is allowed only for the
-- id already placed in the context (the sign-up flow picks the id first).
create policy tenant_read on tenants for select using (id = app.current_tenant_id());
create policy tenant_create on tenants for insert with check (id = app.current_tenant_id());
create policy tenant_admin_update on tenants for update
  using (id = app.current_tenant_id() and app.is_admin())
  with check (id = app.current_tenant_id());

-- Users: everyone in the workspace can see names (reviewers, rosters). Admins manage people;
-- a person may only touch their own row, and a trigger below limits which columns.
create policy users_read on users for select using (tenant_id = app.current_tenant_id());
create policy users_admin_write on users for all
  using (tenant_id = app.current_tenant_id() and app.is_admin())
  with check (tenant_id = app.current_tenant_id() and app.is_admin());
create policy users_self_update on users for update
  using (tenant_id = app.current_tenant_id() and id = app.current_user_id())
  with check (tenant_id = app.current_tenant_id() and id = app.current_user_id());

-- Company catalog: readable by everyone in the workspace, writable by admins only.
do $$
declare t text;
begin
  foreach t in array array['leave_types', 'holidays', 'office_locations', 'settings']
  loop
    execute format('create policy %I on %I for select using (tenant_id = app.current_tenant_id())', t || '_read', t);
    execute format('create policy %I on %I for all using (tenant_id = app.current_tenant_id() and app.is_admin()) '
                   'with check (tenant_id = app.current_tenant_id() and app.is_admin())', t || '_admin_write', t);
  end loop;
end $$;

-- Personal records: admins see the whole workspace, employees only their own rows.
do $$
declare t text;
begin
  foreach t in array array['profiles', 'attendance', 'leave_requests']
  loop
    execute format('create policy %I on %I for all '
                   'using (tenant_id = app.current_tenant_id() and (app.is_admin() or user_id = app.current_user_id())) '
                   'with check (tenant_id = app.current_tenant_id() and (app.is_admin() or user_id = app.current_user_id()))',
                   t || '_owner_or_admin', t);
  end loop;
  -- Quotas and ratings are set by admins; the employee may read their own.
  foreach t in array array['leave_allocations', 'ratings']
  loop
    execute format('create policy %I on %I for select '
                   'using (tenant_id = app.current_tenant_id() and (app.is_admin() or user_id = app.current_user_id()))',
                   t || '_read', t);
    execute format('create policy %I on %I for all using (tenant_id = app.current_tenant_id() and app.is_admin()) '
                   'with check (tenant_id = app.current_tenant_id() and app.is_admin())', t || '_admin_write', t);
  end loop;
end $$;

-- Audit log: append-only. Anyone may record their own actions; only admins read it back.
create policy audit_insert on audit_logs for insert
  with check (tenant_id = app.current_tenant_id() and (app.is_admin() or actor_id = app.current_user_id()));
create policy audit_admin_read on audit_logs for select
  using (tenant_id = app.current_tenant_id() and app.is_admin());

/* ------------------------------ Guard triggers ------------------------------ */
-- RLS decides which rows; these decide which columns a non-admin may change on those rows.

create or replace function app.guard_user_update() returns trigger
  language plpgsql
  as $$
begin
  if not app.is_admin() and (new.tenant_id, new.role, new.status, new.employee_code, new.email, new.name, new.gender,
                             new.designation, new.department, new.date_of_joining, new.revoked_at)
     is distinct from (old.tenant_id, old.role, old.status, old.employee_code, old.email, old.name, old.gender,
                       old.designation, old.department, old.date_of_joining, old.revoked_at) then
    raise exception 'Only an admin can change these details' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger users_guard before update on users for each row execute function app.guard_user_update();

create or replace function app.guard_leave_request() returns trigger
  language plpgsql
  as $$
begin
  if app.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending' or new.reviewer_id is not null or new.reviewed_at is not null then
      raise exception 'Leave requests start as pending' using errcode = '42501';
    end if;
  elsif (new.tenant_id, new.user_id, new.leave_type_id, new.start_date, new.end_date, new.half_day, new.days,
         new.reviewer_id, new.review_comment, new.reviewed_at)
        is distinct from (old.tenant_id, old.user_id, old.leave_type_id, old.start_date, old.end_date, old.half_day, old.days,
                          old.reviewer_id, old.review_comment, old.reviewed_at)
        or (new.status is distinct from old.status and new.status <> 'cancelled') then
    raise exception 'You can only cancel your own request' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger leave_requests_guard before insert or update on leave_requests
  for each row execute function app.guard_leave_request();

/* ---------------------------------- Grants ---------------------------------- */

revoke all on schema app from public;
revoke all on all functions in schema app from public;
grant usage on schema public, app to lasan_pro_app;
grant execute on all functions in schema app to lasan_pro_app;
grant select, insert, update, delete on all tables in schema public to lasan_pro_app;
-- Tenants are never deleted by the app, and the audit trail can't be rewritten.
revoke delete on tenants from lasan_pro_app;
revoke update, delete on audit_logs from lasan_pro_app;
