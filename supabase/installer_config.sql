-- Heavenzy Installer signing configuration (App Store Connect API key + signing certificate).
-- The Windows installer downloads this after the user signs in and keeps it in memory only, so the
-- credentials are never shipped inside the .exe. Only signed-in (non-banned) Heavenzy accounts can
-- read it; nobody can write it through the API (edit it from the SQL editor / service role only).

create table if not exists public.installer_config (
  id           int primary key default 1 check (id = 1),
  issuer_id    text not null,
  key_id       text not null,
  p8           text not null,          -- AuthKey_XXXX.p8 contents (PEM)
  p12_base64   text not null,          -- signing certificate (.p12), base64
  p12_password text not null default '',
  updated_at   timestamptz not null default now()
);

alter table public.installer_config enable row level security;

drop policy if exists installer_config_read on public.installer_config;
create policy installer_config_read on public.installer_config
  for select to authenticated using (true);

revoke insert, update, delete on public.installer_config from anon, authenticated;
