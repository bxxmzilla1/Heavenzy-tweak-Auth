-- Heavenzy Auth: device-lock + live presence
-- Run this once in the Supabase SQL editor (Dashboard -> SQL -> New query -> Run).
--
-- One row per account (user_id is the primary key). The tweak upserts this row on login and on each
-- heartbeat; the admin PWA reads every row with the service-role key (bypassing RLS) to draw the map.

create table if not exists public.presence (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text,
  device_id   text not null,
  device_name text,
  app_bundle  text,
  latitude    double precision,
  longitude   double precision,
  accuracy    double precision,
  city        text,
  country     text,
  ip          text,
  source      text,                                   -- 'gps' | 'ip'
  claimed_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

-- Keep claimed_at pinned to the moment a NEW device took over (device_id changed), while last_seen
-- advances on every heartbeat.
create or replace function public.presence_touch()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.device_id is distinct from old.device_id then
    new.claimed_at := now();
  end if;
  new.last_seen := now();
  return new;
end;
$$;

drop trigger if exists presence_touch on public.presence;
create trigger presence_touch
  before insert or update on public.presence
  for each row execute function public.presence_touch();

-- Row level security: a signed-in user can only see / write THEIR OWN presence row. The admin PWA
-- uses the service-role key, which bypasses RLS entirely, so it still sees all rows.
alter table public.presence enable row level security;

drop policy if exists presence_own_select on public.presence;
create policy presence_own_select on public.presence
  for select using (auth.uid() = user_id);

drop policy if exists presence_own_insert on public.presence;
create policy presence_own_insert on public.presence
  for insert with check (auth.uid() = user_id);

drop policy if exists presence_own_update on public.presence;
create policy presence_own_update on public.presence
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Helpful index for the admin "online in the last N minutes" query.
create index if not exists presence_last_seen_idx on public.presence (last_seen desc);
