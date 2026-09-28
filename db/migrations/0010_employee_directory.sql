-- Employee directory: everyone in a workspace can see who else works there.
--
-- Employees may read their colleagues' user rows already (users_read), but profiles, which hold the
-- photo alongside private details like date of birth and emergency contacts, stay owner-or-admin.
-- Rather than widen that policy, these two definer functions hand out only directory fields, for
-- active people in the caller's own workspace (app.current_tenant_id()); with no workspace in the
-- context they return nothing.

create function app.directory()
  returns table (id uuid, employee_code varchar, name varchar, email varchar, role role, designation varchar,
                 department varchar, has_photo boolean)
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select u.id, u.employee_code, u.name, u.email, u.role, u.designation, u.department, p.avatar is not null
      from public.users u
      left join public.profiles p on p.user_id = u.id and p.tenant_id = u.tenant_id
     where u.tenant_id = app.current_tenant_id() and u.status = 'active'
     order by lower(u.name)
  $$;

-- One person's photo, loaded lazily by the directory page (photos are too large to list in bulk).
create function app.directory_photo(p_id uuid)
  returns text
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select p.avatar
      from public.users u
      join public.profiles p on p.user_id = u.id and p.tenant_id = u.tenant_id
     where u.id = p_id and u.tenant_id = app.current_tenant_id() and u.status = 'active'
  $$;

revoke all on function app.directory(), app.directory_photo(uuid) from public;
grant execute on function app.directory(), app.directory_photo(uuid) to lasan_pro_app;
