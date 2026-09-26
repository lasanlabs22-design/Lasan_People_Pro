-- Platform admins manage their own team from the console: change their password, add colleagues
-- with a temporary password (replaced on first sign-in), reset a colleague's password, and
-- deactivate or reactivate accounts. The table stays private; everything goes through definer
-- functions, as in 0005.

alter table app.platform_admins
  add column must_change_password boolean not null default false,
  add column created_by uuid references app.platform_admins (id) on delete set null;

-- Return types change, so these are dropped and recreated rather than replaced.
drop function app.platform_admin_by_email(text);
drop function app.platform_admin_by_id(uuid);

create function app.platform_admin_by_email(p_email text)
  returns table (id uuid, email varchar, name varchar, password_hash text, token_version integer, is_active boolean,
                 must_change_password boolean)
  language sql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$
    select a.id, a.email, a.name, a.password_hash, a.token_version, a.is_active, a.must_change_password
      from app.platform_admins a where lower(a.email) = lower(p_email)
  $$;

create function app.platform_admin_by_id(p_id uuid)
  returns table (id uuid, email varchar, name varchar, password_hash text, token_version integer, is_active boolean,
                 must_change_password boolean, last_login_at timestamptz)
  language sql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$
    select a.id, a.email, a.name, a.password_hash, a.token_version, a.is_active, a.must_change_password, a.last_login_at
      from app.platform_admins a where a.id = p_id
  $$;

create function app.platform_admins()
  returns table (id uuid, email varchar, name varchar, is_active boolean, must_change_password boolean,
                 last_login_at timestamptz, created_at timestamptz, created_by_name varchar)
  language sql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$
    select a.id, a.email, a.name, a.is_active, a.must_change_password, a.last_login_at, a.created_at, c.name
      from app.platform_admins a
      left join app.platform_admins c on c.id = a.created_by
     order by a.created_at
  $$;

-- A colleague added from the console starts with a password they must replace.
create function app.platform_admin_create(p_email text, p_name text, p_password_hash text, p_created_by uuid)
  returns uuid
  language sql security definer
  set search_path = pg_catalog, pg_temp
  as $$
    insert into app.platform_admins (email, name, password_hash, must_change_password, created_by)
    values (lower(p_email), p_name, p_password_hash, true, p_created_by)
    returning id
  $$;

-- New password (own change, or a reset by a colleague when p_must_change). Signs out everywhere.
create function app.platform_admin_set_password(p_id uuid, p_password_hash text, p_must_change boolean)
  returns integer
  language sql security definer
  set search_path = pg_catalog, pg_temp
  as $$
    update app.platform_admins
       set password_hash = p_password_hash, must_change_password = p_must_change, token_version = token_version + 1
     where id = p_id
    returning token_version
  $$;

create function app.platform_admin_set_active(p_id uuid, p_active boolean)
  returns boolean
  language sql security definer
  set search_path = pg_catalog, pg_temp
  as $$
    with changed as (
      update app.platform_admins set is_active = p_active, token_version = token_version + 1 where id = p_id returning 1
    )
    select exists (select 1 from changed)
  $$;

revoke all on function app.platform_admin_by_email(text), app.platform_admin_by_id(uuid), app.platform_admins(),
  app.platform_admin_create(text, text, text, uuid), app.platform_admin_set_password(uuid, text, boolean),
  app.platform_admin_set_active(uuid, boolean) from public;
grant execute on function app.platform_admin_by_email(text), app.platform_admin_by_id(uuid), app.platform_admins(),
  app.platform_admin_create(text, text, text, uuid), app.platform_admin_set_password(uuid, text, boolean),
  app.platform_admin_set_active(uuid, boolean) to lasan_pro_app;
