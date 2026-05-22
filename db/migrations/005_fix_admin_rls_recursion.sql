-- ================================================================
-- 005_fix_admin_rls_recursion.sql
-- ================================================================
-- Po migracji 004 wszystkie SELECT-y do tabel z RLS zwracały 500.
-- Powód: policy "Admins read all *" zawierały subquery `select is_admin from public.profiles where id = auth.uid()`,
-- co triggerowało RLS rekursywnie → "infinite recursion in policy" lub fail w trakcie evaluacji.
--
-- Fix: SECURITY DEFINER helper `current_user_is_admin()` omija RLS w środku
-- (uruchamia się z prawami właściciela funkcji), zwraca jedno bool, brak rekursji.
-- ================================================================

create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Wymiana policies: usuń stare (z subquery) i utwórz nowe (z funkcją).
drop policy if exists "Admins read all profiles" on public.profiles;
drop policy if exists "Admins read all subscriptions" on public.subscriptions;
drop policy if exists "Admins read all vps" on public.vps_instances;
drop policy if exists "Admins read all payments" on public.payments;

create policy "Admins read all profiles"      on public.profiles      for select using (public.current_user_is_admin());
create policy "Admins read all subscriptions" on public.subscriptions for select using (public.current_user_is_admin());
create policy "Admins read all vps"           on public.vps_instances for select using (public.current_user_is_admin());
create policy "Admins read all payments"      on public.payments      for select using (public.current_user_is_admin());
