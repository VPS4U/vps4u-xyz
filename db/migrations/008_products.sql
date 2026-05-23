-- ================================================================
-- 008_products.sql — Stage 7.1
-- ================================================================
-- Schema agregatora reseller: 3 tabele opisujące dostawców, linie produktowe i cenniki.
-- Cennik seedowany z briefu (docs/vps-brief.md sekcje 7-8).
-- PLN price = EUR × 4.30 round to grosze (admin może później skorygować).
-- ================================================================

-- 1) provider_info — meta o 6 dostawcach
create table public.provider_info (
  id serial primary key,
  code text unique not null check (code in ('hetzner_cx','contabo','hetzner_cpx','hostinger','ovh_value','ovh_comfort')),
  name text not null,
  country text not null check (length(country) = 2),
  has_polish_panel boolean default false,
  notes text,
  created_at timestamptz default now()
);

-- 2) product_lines — 6 linii marketingowych mapowanych na dostawców
create table public.product_lines (
  id serial primary key,
  sku_code text unique not null check (sku_code in ('gold','orange','czarny','bialy','czerwony','niebieski')),
  marketing_name text not null,
  provider_id int not null references public.provider_info(id),
  positioning text,
  backup_available boolean default true,
  backup_included_from text check (backup_included_from in ('L','base')),  -- null = brak, 'L' = od L wzwyż, 'base' = wszędzie
  anti_ddos_level text check (anti_ddos_level in ('basic','advanced','enterprise')),
  locations text[] not null default '{}',
  active boolean default false,
  created_at timestamptz default now()
);

-- 3) product_configurations — lookup table cen (~90 wierszy z briefu)
create table public.product_configurations (
  id serial primary key,
  line_id int not null references public.product_lines(id) on delete cascade,
  hardware_combo text not null check (hardware_combo in ('base','S','D','S+D','L','L+S','L+D','L+S+D')),
  addons text[] not null default '{}',
  -- Specy
  vcpu int not null check (vcpu > 0),
  ram_gb int not null check (ram_gb > 0),
  disk_gb int not null check (disk_gb > 0),
  transfer_tb int,
  ipv4_count int default 1,
  port_mbps int,
  has_backup boolean default false,
  -- Ceny w 4 wariantach (cents/grosze)
  price_monthly_eur_cents int not null check (price_monthly_eur_cents > 0),
  price_monthly_pln_grosze int not null check (price_monthly_pln_grosze > 0),
  price_yearly_eur_cents int check (price_yearly_eur_cents > 0),
  price_yearly_pln_grosze int check (price_yearly_pln_grosze > 0),
  -- Stripe IDs wpinane przez setup-stripe.js (Stage 7.2)
  stripe_product_id text,
  stripe_price_monthly_eur_id text,
  stripe_price_monthly_pln_id text,
  stripe_price_yearly_eur_id text,
  stripe_price_yearly_pln_id text,
  -- Operacyjne (do markup tracking)
  cost_price_monthly_eur_cents int,
  markup_percent int,
  active boolean default false,
  created_at timestamptz default now(),
  unique (line_id, hardware_combo, addons)
);

create index idx_configs_line on public.product_configurations(line_id);
create index idx_configs_active on public.product_configurations(active);

-- RLS — public read dla aktywnych produktów (potrzebne do porównywarki publicznej)
alter table public.provider_info enable row level security;
alter table public.product_lines enable row level security;
alter table public.product_configurations enable row level security;

create policy "Public read providers" on public.provider_info for select using (true);
create policy "Public read active lines" on public.product_lines for select using (active = true);
create policy "Public read active configs" on public.product_configurations for select using (active = true);

-- Admin (przez SECURITY DEFINER helper z migracji 005) — pełen dostęp do zarządzania
create policy "Admins manage providers" on public.provider_info for all using (public.current_user_is_admin());
create policy "Admins manage lines" on public.product_lines for all using (public.current_user_is_admin());
create policy "Admins manage configs" on public.product_configurations for all using (public.current_user_is_admin());

