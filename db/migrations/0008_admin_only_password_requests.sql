-- Only admins use "forgot password" to ask a fellow admin; staff ask an admin directly, who sets a
-- temporary password from the team page. Requests from anyone else are quietly ignored, like any
-- other non-matching request, so the form still reveals nothing about accounts.
create or replace function app.platform_request_password_reset(p_email text, p_admin_email text)
  returns void
  language plpgsql security definer
  set search_path = pg_catalog, pg_temp
  as $$
declare
  v_requester uuid;
  v_admin uuid;
begin
  select id into v_requester from app.platform_admins where lower(email) = lower(p_email) and is_active and role = 'admin';
  select id into v_admin from app.platform_admins where lower(email) = lower(p_admin_email) and is_active and role = 'admin';
  if v_requester is null or v_admin is null or v_requester = v_admin then
    return;
  end if;
  insert into app.platform_password_requests (requester_id, asked_admin_id) values (v_requester, v_admin)
  on conflict (requester_id) where resolved_at is null do update set asked_admin_id = excluded.asked_admin_id, created_at = now();
end $$;
