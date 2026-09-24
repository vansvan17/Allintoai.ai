-- ALLXAI beta schema. Run once in Supabase: SQL Editor > New query > paste > Run.

-- Profiles: one row per account, created automatically on sign-up.
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  account_type  text not null default 'user' check (account_type in ('user', 'team', 'enterprise')),
  business_name text check (business_name is null or char_length(business_name) <= 120),
  plan          text not null default 'free' check (plan in ('free', 'users', 'team', 'enterprise', 'payg')),
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

-- Users may edit their business name only. Plan and account type are not
-- user-editable (plan changes are recorded by the admin for the beta).
revoke update on public.profiles from authenticated;
grant update (business_name) on public.profiles to authenticated;

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  t text := new.raw_user_meta_data ->> 'account_type';
begin
  insert into public.profiles (id, account_type, business_name)
  values (
    new.id,
    case when t in ('user', 'team', 'enterprise') then t else 'user' end,
    left(nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''), 120)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Requests: the problem a user submits plus the recommendation shown to them.
create table if not exists public.requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  problem    text not null check (char_length(problem) between 10 and 2000),
  category   text not null check (char_length(category) <= 40),
  volume     text not null check (char_length(volume) <= 40),
  priority   text not null check (priority in ('cost', 'balanced', 'quality')),
  result     jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists requests_user_created on public.requests (user_id, created_at desc);

alter table public.requests enable row level security;

drop policy if exists "requests: read own" on public.requests;
create policy "requests: read own" on public.requests
  for select using (auth.uid() = user_id);

-- Insert own rows only. Accounts still on the free plan get one request.
drop policy if exists "requests: insert own, free limit" on public.requests;
create policy "requests: insert own, free limit" on public.requests
  for insert with check (
    auth.uid() = user_id
    and (
      (select p.plan from public.profiles p where p.id = auth.uid()) <> 'free'
      or (select count(*) from public.requests r where r.user_id = auth.uid()) < 1
    )
  );

-- No update or delete policies: requests are an append-only record for the beta.

-- Plan choices: a user picking a plan on plans.html. Recorded only; activation
-- is manual for the beta (set profiles.plan in the Table Editor).
create table if not exists public.plan_choices (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan       text not null check (plan in ('users', 'team', 'enterprise', 'payg')),
  created_at timestamptz not null default now()
);

alter table public.plan_choices enable row level security;

drop policy if exists "plan_choices: read own" on public.plan_choices;
create policy "plan_choices: read own" on public.plan_choices
  for select using (auth.uid() = user_id);

drop policy if exists "plan_choices: insert own" on public.plan_choices;
create policy "plan_choices: insert own" on public.plan_choices
  for insert with check (auth.uid() = user_id);

-- Business listings shown on businesses.html. Managed by the admin in the
-- Table Editor; only list businesses that agreed to be shown. There is
-- deliberately no model column: model choices are never public.
create table if not exists public.listings (
  id            uuid primary key default gen_random_uuid(),
  business_name text not null check (char_length(business_name) <= 120),
  sector        text check (char_length(sector) <= 60),
  ops_accuracy  numeric(5, 1) check (ops_accuracy between 0 and 100),
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.listings enable row level security;

drop policy if exists "listings: public read" on public.listings;
create policy "listings: public read" on public.listings
  for select using (true);
