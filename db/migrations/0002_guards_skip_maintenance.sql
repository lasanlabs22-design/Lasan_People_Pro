-- The column guards exist to stop the app role (lasan_pro_app) acting as an employee from editing
-- what only an admin may. They also fired inside foreign-key cascades, which Postgres runs as the
-- table owner with no app.* settings: deleting a workspace or a person who had reviewed leave set
-- reviewer_id to null, the guard saw a non-admin rewriting a reviewed request, and the whole delete
-- failed (or not, depending on cascade order). Only police the app role.

create or replace function app.guard_user_update() returns trigger
  language plpgsql
  as $$
begin
  if current_user <> 'lasan_pro_app' or app.is_admin() then
    return new;
  end if;
  if (new.tenant_id, new.role, new.status, new.employee_code, new.email, new.name, new.gender,
      new.designation, new.department, new.date_of_joining, new.revoked_at)
     is distinct from (old.tenant_id, old.role, old.status, old.employee_code, old.email, old.name, old.gender,
                       old.designation, old.department, old.date_of_joining, old.revoked_at) then
    raise exception 'Only an admin can change these details' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function app.guard_leave_request() returns trigger
  language plpgsql
  as $$
begin
  if current_user <> 'lasan_pro_app' or app.is_admin() then
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
