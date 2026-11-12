-- Heavenzy Cloud Accounts: named device-identity snapshots for the Instagram container feature.
-- Run this once in the Supabase SQL editor (Dashboard -> SQL -> New query -> Run).
--
-- Each row is one saved "container": a named snapshot of the device identity an Instagram account was
-- created under (keychain + app preferences + spoof settings), stored as JSON. NO cookies and NO
-- login session are stored (those expire); only the fingerprint that makes a re-login read as the
-- same device. The tweak writes/reads these rows with the signed-in user's token; row level security
-- keeps each Heavenzy account to its own snapshots.

create table if not exists public.account_configs (
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  payload     jsonb not null,
  app_bundle  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, name)
);

-- Keep updated_at fresh on every upsert.
create or replace function public.account_configs_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists account_configs_touch on public.account_configs;
create trigger account_configs_touch
  before update on public.account_configs
  for each row execute function public.account_configs_touch();

-- Row level security: a signed-in user can only see / write / delete THEIR OWN snapshots.
alter table public.account_configs enable row level security;

drop policy if exists account_configs_own_select on public.account_configs;
create policy account_configs_own_select on public.account_configs
  for select using (auth.uid() = user_id);

drop policy if exists account_configs_own_insert on public.account_configs;
create policy account_configs_own_insert on public.account_configs
  for insert with check (auth.uid() = user_id);

drop policy if exists account_configs_own_update on public.account_configs;
create policy account_configs_own_update on public.account_configs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists account_configs_own_delete on public.account_configs;
create policy account_configs_own_delete on public.account_configs
  for delete using (auth.uid() = user_id);

create index if not exists account_configs_user_idx on public.account_configs (user_id, updated_at desc);