-- ================================================================
-- Seed: 6 providerów
-- ================================================================
insert into public.provider_info (code, name, country, has_polish_panel, notes) values
  ('hetzner_cx',  'Hetzner Cloud (CX line)',  'DE', false, 'Cost-optimized, AMD shared'),
  ('contabo',     'Contabo Cloud VPS',         'DE', false, 'Resource-heavy, sieć wolniejsza ale dużo dysku'),
  ('hetzner_cpx', 'Hetzner Cloud (CPX line)', 'DE', false, 'Performance, AMD shared lepszy zegar'),
  ('hostinger',   'Hostinger KVM',             'LT', true,  'Panel po polsku, weekly backup'),
  ('ovh_value',   'OVHcloud Value/Essential',  'FR', false, 'AMD EPYC, NVMe, anti-DDoS basic'),
  ('ovh_comfort', 'OVHcloud Comfort+',         'FR', false, 'Dedykowane zasoby, SLA 99.99%, RGPD/HDS');

-- ================================================================
-- Seed: 6 linii (wszystkie active=true — wszyscy dostawcy zakontraktowani)
-- ================================================================
insert into public.product_lines (sku_code, marketing_name, provider_id, positioning, backup_available, backup_included_from, anti_ddos_level, locations, active) values
  ('gold',      'Cloud Lite',       (select id from public.provider_info where code='hetzner_cx'),  'Najtaniej, dev/test, projekty osobiste, EU-only', false, null, 'basic',      array['DE-FSN','DE-NBG','FI-HEL'], true),
  ('orange',    'Cloud Standard',   (select id from public.provider_info where code='contabo'),     'Tanie aplikacje z dużym dyskiem, blogi WordPress', false, null, 'basic',      array['DE','EU'], true),
  ('czarny',    'Cloud Business',   (select id from public.provider_info where code='hetzner_cpx'), 'Małe firmy, sklepy startujące, niemiecki DC',     true, null, 'basic',      array['DE-FSN','DE-NBG','FI-HEL'], true),
  ('bialy',     'Cloud Performance',(select id from public.provider_info where code='hostinger'),   'Aplikacje produkcyjne, panel po polsku, weekly backup', true, 'L', 'basic', array['DE','NL','LT'], true),
  ('czerwony',  'Cloud Pro',        (select id from public.provider_info where code='ovh_value'),   'Agencje, freelancerzy, dużo lokalizacji EU',      true, null, 'advanced',   array['PL-WAW','FR','DE','UK'], true),
  ('niebieski', 'Cloud Enterprise', (select id from public.provider_info where code='ovh_comfort'), 'Enterprise, SLA 99.99%, francuski DC, RGPD',      true, 'L', 'enterprise', array['PL-WAW','FR','DE','UK'], true);

