-- Heavenzy signup gate: lets the admin dashboard pause new sign-ups.
-- Run this once in the Supabase SQL editor (Dashboard -> SQL -> New query -> Run), then enable the hook:
--   Dashboard -> Authentication -> Hooks -> "Before User Created" -> Postgres -> public.hook_before_user_created
--
-- With the hook enabled, a blocked sign-up gets a 403 whose message the tweak / launcher / installer show
-- as-is. The trigger on auth.users is a backstop in case the hook isn't enabled (GoTrue then reports a
-- generic "Database error saving new user").

-- Single-row settings table. RLS on with no policies: only the service role (admin dashboard) can read
-- or write it; the functions below are security definer so they can read it on behalf of GoTrue.
create table if not exists public.admin_settings (
  id              boolean primary key default true check (id),
  signups_enabled boolean not null default true,
  updated_at      timestamptz not null default now()
);
insert into public.admin_settings (id) values (true) on conflict (id) do nothing;
alter table public.admin_settings enable row level security;

create or replace function public.signups_enabled()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select signups_enabled from public.admin_settings where id), true);
$$;

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if public.signups_enabled() then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Sign-ups are paused right now. Please wait for the admin to open them, then try again.'
  ));
end;
$$;

grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated, anon, public;

create or replace function public.enforce_signup_gate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.signups_enabled() then
    raise exception 'Sign-ups are paused. Please wait for the admin to open them.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_signup_gate on auth.users;
create trigger enforce_signup_gate
  before insert on auth.users
  for each row execute function public.enforce_signup_gate();
