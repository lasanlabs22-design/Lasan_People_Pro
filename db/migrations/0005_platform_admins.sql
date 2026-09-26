-- Platform (super) admins: Lasan staff who create and manage customer workspaces. They belong to
-- no workspace, so like the rate limits they live in the private app schema, outside RLS, and the
-- app role reaches them only through the narrow functions below. Accounts are created from the
-- terminal with the owner connection (npm run platform:admin), never through the web app.

create table app.platform_admins (
  id uuid primary key default gen_random_uuid(),
  email varchar(255) not null,
  name varchar(120) not null,
  password_hash text not null,
  -- Bumped on password reset or deactivation to invalidate every issued token.
  token_version integer not null default 0,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index platform_admins_email_uq on app.platform_admins (lower(email));
revoke all on app.platform_admins from public;

create or replace function app.platform_admin_by_email(p_email text)
  returns table (id uuid, email varchar, name varchar, password_hash text, token_version integer, is_active boolean)
  language sql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$
    select a.id, a.email, a.name, a.password_hash, a.token_version, a.is_active
      from app.platform_admins a where lower(a.email) = lower(p_email)
  $$;

create or replace function app.platform_admin_by_id(p_id uuid)
  returns table (id uuid, email varchar, name varchar, token_version integer, is_active boolean, last_login_at timestamptz)
  language sql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$
    select a.id, a.email, a.name, a.token_version, a.is_active, a.last_login_at from app.platform_admins a where a.id = p_id
  $$;

create or replace function app.platform_admin_signed_in(p_id uuid)
  returns void
  language sql security definer
  set search_path = pg_catalog, pg_temp
  as $$ update app.platform_admins set last_login_at = now() where id = p_id $$;

-- Every workspace with a head count. Runs as the owner, so it sees across tenants; only the
-- platform console calls it.
create or replace function app.platform_workspaces()
  returns table (id uuid, slug varchar, name varchar, status tenant_status, created_at timestamptz,
                 people integer, admins integer, last_login_at timestamptz)
  language sql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$
    select t.id, t.slug, t.name, t.status, t.created_at,
           count(u.id) filter (where u.status = 'active')::integer,
           count(u.id) filter (where u.status = 'active' and u.role = 'admin')::integer,
           max(u.last_login_at)
      from public.tenants t
      left join public.users u on u.tenant_id = t.id
     group by t.id
     order by t.created_at desc
  $$;

create or replace function app.platform_set_workspace_status(p_id uuid, p_status tenant_status)
  returns boolean
  language sql security definer
  set search_path = pg_catalog, pg_temp
  as $$
    with changed as (update public.tenants set status = p_status, updated_at = now() where id = p_id returning 1)
    select exists (select 1 from changed)
  $$;

revoke all on function app.platform_admin_by_email(text), app.platform_admin_by_id(uuid),
  app.platform_admin_signed_in(uuid), app.platform_workspaces(),
  app.platform_set_workspace_status(uuid, tenant_status) from public;
grant execute on function app.platform_admin_by_email(text), app.platform_admin_by_id(uuid),
  app.platform_admin_signed_in(uuid), app.platform_workspaces(),
  app.platform_set_workspace_status(uuid, tenant_status) to lasan_pro_app;
