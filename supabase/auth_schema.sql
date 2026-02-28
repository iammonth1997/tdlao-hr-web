-- Auth tables for Cloudflare Worker login (emp_id + PIN + device binding)
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.login_users (
  emp_id text primary key references public.employees(emp_id) on delete cascade,
  pin_hash text not null,
  device_id_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.login_sessions (
  id uuid primary key default gen_random_uuid(),
  emp_id text not null references public.login_users(emp_id) on delete cascade,
  device_id_hash text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_login_sessions_emp_id on public.login_sessions(emp_id);
create index if not exists idx_login_sessions_expires_at on public.login_sessions(expires_at);

alter table public.login_users enable row level security;
alter table public.login_sessions enable row level security;

-- Block direct reads/writes from anon/authenticated clients.
drop policy if exists "deny_all_login_users" on public.login_users;
create policy "deny_all_login_users" on public.login_users
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "deny_all_login_sessions" on public.login_sessions;
create policy "deny_all_login_sessions" on public.login_sessions
  for all
  to anon, authenticated
  using (false)
  with check (false);
