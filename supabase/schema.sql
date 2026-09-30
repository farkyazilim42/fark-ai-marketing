-- Run once in your own Supabase project's SQL Editor.
-- Disable public signup in Auth settings; invite the three team users manually.
create table if not exists public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
create policy "Owner reads workspace" on public.workspaces for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owner inserts workspace" on public.workspaces for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owner updates workspace" on public.workspaces for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.workspaces to authenticated;
revoke all on public.workspaces from anon;

-- Atomic per-user quota: no service-role key is needed by the application.
create table if not exists public.report_usage (
  user_id uuid references auth.users(id) on delete cascade,
  period timestamptz not null,
  used integer not null default 0,
  primary key (user_id, period)
);
alter table public.report_usage enable row level security;
revoke all on public.report_usage from anon, authenticated;
create or replace function public.claim_report_quota() returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); bucket timestamptz := date_trunc('hour', now()); count_used integer;
begin
  if uid is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  insert into public.report_usage(user_id, period, used) values(uid, bucket, 0) on conflict do nothing;
  select used into count_used from public.report_usage where user_id = uid and period = bucket;
  if count_used >= 5 then return false; end if;
  update public.report_usage set used = used + 1 where user_id = uid and period = bucket;
  return true;
end;
$$;
revoke all on function public.claim_report_quota() from public, anon;
grant execute on function public.claim_report_quota() to authenticated;
