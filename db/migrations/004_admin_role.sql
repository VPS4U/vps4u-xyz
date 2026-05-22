-- ================================================================
-- 004_admin_role.sql — rola adminowa
-- ================================================================
-- Stage 3: dodaje flagę `is_admin` na profilach + RLS policies dające
-- adminowi wgląd we wszystkie tabele (profiles, subscriptions, vps_instances, payments).
-- Zwykli userzy zachowują wcześniejszy zakres (RLS: tylko własne wiersze).
-- ================================================================

alter table public.profiles add column is_admin boolean not null default false;

-- Admin może czytać wszystkie profile (nie tylko swój).
create policy "Admins read all profiles" on public.profiles
  for select
  using ((select is_admin from public.profiles where id = auth.uid()) = true);

-- Admin może czytać wszystkie subskrypcje.
create policy "Admins read all subscriptions" on public.subscriptions
  for select
  using ((select is_admin from public.profiles where id = auth.uid()) = true);

-- Admin może czytać wszystkie VPS-y.
create policy "Admins read all vps" on public.vps_instances
  for select
  using ((select is_admin from public.profiles where id = auth.uid()) = true);

-- Admin czyta wszystkie płatności.
-- Tabela payments do tej pory miała włączone RLS bez żadnej policy SELECT
-- dla anon/authenticated — odpowiedzi puste dla wszystkich (poza service_role).
-- Ta policy pierwsza otwiera ją adminowi.
create policy "Admins read all payments" on public.payments
  for select
  using ((select is_admin from public.profiles where id = auth.uid()) = true);

-- Seed po migracji (wykonać ręcznie w Supabase SQL Editor po pierwszym wdrożeniu):
--   update public.profiles set is_admin = true where email = '<owner_email>';
