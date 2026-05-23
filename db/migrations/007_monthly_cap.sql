-- ================================================================
-- 007_monthly_cap.sql — Stage 6.1
-- ================================================================
-- Wsparcie dla miesięcznego capu równoległego do kwartalnego.
-- - payments.month (text, format 'YYYY-MM' UTC) — obliczany triggerem
-- - monthly_alert_log z unique(month, threshold_pct)
-- - seed admin_settings.monthly_cap + monthly_alert_thresholds_pct
-- ================================================================

-- 1) Trigger function rozszerzona o month (zastępuje compute_payment_quarter)
create or replace function public.compute_payment_period()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ts timestamp;
begin
  ts := new.charged_at at time zone 'UTC';
  new.quarter := 'Q' || extract(quarter from ts)::int || '-' || extract(year from ts)::int;
  new.month := to_char(ts, 'YYYY-MM');
  return new;
end;
$$;

revoke execute on function public.compute_payment_period() from public, anon, authenticated;

-- 2) Kolumna month + backfill + NOT NULL
alter table public.payments add column if not exists month text;

update public.payments
set month = to_char(charged_at at time zone 'UTC', 'YYYY-MM')
where month is null;

alter table public.payments alter column month set not null;

create index if not exists idx_payments_month on public.payments(month);

-- 3) Podmiana triggera na nowy (drop old quarter-only trigger, create new period trigger)
drop trigger if exists payments_set_quarter on public.payments;
create trigger payments_set_period
  before insert or update of charged_at on public.payments
  for each row execute function public.compute_payment_period();

-- 4) Tabela monthly_alert_log
create table public.monthly_alert_log (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  threshold_pct int not null,
  amount_pln_grosze bigint not null,
  cap_pln_grosze bigint not null,
  fired_at timestamptz default now(),
  unique (month, threshold_pct)
);

create index idx_monthly_alert_log_month on public.monthly_alert_log(month);

alter table public.monthly_alert_log enable row level security;

create policy "Admins read monthly_alert_log" on public.monthly_alert_log
  for select using (public.current_user_is_admin());

-- 5) Seed admin_settings (idempotent — nie nadpisuje istniejących wartości)
insert into public.admin_settings (key, value) values
  ('monthly_cap',                  '{"grosze": 2000000, "currency": "pln"}'::jsonb),
  ('monthly_alert_thresholds_pct', '[50, 80, 100]'::jsonb)
on conflict (key) do nothing;
