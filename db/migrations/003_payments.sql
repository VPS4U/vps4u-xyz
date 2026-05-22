-- ================================================================
-- 003_payments.sql — lokalna kopia płatności klientów
-- ================================================================
-- Stage 2: webhook Stripe zapisuje tu każdą udaną wpłatę.
-- Provider-agnostic (stripe + przyszły revolut przez email-webhook).
-- Wpłaty EUR mają denormalizowane przeliczenie na PLN po kursie NBP z dnia płatności,
-- żeby historyczne sumy nie zmieniały się przy wahaniach FX.
-- ================================================================

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe', 'revolut')),
  external_charge_id text not null,
  user_id uuid not null references public.profiles(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null check (currency in ('eur', 'pln')),
  amount_pln_grosze bigint not null check (amount_pln_grosze >= 0),
  fx_rate numeric(10,4) not null check (fx_rate > 0),
  fx_source text not null default 'nbp_a' check (fx_source in ('nbp_a', 'manual', 'same')),
  fx_table_date date,
  charged_at timestamptz not null,
  quarter text not null,
  created_at timestamptz default now(),
  unique (provider, external_charge_id)
);

create index idx_payments_quarter on public.payments(quarter);
create index idx_payments_user on public.payments(user_id);
create index idx_payments_charged_at on public.payments(charged_at desc);

-- Trigger automatycznie ustawia kwartał na podstawie charged_at (UTC).
-- Postgres nie pozwala na generated columns z extract(... from timestamptz) bo to STABLE, nie IMMUTABLE.
-- Trigger daje równoważny efekt + kontrolę.
create or replace function public.compute_payment_quarter()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ts timestamp;
begin
  ts := new.charged_at at time zone 'UTC';
  new.quarter := 'Q' || extract(quarter from ts)::int || '-' || extract(year from ts)::int;
  return new;
end;
$$;

revoke execute on function public.compute_payment_quarter() from public, anon, authenticated;

create trigger payments_set_quarter
  before insert or update of charged_at on public.payments
  for each row execute function public.compute_payment_quarter();

-- RLS: zwykli userzy NIE widzą tabeli. Wgląd dostają admini w Stage 3.
-- Do Stage 3 tabela dostępna tylko przez service_role (omija RLS).
alter table public.payments enable row level security;
