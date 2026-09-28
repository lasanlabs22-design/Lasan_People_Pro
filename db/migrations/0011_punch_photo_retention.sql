-- Check-in photos are kept for a limited time (PUNCH_PHOTO_RETENTION_DAYS, one week by default),
-- then deleted from photo storage and from here. The clean-up runs inside the app as lasan_pro_app,
-- outside any workspace, so it reaches the rows through these two narrow definer functions rather
-- than an owner connection.

-- A batch of expired photos. `photo` is only returned when it points at external storage (so the
-- caller can delete the file first); photos kept inline come back as null.
create function app.expired_punch_photos(p_days integer, p_limit integer)
  returns table (attendance_id uuid, kind varchar, photo text)
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select p.attendance_id, p.kind, case when p.photo like 'cld:%' then p.photo end
      from public.attendance_photos p
     where p.created_at < now() - make_interval(days => greatest(p_days, 1))
     order by p.created_at
     limit least(greatest(p_limit, 1), 1000)
  $$;

-- Removes one photo's row once its file is gone.
create function app.forget_punch_photo(p_attendance_id uuid, p_kind varchar)
  returns void
  language sql security definer
  set search_path = public, pg_temp
  as $$ delete from public.attendance_photos where attendance_id = p_attendance_id and kind = p_kind $$;

create index attendance_photos_created_idx on attendance_photos (created_at);

revoke all on function app.expired_punch_photos(integer, integer), app.forget_punch_photo(uuid, varchar) from public;
grant execute on function app.expired_punch_photos(integer, integer), app.forget_punch_photo(uuid, varchar) to lasan_pro_app;
