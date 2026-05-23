-- ================================================================
-- 006_admin_settings_and_alerts.sql — Stage 4
-- ================================================================
-- admin_settings: key-value config edytowalne z UI (Stage 5).
-- alert_log: gwarancja jednokrotności alertu per (quarter, threshold_pct)
-- — INSERT z ON CONFLICT DO NOTHING jest atomic i bezpieczny na webhook retries.
-- ================================================================

create table public.admin_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

create table public.alert_log (
  id uuid primary key default gen_random_uuid(),
  quarter text not null,
  threshold_pct int not null,
  amount_pln_grosze bigint not null,
  cap_pln_grosze bigint not null,
  fired_at timestamptz default now(),
  unique (quarter, threshold_pct)
);

create index idx_alert_log_quarter on public.alert_log(quarter);

-- RLS przez SECURITY DEFINER helper z migracji 005.
alter table public.admin_settings enable row level security;
alter table public.alert_log enable row level security;

create policy "Admins read admin_settings"   on public.admin_settings for select using (public.current_user_is_admin());
create policy "Admins update admin_settings" on public.admin_settings for update using (public.current_user_is_admin());
create policy "Admins read alert_log"        on public.alert_log      for select using (public.current_user_is_admin());

-- Auto-touch updated_at na settings (reuse helper z 001).
create trigger admin_settings_touch
  before update on public.admin_settings
  for each row execute function public.touch_updated_at();

-- Seed defaultów. Owner edytuje przez admin UI (Stage 5) lub SQL.
insert into public.admin_settings (key, value) values
  ('quarterly_cap',         '{"grosze": 5000000, "currency": "pln"}'::jsonb),
  ('alert_thresholds_pct',  '[50, 80, 100]'::jsonb),
  ('alert_email',           '"vps4u.xyz@gmail.com"'::jsonb);
