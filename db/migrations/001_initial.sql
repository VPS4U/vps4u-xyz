-- ================================================================
-- 001_initial.sql — schemat startowy VPS4U.xyz
-- ================================================================
-- Uruchom w Supabase: Dashboard → SQL Editor → New query → wklej → Run.
-- Po wykonaniu zaznacz checkbox w PR ("migracja zaaplikowana").
-- ================================================================

-- public.profiles — rozszerza auth.users o nasze pola
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  stripe_customer_id text unique,
  preferred_language text default 'pl' check (preferred_language in ('pl', 'en')),
  tos_accepted_at timestamptz,
  immediate_service_accepted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- public.subscriptions — Stripe subscriptions (mapowanie 1:1)
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_subscription_id text unique not null,
  stripe_price_id text not null,
  plan_name text not null,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- public.vps_instances — instancje VPS (provisioned via Contabo)
create table public.vps_instances (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  contabo_instance_id text unique,
  ip_address inet,
  region text,
  ssh_username text default 'root',
  status text not null default 'provisioning',
  provisioned_at timestamptz,
  created_at timestamptz default now()
);

-- Indeksy
create index idx_subscriptions_user on public.subscriptions(user_id);
create index idx_subscriptions_status on public.subscriptions(status);
create index idx_vps_user on public.vps_instances(user_id);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.vps_instances enable row level security;

create policy "Users read own profile"    on public.profiles      for select using (auth.uid() = id);
create policy "Users update own profile"  on public.profiles      for update using (auth.uid() = id);
create policy "Users read own subs"       on public.subscriptions for select using (auth.uid() = user_id);
create policy "Users read own vps"        on public.vps_instances for select using (auth.uid() = user_id);

-- Trigger: nowy user w auth.users → row w public.profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger: auto-touch updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_touch      before update on public.profiles      for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.touch_updated_at();
