-- Additive, idempotent installation. Service-role writes; owners can only read.
-- No credentials are stored here. Run after the application's Supabase auth setup.
create table if not exists public.ads_plans (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  customer_id text not null check (customer_id ~ '^[0-9]{10}$'),
  plan jsonb not null,
  plan_hash text not null check (plan_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'draft' check (status in ('draft','validated','creating','paused','activating','active','pausing','unknown','failed','removed')),
  operation_id uuid not null unique,
  resources jsonb,
  validation jsonb,
  validated_at timestamptz,
  approved_at timestamptz,
  activated_at timestamptz,
  last_optimized_local_day date,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ads_plans_owner_created_idx on public.ads_plans(user_id, created_at desc);
create index if not exists ads_plans_customer_status_idx on public.ads_plans(customer_id, status);
create table if not exists public.ads_runs (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  customer_id text not null,
  plan_id uuid not null references public.ads_plans(id),
  action text not null,
  status text not null check(status in ('intent','completed','failed','unknown')),
  intent jsonb not null,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists ads_runs_owner_created_idx on public.ads_runs(user_id, created_at desc);
create index if not exists ads_runs_plan_idx on public.ads_runs(plan_id);
create table if not exists public.ads_account_locks (
  customer_id text primary key,
  user_id uuid not null references auth.users(id),
  run_id uuid not null references public.ads_runs(id),
  plan_id uuid not null references public.ads_plans(id),
  created_at timestamptz not null default now()
);
-- Immutable proposal: changing a target, creative, or spending limit needs a new plan.
create or replace function public.ads_protect_plan() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.id <> old.id or new.user_id <> old.user_id or new.customer_id <> old.customer_id or new.plan <> old.plan or new.plan_hash <> old.plan_hash or new.operation_id <> old.operation_id then
    raise exception 'ADS_PLAN_IMMUTABLE';
  end if;
  return new;
end; $$;
drop trigger if exists ads_immutable_plan on public.ads_plans;
create trigger ads_immutable_plan before update on public.ads_plans for each row execute function public.ads_protect_plan();

-- One account-wide mutex survives process crashes; it NEVER expires automatically.
-- Claim, compare-and-set transition, and write-ahead audit are one transaction.
create or replace function public.ads_claim(p_user_id uuid,p_customer_id text,p_plan_id uuid,p_plan_hash text,p_run_id uuid,p_action text,p_expected text[],p_next text,p_intent jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare row_plan public.ads_plans; row_lock public.ads_account_locks;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_customer_id, 91));
  select * into row_lock from public.ads_account_locks where customer_id=p_customer_id;
  if found then raise exception 'ADS_ACCOUNT_LOCKED'; end if;
  select * into row_plan from public.ads_plans where id=p_plan_id and user_id=p_user_id and customer_id=p_customer_id for update;
  if not found then raise exception 'ADS_PLAN_NOT_FOUND'; end if;
  if row_plan.plan_hash <> p_plan_hash then raise exception 'ADS_HASH_MISMATCH'; end if;
  if not(row_plan.status=any(p_expected)) then raise exception 'ADS_STATUS_CHANGED'; end if;
  if p_action in ('approve','activate') and exists(select 1 from public.ads_plans where customer_id=p_customer_id and id<>p_plan_id and status in ('creating','paused','activating','active','pausing','unknown')) then
    raise exception 'ADS_ACCOUNT_ALREADY_MANAGED';
  end if;
  insert into public.ads_runs(id,user_id,customer_id,plan_id,action,status,intent) values(p_run_id,p_user_id,p_customer_id,p_plan_id,p_action,'intent',p_intent);
  insert into public.ads_account_locks(customer_id,user_id,run_id,plan_id) values(p_customer_id,p_user_id,p_run_id,p_plan_id);
  update public.ads_plans set status=p_next,updated_at=now(),last_error=null where id=p_plan_id;
  return to_jsonb(row_plan);
end; $$;

-- Only the holder of the original token may settle or reconcile an operation.
create or replace function public.ads_finish(p_customer_id text,p_run_id uuid,p_status text,p_result jsonb,p_error text,p_patch jsonb,p_release boolean)
returns void language plpgsql security invoker set search_path = '' as $$
declare row_lock public.ads_account_locks;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_customer_id,91));
  select * into row_lock from public.ads_account_locks where customer_id=p_customer_id and run_id=p_run_id for update;
  if not found then raise exception 'ADS_LOCK_LOST'; end if;
  update public.ads_plans set
    status=coalesce(p_patch->>'status',status),
    resources=case when p_patch ? 'resources' then p_patch->'resources' else resources end,
    validation=case when p_patch ? 'validation' then p_patch->'validation' else validation end,
    validated_at=case when p_patch ? 'validated_at' then (p_patch->>'validated_at')::timestamptz else validated_at end,
    approved_at=case when p_patch ? 'approved_at' then (p_patch->>'approved_at')::timestamptz else approved_at end,
    activated_at=case when p_patch ? 'activated_at' then (p_patch->>'activated_at')::timestamptz else activated_at end,
    last_optimized_local_day=case when p_patch ? 'last_optimized_local_day' then (p_patch->>'last_optimized_local_day')::date else last_optimized_local_day end,
    last_error=p_error,updated_at=now()
  where id=row_lock.plan_id;
  update public.ads_runs set status=p_status,result=p_result,error=p_error,finished_at=now() where id=p_run_id;
  if p_release then delete from public.ads_account_locks where customer_id=p_customer_id and run_id=p_run_id; end if;
