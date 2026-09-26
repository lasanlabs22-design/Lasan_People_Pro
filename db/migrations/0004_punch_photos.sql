-- Selfie punches. An admin turns them on per person (users.photo_punch); while on, every check-in
-- and check-out must carry a live camera photo. Photos live in their own table so roll-calls and
-- monthly logs, which read attendance rows in bulk, don't drag the images along.

alter table users add column photo_punch boolean not null default false;

-- photo_punch is the admin's call, so add it to the columns a person may not change on themselves.
create or replace function app.guard_user_update() returns trigger
  language plpgsql
  as $$
begin
  if current_user <> 'lasan_pro_app' or app.is_admin() then
    return new;
  end if;
  if (new.tenant_id, new.role, new.status, new.employee_code, new.email, new.name, new.gender,
      new.designation, new.department, new.date_of_joining, new.revoked_at, new.photo_punch)
     is distinct from (old.tenant_id, old.role, old.status, old.employee_code, old.email, old.name, old.gender,
                       old.designation, old.department, old.date_of_joining, old.revoked_at, old.photo_punch) then
    raise exception 'Only an admin can change these details' using errcode = '42501';
  end if;
  return new;
end $$;

create table attendance_photos (
  attendance_id uuid not null references attendance (id) on delete cascade,
  kind varchar(3) not null,
  tenant_id uuid not null default app.current_tenant_id(),
  user_id uuid not null,
  -- Small client-resized JPEG data URL, like profiles.avatar.
  photo text not null,
  created_at timestamptz not null default now(),
  primary key (attendance_id, kind),
  constraint attendance_photos_kind_ck check (kind in ('in', 'out')),
  foreign key (tenant_id, user_id) references users (tenant_id, id) on delete cascade
);
create index attendance_photos_tenant_idx on attendance_photos (tenant_id, user_id);

alter table attendance_photos enable row level security;
alter table attendance_photos force row level security;

-- Admins see the workspace's photos; an employee sees and adds only their own, and can't swap or
-- delete one after the fact.
create policy attendance_photos_read on attendance_photos for select
  using (tenant_id = app.current_tenant_id() and (app.is_admin() or user_id = app.current_user_id()));
create policy attendance_photos_insert on attendance_photos for insert
  with check (tenant_id = app.current_tenant_id() and user_id = app.current_user_id());
create policy attendance_photos_admin_delete on attendance_photos for delete
  using (tenant_id = app.current_tenant_id() and app.is_admin());

grant select, insert, delete on attendance_photos to lasan_pro_app;
