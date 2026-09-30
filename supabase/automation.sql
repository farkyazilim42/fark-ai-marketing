-- Apply after schema.sql; safe to re-run. No existing workspace data is changed.
create table if not exists public.automation_runs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  period date not null,
  status text not null check (status in ('running', 'sending_slack', 'completed', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique(user_id, period)
);
create table if not exists public.scheduled_reports (
  id uuid primary key references public.automation_runs(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  period date not null,
  text text not null,
  metrics jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.automation_runs enable row level security;
alter table public.scheduled_reports enable row level security;
drop policy if exists "Owner reads runs" on public.automation_runs;
create policy "Owner reads runs" on public.automation_runs for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Owner reads scheduled reports" on public.scheduled_reports;
create policy "Owner reads scheduled reports" on public.scheduled_reports for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.automation_runs, public.scheduled_reports from anon, authenticated;
grant select on public.automation_runs, public.scheduled_reports to authenticated;
grant all on public.automation_runs, public.scheduled_reports to service_role;

create table if not exists public.notification_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id text not null,
  status text not null check (status in ('sending', 'sent', 'unknown')),
  created_at timestamptz not null default now(),
  primary key(user_id, report_id)
);
alter table public.notification_deliveries enable row level security;
drop policy if exists "Owner reads deliveries" on public.notification_deliveries;
drop policy if exists "Owner inserts deliveries" on public.notification_deliveries;
drop policy if exists "Owner updates deliveries" on public.notification_deliveries;
create policy "Owner reads deliveries" on public.notification_deliveries for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owner inserts deliveries" on public.notification_deliveries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owner updates deliveries" on public.notification_deliveries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.notification_deliveries from anon, authenticated;
grant select, insert, update on public.notification_deliveries to authenticated;

create table if not exists public.notification_usage (
  user_id uuid references auth.users(id) on delete cascade,
  period timestamptz not null,
  used integer not null default 0,
  primary key(user_id, period)
);
alter table public.notification_usage enable row level security;
revoke all on public.notification_usage from anon, authenticated;
create or replace function public.claim_notification_quota() returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); bucket timestamptz := date_trunc('hour', now()); count_used integer;
begin
  if uid is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 1));
  insert into public.notification_usage(user_id, period, used) values(uid, bucket, 0) on conflict do nothing;
  select used into count_used from public.notification_usage where user_id = uid and period = bucket;
  if count_used >= 10 then return false; end if;
  update public.notification_usage set used = used + 1 where user_id = uid and period = bucket;
  return true;
end;
$$;
revoke all on function public.claim_notification_quota() from public, anon;
grant execute on function public.claim_notification_quota() to authenticated;

grant all on public.notification_deliveries to service_role;
