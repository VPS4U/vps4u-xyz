-- 009_vps_instances.sql
-- Stage 8.1: rebuild vps_instances pod aggregator model (manual provisioning workflow).
-- Stara tabela (z 001_initial.sql) była zaprojektowana pod 1 user = 1 subscription = 1 vps Contabo.
-- Nowy model: 1 płatność (Stripe Checkout) → 1 wpis vps_instances, admin ręcznie zamawia u providera.
-- Tabela jest pusta (sprawdzone) — bezpieczne DROP + CREATE.

-- Drop old policies (z 001_initial.sql i 004/005 admin policies)
drop policy if exists "Users read own vps" on public.vps_instances;
drop policy if exists "Admins read all vps" on public.vps_instances;

-- Drop old table
drop table if exists public.vps_instances;

-- Enum statusu
do $$ begin
  create type public.vps_status as enum ('pending', 'provisioning', 'active', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table public.vps_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete set null,

  -- Konfiguracja zamówiona przez klienta (kopia z Stripe metadata, dla audytu po anulowaniu subskrypcji)
  line_sku text not null,
  hardware_combo text not null,
  addons text[] not null default '{}',
  provider text not null check (provider in ('hetzner_cx','hetzner_cpx','contabo','hostinger','ovh_value','ovh_comfort')),

  -- Dane providera (po ręcznym zamówieniu)
  provider_instance_id text,              -- ID maszyny u providera (np. Hetzner server ID, Contabo instance number)
  ipv4 inet,
  ipv6 inet,
  ssh_user text default 'root',
  ssh_credentials_encrypted bytea,        -- AES-256-GCM ciphertext: [iv(12B)|tag(16B)|ct] (klucz w env VPS_CREDENTIALS_KEY)
  hostname text,                          -- np. vps-001.vps4u.xyz

  status public.vps_status not null default 'pending',
  provisioned_at timestamptz,
  cancelled_at timestamptz,
  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_vps_instances_user on public.vps_instances(user_id);
create index idx_vps_instances_status on public.vps_instances(status);
create index idx_vps_instances_payment on public.vps_instances(payment_id);

-- Trigger updated_at
create or replace function public.touch_vps_instances_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_vps_instances_updated_at
  before update on public.vps_instances
  for each row execute function public.touch_vps_instances_updated_at();

-- RLS
alter table public.vps_instances enable row level security;

-- Klient widzi swoje VPS-y (do panelu klienta, Stage 8.2).
-- UWAGA: ssh_credentials_encrypted i tak będzie szyfrowane, ale dla pewności klient nie powinien
-- selektować raw bytes — endpoint /api/me/vps/:id/credentials zrobi deszyfrowanie i return plaintext jednorazowo.
create policy "Users read own vps"
  on public.vps_instances for select
  using (auth.uid() = user_id);

create policy "Admins manage vps"
  on public.vps_instances for all
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());
