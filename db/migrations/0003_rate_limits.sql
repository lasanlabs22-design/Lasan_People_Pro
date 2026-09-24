-- Sign-in and sign-up throttling, kept in Postgres instead of process memory so it survives
-- restarts and is shared by every app instance. Keys are opaque strings built by the app
-- (e.g. "login:ip:203.0.113.7"); nothing here is tenant data, so it lives outside RLS in the
-- private app schema and the app role reaches it only through these three functions.

create table app.rate_limits (
  key text primary key,
  count integer not null,
  reset_at timestamptz not null
);
revoke all on app.rate_limits from public;

-- Attempts used in the current window (0 once it has expired) and seconds until it resets.
create or replace function app.rate_limit_peek(p_key text)
  returns table (count integer, retry_after integer)
  language sql stable security definer
  set search_path = pg_catalog, pg_temp
  as $$
    select coalesce(max(r.count), 0),
           coalesce(max(ceil(extract(epoch from r.reset_at - now())))::integer, 0)
      from app.rate_limits r
     where r.key = p_key and r.reset_at > now()
  $$;

-- Records one attempt: starts a fresh window if there is none (or it expired), else counts up.
create or replace function app.rate_limit_hit(p_key text, p_window_seconds integer)
  returns void
  language plpgsql security definer
  set search_path = pg_catalog, pg_temp
  as $$
begin
  insert into app.rate_limits as r (key, count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count = case when r.reset_at <= now() then 1 else r.count + 1 end,
        reset_at = case when r.reset_at <= now() then excluded.reset_at else r.reset_at end;
  -- Housekeeping: occasionally drop long-expired windows.
  if random() < 0.01 then
    delete from app.rate_limits where reset_at < now() - interval '1 day';
  end if;
end $$;

create or replace function app.rate_limit_reset(p_key text)
  returns void
  language sql security definer
  set search_path = pg_catalog, pg_temp
  as $$ delete from app.rate_limits where key = p_key $$;

revoke all on function app.rate_limit_peek(text), app.rate_limit_hit(text, integer), app.rate_limit_reset(text) from public;
grant execute on function app.rate_limit_peek(text), app.rate_limit_hit(text, integer), app.rate_limit_reset(text) to lasan_pro_app;