end; $$;

alter table public.ads_plans enable row level security;
alter table public.ads_runs enable row level security;
alter table public.ads_account_locks enable row level security;
drop policy if exists ads_owner_read on public.ads_plans;
create policy ads_owner_read on public.ads_plans for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists ads_owner_read on public.ads_runs;
create policy ads_owner_read on public.ads_runs for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists ads_owner_read on public.ads_account_locks;
create policy ads_owner_read on public.ads_account_locks for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.ads_plans,public.ads_runs,public.ads_account_locks from anon,authenticated;
grant select on public.ads_plans,public.ads_runs,public.ads_account_locks to authenticated;
grant select,insert,update,delete on public.ads_plans,public.ads_runs,public.ads_account_locks to service_role;
revoke all on function public.ads_protect_plan() from public,anon,authenticated;
revoke all on function public.ads_claim(uuid,text,uuid,text,uuid,text,text[],text,jsonb) from public,anon,authenticated;
revoke all on function public.ads_finish(text,uuid,text,jsonb,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.ads_claim(uuid,text,uuid,text,uuid,text,text[],text,jsonb) to service_role;
grant execute on function public.ads_finish(text,uuid,text,jsonb,text,jsonb,boolean) to service_role;

-- A real scheduler heartbeat is required before automatic spending can start.
create table if not exists public.ads_monitor_health (
  customer_id text primary key,
  user_id uuid not null references auth.users(id),
  last_monitor_at timestamptz not null
);
alter table public.ads_monitor_health enable row level security;
drop policy if exists ads_owner_read on public.ads_monitor_health;
create policy ads_owner_read on public.ads_monitor_health for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.ads_monitor_health from anon,authenticated;
grant select on public.ads_monitor_health to authenticated;
grant select,insert,update on public.ads_monitor_health to service_role;
alter table public.ads_monitor_health add column if not exists previous_monitor_at timestamptz;
create or replace function public.ads_heartbeat(p_user_id uuid,p_customer_id text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.ads_monitor_health(customer_id,user_id,last_monitor_at)
  values(p_customer_id,p_user_id,now())
  on conflict(customer_id) do update set previous_monitor_at=public.ads_monitor_health.last_monitor_at,last_monitor_at=excluded.last_monitor_at
  where public.ads_monitor_health.user_id=excluded.user_id;
end; $$;
revoke all on function public.ads_heartbeat(uuid,text) from public,anon,authenticated;
grant execute on function public.ads_heartbeat(uuid,text) to service_role;
