-- Security hardening after the September 2026 review.
--
-- 1. A console audit trail. Platform staff act across every workspace, so what they do (sign-ins,
--    workspaces created or suspended, team changes, password resets) is recorded here. Like the
--    rest of the console it lives in the private app schema; the app role can only append a row
--    and read the latest ones through definer functions, never edit or delete history.
-- 2. A workspace can't change its own status or name through the app role, even though its admin
--    may rename the company: suspending and reactivating belong to the console alone.
-- 3. Deleting a workspace that has leave history failed: the cascade could reach leave_types
--    before leave_requests, and the plain foreign key between them refused. Checking it at commit
--    instead lets the cascade finish while still refusing to delete a leave type that's in use.

/* ------------------------------ Console audit trail ------------------------------ */

create table app.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Who acted. The email is kept as written so the trail survives the account being removed.
  actor_id uuid references app.platform_admins (id) on delete set null,
  actor_email varchar(255),
  action varchar(64) not null,
  target_type varchar(32),
  target_id uuid,
  target_label varchar(255),
  ip varchar(64),
  meta jsonb
);
create index platform_audit_logs_created_idx on app.platform_audit_logs (created_at desc);
revoke all on app.platform_audit_logs from public;

create function app.platform_audit_record(p_actor_id uuid, p_actor_email text, p_action text, p_target_type text,
                                          p_target_id uuid, p_target_label text, p_ip text, p_meta jsonb)
  returns void
  language sql security definer
  set search_path = pg_catalog, pg_temp
  as $$
    insert into app.platform_audit_logs (actor_id, actor_email, action, target_type, target_id, target_label, ip, meta)
    values (p_actor_id, lower(p_actor_email), p_action, p_target_type, p_target_id, left(p_target_label, 255), left(p_ip, 64), p_meta)
  $$;

create function app.platform_audit_list(p_limit integer)
  returns table (id uuid, created_at timestamptz, actor_email varchar, actor_name varchar, action varchar, target_type varchar,
                 target_id uuid, target_label varchar, ip varchar, meta jsonb)
  language sql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$
    select l.id, l.created_at, l.actor_email, a.name, l.action, l.target_type, l.target_id, l.target_label, l.ip, l.meta
      from app.platform_audit_logs l
      left join app.platform_admins a on a.id = l.actor_id
     order by l.created_at desc
     limit least(greatest(p_limit, 1), 500)
  $$;

revoke all on function app.platform_audit_record(uuid, text, text, text, uuid, text, text, jsonb),
  app.platform_audit_list(integer) from public;
grant execute on function app.platform_audit_record(uuid, text, text, text, uuid, text, text, jsonb),
  app.platform_audit_list(integer) to lasan_pro_app;

/* ------------------------- Workspace status is the console's ------------------------- */

create function app.guard_tenant_update() returns trigger
  language plpgsql
  as $$
begin
  if current_user = 'lasan_pro_app' and (new.id, new.slug, new.status) is distinct from (old.id, old.slug, old.status) then
    raise exception 'Only Lasan can change a workspace''s status or name' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger tenants_guard before update on tenants for each row execute function app.guard_tenant_update();

/* ------------------------ Deleting a workspace with leave history ------------------------ */

alter table leave_requests
  drop constraint leave_requests_tenant_id_leave_type_id_fkey,
  add constraint leave_requests_tenant_id_leave_type_id_fkey
    foreign key (tenant_id, leave_type_id) references leave_types (tenant_id, id) deferrable initially deferred;
