-- ================================================================
-- 002_harden_functions.sql — security hardening po advisorze
-- ================================================================
-- Naprawia 2 warningi z Supabase security advisor po 001_initial.sql:
--   1. touch_updated_at: mutable search_path
--   2. handle_new_user: callable via REST RPC przez anon/authenticated
-- ================================================================

-- 1. touch_updated_at: ustaw search_path eksplicytnie
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin new.updated_at = now(); return new; end;
$$;

-- 2. handle_new_user: odbierz EXECUTE od ról wystawionych w REST.
-- Trigger nadal działa (wykonuje się jako owner funkcji), ale wywołanie
-- bezpośrednio z klienta przez /rest/v1/rpc/handle_new_user jest zablokowane.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