-- ================================================================
-- Seed: 90 konfiguracji z cennika briefu (sekcje 7-8)
-- Wygenerowane przez scripts/_gen_seed_configurations.py (deterministyczny)
-- ================================================================
insert into public.product_configurations (
  line_id, hardware_combo, addons, vcpu, ram_gb, disk_gb, transfer_tb, ipv4_count, port_mbps,
  has_backup, price_monthly_eur_cents, price_monthly_pln_grosze, price_yearly_eur_cents, price_yearly_pln_grosze, active
) values
  ((select id from public.product_lines where sku_code='gold'), 'base', '{}', 2, 4, 80, 20, 1, 1000, false, 1500, 6450, 11000, 47300, true),
  ((select id from public.product_lines where sku_code='orange'), 'base', '{}', 2, 4, 80, 32, 1, 1000, false, 1800, 7740, 12592, 54146, true),
  ((select id from public.product_lines where sku_code='czarny'), 'base', '{}', 2, 4, 80, 20, 1, 1000, false, 2000, 8600, 13270, 57061, true),
  ((select id from public.product_lines where sku_code='bialy'), 'base', '{}', 2, 4, 80, 4, 1, 1000, false, 2000, 8600, 14200, 61060, true),
  ((select id from public.product_lines where sku_code='czerwony'), 'base', '{}', 2, 4, 80, 100, 1, 1000, false, 2300, 9890, 13500, 58050, true),
  ((select id from public.product_lines where sku_code='niebieski'), 'base', '{}', 2, 4, 80, 100, 1, 1000, false, 3600, 15480, 18300, 78690, true),
  ((select id from public.product_lines where sku_code='czarny'), 'base', '{A}', 2, 4, 80, 20, 1, 1000, true, 2000, 8600, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='bialy'), 'base', '{A}', 2, 4, 80, 4, 1, 1000, true, 2000, 8600, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='czerwony'), 'base', '{A}', 2, 4, 80, 100, 1, 1000, true, 2300, 9890, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='niebieski'), 'base', '{A}', 2, 4, 80, 100, 1, 1000, true, 2300, 9890, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='gold'), 'base', '{X}', 2, 4, 80, 20, 2, 1000, false, 1600, 6880, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='orange'), 'base', '{X}', 2, 4, 80, 32, 2, 1000, false, 1900, 8170, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='czarny'), 'base', '{X}', 2, 4, 80, 20, 2, 1000, false, 1800, 7740, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='bialy'), 'base', '{X}', 2, 4, 80, 8, 2, 1000, false, 2200, 9460, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='czerwony'), 'base', '{X}', 2, 4, 80, 100, 2, 1000, false, 2500, 10750, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='niebieski'), 'base', '{X}', 2, 4, 80, 100, 2, 2000, false, 2600, 11180, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='gold'), 'D', '{}', 2, 4, 160, 20, 1, 1000, false, 2000, 8600, 14500, 62350, true),
  ((select id from public.product_lines where sku_code='orange'), 'D', '{}', 2, 4, 160, 32, 1, 1000, false, 2400, 10320, 16964, 72945, true),
  ((select id from public.product_lines where sku_code='czarny'), 'D', '{}', 2, 4, 160, 20, 1, 1000, false, 2200, 9460, 15430, 66349, true),
  ((select id from public.product_lines where sku_code='bialy'), 'D', '{}', 2, 4, 160, 4, 1, 1000, false, 2600, 11180, 18900, 81270, true),
  ((select id from public.product_lines where sku_code='czerwony'), 'D', '{}', 2, 4, 160, 100, 1, 1000, false, 3100, 13330, 18700, 80410, true),
  ((select id from public.product_lines where sku_code='niebieski'), 'D', '{}', 2, 4, 160, 100, 1, 1000, false, 3100, 13330, 23000, 98900, true),
  ((select id from public.product_lines where sku_code='gold'), 'S', '{}', 2, 8, 80, 20, 1, 1000, false, 1800, 7740, 14000, 60200, true),
  ((select id from public.product_lines where sku_code='orange'), 'S', '{}', 2, 8, 80, 32, 1, 1000, false, 2300, 9890, 16031, 68933, true),
  ((select id from public.product_lines where sku_code='czarny'), 'S', '{}', 2, 8, 80, 20, 1, 1000, false, 2200, 9460, 13572, 58360, true),
  ((select id from public.product_lines where sku_code='bialy'), 'S', '{}', 2, 8, 80, 4, 1, 1000, false, 2600, 11180, 16000, 68800, true),
  ((select id from public.product_lines where sku_code='czerwony'), 'S', '{}', 2, 8, 80, 100, 1, 1000, false, 3000, 12900, 17800, 76540, true),
  ((select id from public.product_lines where sku_code='niebieski'), 'S', '{}', 2, 8, 80, 100, 1, 1000, false, 3000, 12900, 22100, 95030, true),
  ((select id from public.product_lines where sku_code='gold'), 'S', '{X}', 2, 8, 80, 20, 2, 1000, false, 2000, 8600, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='orange'), 'S', '{X}', 2, 8, 80, 32, 2, 1000, false, 2500, 10750, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='czarny'), 'S', '{X}', 2, 8, 80, 20, 2, 1000, false, 2300, 9890, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='bialy'), 'S', '{X}', 2, 8, 80, 8, 2, 1000, false, 2800, 12040, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='czerwony'), 'S', '{X}', 2, 8, 80, 100, 2, 1000, false, 3200, 13760, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='niebieski'), 'S', '{X}', 2, 8, 80, 100, 2, 2000, false, 3200, 13760, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='gold'), 'S+D', '{}', 2, 8, 160, 20, 1, 1000, false, 2400, 10320, 17600, 75680, true),
  ((select id from public.product_lines where sku_code='orange'), 'S+D', '{}', 2, 8, 160, 32, 1, 1000, false, 2900, 12470, 20179, 86770, true),
  ((select id from public.product_lines where sku_code='czarny'), 'S+D', '{}', 2, 8, 160, 20, 1, 1000, false, 2800, 12040, 16666, 71664, true),
  ((select id from public.product_lines where sku_code='bialy'), 'S+D', '{}', 2, 8, 160, 4, 1, 1000, false, 2600, 11180, 17800, 76540, true),
  ((select id from public.product_lines where sku_code='czerwony'), 'S+D', '{}', 2, 8, 160, 100, 1, 1000, false, 3200, 13760, 19600, 84280, true),
  ((select id from public.product_lines where sku_code='niebieski'), 'S+D', '{}', 2, 8, 160, 100, 1, 1000, false, 3800, 16340, 26000, 111800, true),
  ((select id from public.product_lines where sku_code='gold'), 'L', '{}', 4, 8, 80, 20, 1, 1000, false, 2600, 11180, 17700, 76110, true),
  ((select id from public.product_lines where sku_code='orange'), 'L', '{}', 4, 8, 80, 32, 1, 1000, false, 2500, 10750, 17897, 76957, true),
  ((select id from public.product_lines where sku_code='czarny'), 'L', '{}', 4, 8, 80, 20, 1, 1000, false, 2600, 11180, 15827, 68056, true),
  ((select id from public.product_lines where sku_code='bialy'), 'L', '{}', 4, 8, 80, 4, 1, 1000, true, 3000, 12900, 22600, 97180, true),
  ((select id from public.product_lines where sku_code='czerwony'), 'L', '{}', 4, 8, 80, 100, 1, 1000, false, 3200, 13760, 19600, 84280, true),
  ((select id from public.product_lines where sku_code='niebieski'), 'L', '{}', 4, 8, 80, 100, 1, 1000, true, 3500, 15050, 27000, 116100, true),
  ((select id from public.product_lines where sku_code='czarny'), 'L', '{A}', 4, 8, 80, 20, 1, 1000, true, 2600, 11180, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='bialy'), 'L', '{A}', 4, 8, 80, 4, 1, 1000, true, 3000, 12900, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='czerwony'), 'L', '{A}', 4, 8, 80, 100, 1, 1000, true, 3200, 13760, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='niebieski'), 'L', '{A}', 4, 8, 80, 100, 1, 1000, true, 3500, 15050, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='gold'), 'L', '{X}', 4, 8, 80, 20, 2, 1000, false, 2800, 12040, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='orange'), 'L', '{X}', 4, 8, 80, 32, 2, 1000, false, 2700, 11610, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='czarny'), 'L', '{X}', 4, 8, 80, 20, 2, 1000, false, 2800, 12040, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='bialy'), 'L', '{X}', 4, 8, 80, 8, 2, 1000, true, 3300, 14190, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='czerwony'), 'L', '{X}', 4, 8, 80, 100, 2, 1000, false, 3400, 14620, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='niebieski'), 'L', '{X}', 4, 8, 80, 100, 2, 2000, true, 3600, 15480, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='czarny'), 'L', '{X,A}', 4, 8, 80, 20, 2, 1000, true, 2800, 12040, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='bialy'), 'L', '{X,A}', 4, 8, 80, 8, 2, 1000, true, 3300, 14190, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='czerwony'), 'L', '{X,A}', 4, 8, 80, 100, 2, 1000, true, 3400, 14620, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='niebieski'), 'L', '{X,A}', 4, 8, 80, 100, 2, 2000, true, 3600, 15480, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='gold'), 'L+S', '{}', 4, 16, 80, 20, 1, 1000, false, 2900, 12470, 19700, 84710, true),
  ((select id from public.product_lines where sku_code='orange'), 'L+S', '{}', 4, 16, 80, 32, 1, 1000, false, 3100, 13330, 21084, 90661, true),
  ((select id from public.product_lines where sku_code='czarny'), 'L+S', '{}', 4, 16, 80, 20, 1, 1000, false, 3200, 13760, 18003, 77413, true),
  ((select id from public.product_lines where sku_code='bialy'), 'L+S', '{}', 4, 16, 80, 4, 1, 1000, true, 3600, 15480, 23500, 101050, true),
  ((select id from public.product_lines where sku_code='czerwony'), 'L+S', '{}', 4, 16, 80, 100, 1, 1000, false, 3400, 14620, 20400, 87720, true),
  ((select id from public.product_lines where sku_code='niebieski'), 'L+S', '{}', 4, 16, 80, 100, 1, 1000, true, 4000, 17200, 29400, 126420, true),
  ((select id from public.product_lines where sku_code='gold'), 'L+D', '{}', 4, 8, 160, 20, 1, 1000, false, 3200, 13760, 21100, 90730, true),
  ((select id from public.product_lines where sku_code='orange'), 'L+D', '{}', 4, 8, 160, 32, 1, 1000, false, 3200, 13760, 21988, 94548, true),
  ((select id from public.product_lines where sku_code='czarny'), 'L+D', '{}', 4, 8, 160, 20, 1, 1000, false, 3200, 13760, 17886, 76910, true),
  ((select id from public.product_lines where sku_code='bialy'), 'L+D', '{}', 4, 8, 160, 4, 1, 1000, true, 3600, 15480, 27600, 118680, true),
  ((select id from public.product_lines where sku_code='czerwony'), 'L+D', '{}', 4, 8, 160, 100, 1, 1000, false, 3500, 15050, 21300, 91590, true),
  ((select id from public.product_lines where sku_code='niebieski'), 'L+D', '{}', 4, 8, 160, 100, 1, 1000, true, 4200, 18060, 31400, 135020, true),
  ((select id from public.product_lines where sku_code='gold'), 'L+D', '{X}', 4, 8, 160, 20, 2, 1000, false, 3500, 15050, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='orange'), 'L+D', '{X}', 4, 8, 160, 32, 2, 1000, false, 3300, 14190, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='czarny'), 'L+D', '{X}', 4, 8, 160, 20, 2, 1000, false, 3500, 15050, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='bialy'), 'L+D', '{X}', 4, 8, 160, 8, 2, 1000, true, 3900, 16770, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='czerwony'), 'L+D', '{X}', 4, 8, 160, 100, 2, 1000, false, 3600, 15480, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='niebieski'), 'L+D', '{X}', 4, 8, 160, 100, 2, 2000, true, 4400, 18920, NULL, NULL, true),
  ((select id from public.product_lines where sku_code='gold'), 'L+S+D', '{}', 4, 16, 160, 20, 1, 1000, false, 3600, 15480, 22100, 95030, true),
  ((select id from public.product_lines where sku_code='orange'), 'L+S+D', '{}', 4, 16, 160, 32, 1, 1000, false, 3700, 15910, 24830, 106769, true),
  ((select id from public.product_lines where sku_code='czarny'), 'L+S+D', '{}', 4, 16, 160, 20, 1, 1000, false, 3900, 16770, 20983, 90227, true),
  ((select id from public.product_lines where sku_code='bialy'), 'L+S+D', '{}', 4, 16, 160, 4, 1, 1000, true, 4300, 18490, 27500, 118250, true),
  ((select id from public.product_lines where sku_code='czerwony'), 'L+S+D', '{}', 4, 16, 160, 100, 1, 1000, false, 4700, 20210, 29000, 124700, true),
  ((select id from public.product_lines where sku_code='niebieski'), 'L+S+D', '{}', 4, 16, 160, 100, 1, 1000, true, 4800, 20640, 35100, 150930, true),
  ((select id from public.product_lines where sku_code='gold'), 'L+S+D', '{X}', 4, 16, 160, 20, 2, 1000, false, 3900, 16770, 22500, 96750, true),
  ((select id from public.product_lines where sku_code='orange'), 'L+S+D', '{X}', 4, 16, 160, 32, 2, 1000, false, 3800, 16340, 25703, 110523, true),
  ((select id from public.product_lines where sku_code='czarny'), 'L+S+D', '{X}', 4, 16, 160, 20, 2, 1000, false, 4100, 17630, 21203, 91173, true),
  ((select id from public.product_lines where sku_code='bialy'), 'L+S+D', '{X}', 4, 16, 160, 8, 2, 1000, true, 4600, 19780, 26600, 114380, true),
  ((select id from public.product_lines where sku_code='czerwony'), 'L+S+D', '{X}', 4, 16, 160, 100, 2, 1000, false, 4800, 20640, 29800, 128140, true),
  ((select id from public.product_lines where sku_code='niebieski'), 'L+S+D', '{X}', 4, 16, 160, 100, 2, 2000, true, 5100, 21930, 36800, 158240, true)
;
