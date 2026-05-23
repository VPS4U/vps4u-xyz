# Plan: Aggregator/Reseller MVP

**Status:** do zatwierdzenia · **Data:** 2026-05-24 · **Bazuje na:** [vps-brief.md](../vps-brief.md)

## Context

Brief `vps-brief.md` opisuje model: agregator/reseller 6 dostawców VPS z polskim brandem nadrzędnie. Obecna implementacja (`i18n.jsx`, `rejestracja.html`) ma generyczny cennik 6 planów własnej infrastruktury — kompletnie nie pasuje do nowego modelu.

**MVP scope** (uproszczone vs pełen brief):
- ✅ **Pełen cennik z briefu** (sekcje 7-8 z briefu) — wszystkie 6 linii × ~16 konfiguracji × 2 okresy, zachowane bez zmian
- ✅ **Brand z transparencją (hybryda)** — VPS4U na froncie, ujawnienie dostawcy w karcie produktu + regulaminie
- ✅ **EUR + PLN** waluty, klient wybiera
- ✅ **Stripe** subskrypcje (primary), **Revolut Pro** dla B2B przelewów (secondary, via email parser z planu revenue-cap)
- ❌ **SLA % / response times** — usunięte z UI (właściciel nie chce zobowiązań)
- ❌ **"Polski support 24/7"** zamieniony na soft: *"Personalny polski support, zwykle odpisuję w kilka godzin w dni robocze"*
- ⚠️ **Porównywarka** w wersji prostej (filtry cena/RAM/lokalizacja, nie pełen interactive engine)
- ⚠️ **Start z 2-3 dostawcami aktywnymi w Stripe** (top sellers), reszta w DB ale UI disabled / "wkrótce"

## Decyzje strategiczne wymagające właściciela (z briefu sekcja 12)

Te trzeba rozstrzygnąć **przed implementacją Stage 7.2** (setup Stripe). Reszta planu może iść równolegle.

| # | Decyzja | Stan |
|---|---|---|
| D1 | Którzy z 6 dostawców są **realnie zakontraktowani**? (Hetzner Cloud x2, Contabo, Hostinger, OVH x2) | ❓ |
| D2 | Marża i ceny kosztowe — czy obecny cennik z marżą 25-35% nad dostawcą jest OK po podwyżkach 2026? | ❓ |
| D3 | Nazwy marketingowe linii: "Cloud Lite/Standard/Business/Performance/Pro/Enterprise" czy własne? | ❓ |
| D4 | Zakres "polskiego supportu" w UI — kanały (email/chat/telefon), godziny | "Personalny, w kilka godzin w dni robocze" — propozycja |
| D5 | Migracje w cenie czy płatne? | ❓ |
| D6 | Backup w cenie — które plany mają wliczone? Brief mówi: Biały L+, Niebieski L+; Czarny/Czerwony płatne; Gold/Orange brak | OK z briefu |
| D7 | Anomalia w cenniku Biały: dodanie X do L+S+D obniża cenę o €9 rocznie | Sprawdzić, poprawić w DB |
| D8 | Cennik roczny bez konfiguracji A i samodzielnego X — świadomie czy dodać? | OK z briefu (komunikat "wybierz wyższy plan lub miesięcznie") |
| D9 | Strategia waloryzacji — jak komunikować klientom podwyżki | Klauzula 30-dniowego wyprzedzenia w regulaminie + zamrożenie ceny rocznej |

**MVP minimum**: D1, D3 muszą być rozstrzygnięte przed Stage 7.2. Reszta może być wartościami placeholder w UI/copy.

---

## Architektura: zachowane + nowe

### Zachowane bez zmian
- `lib/fx.js`, `lib/brevo.js`, `lib/supabase-admin.js`, `lib/admin-*` — wszystkie helpery
- `api/stripe/webhook.js` — webhook (już obsługuje `checkout.session.completed`)
- `admin.html` + cap tracking (kwartalny + miesięczny)
- Migracje 001-007 — bez zmian
- Auth flow (Supabase magic-link)

### Nowe
- Migracja 008: schemat produktów (`product_lines`, `product_configurations`, `provider_info`)
- `scripts/setup-stripe.js` — Node script tworzący Stripe Products + Prices z cennika
- `api/checkout/create.js` — endpoint POST tworzący Stripe Checkout Session
- `lib/pricing.js` — czysty helper liczenia ceny z lookup (testowalny)
- `index.html` — przerobiony hero z porównywarką MVP
- `rejestracja.html` → `konfigurator.html` — wybór linii + konfiguracji
- Nowe komponenty: line cards, configurator, comparison table

### Wycofane
- `i18n.jsx` cennik 6 planów Micro-Beast — usunięty
- `rejestracja.html` placeholder Payment Links (`REPLACE_WITH_STRIPE_LINK_*`) — zastąpione przez konfigurator
- Wszystkie wzmianki "własna infrastruktura" w copy

---

## Etapowanie (7 PR-ów, ~tydzień roboczy każdy nie blokujący)

### Stage 7.1 — Schema produktów (1 PR)
**Business value:** Backend "wie" o całym cenniku z briefu. Bez UI ale można queriować przez SQL.

- Migracja 008: 3 tabele
  - `provider_info(id, code, name, country, has_polish_panel, notes)` — Hetzner, Contabo, Hostinger, OVH × 2
  - `product_lines(id, sku_code, marketing_name, provider_id, positioning, backup_available, backup_included_from, anti_ddos_level, active)` — 6 linii (Gold/Orange/Czarny/Biały/Czerwony/Niebieski)
  - `product_configurations(id, line_id, hardware_combo, addons, vcpu, ram_gb, disk_gb, transfer_tb, ipv4_count, port_mbps, price_monthly_eur, price_yearly_eur, price_monthly_pln_grosze, price_yearly_pln_grosze, active)` — ~96 wierszy
- Seed danych z cennika briefu (sekcje 7-8) — z polami `active=false` jeśli linia jeszcze nie zakontraktowana (decyzja D1)
- `lib/pricing.js` — `lookupPrice({lineSku, hardware, addons, period, currency})` + testy

### Stage 7.2 — Setup script Stripe + price catalog (1 PR + skrypt do uruchomienia)
**Business value:** Wszystkie aktywne SKU mają odpowiadające Products+Prices w Stripe. Reusable dla Test/Live mode.

- `scripts/setup-stripe.js` — czyta `product_configurations` z DB (gdzie `active=true`), dla każdej tworzy:
  - Stripe Product (1× per `line + hardware + addons` combo)
  - Stripe Prices (4× per kombinacja: monthly EUR, monthly PLN, yearly EUR, yearly PLN — jeśli `available`)
  - Zapisuje `stripe_product_id`, `stripe_price_id_{period}_{currency}` z powrotem do DB
- Idempotent: pomija jeśli już istnieje (mapowanie przez metadata `internal_sku`)
- ENV: `STRIPE_SECRET_KEY` z `.env.local`
- Run: `npm run setup:stripe` (target Test mode default, `STRIPE_LIVE=1` dla Live)
- Skrypt **nie usuwa** starych Stripe Products — manualnie archiwizujemy w Dashboard jeśli cennik się zmienia
- Testy: mockowany Stripe, sprawdzenie że dla 3 aktywnych konfigów tworzą się 3 Products × 4 Prices

### Stage 7.3 — Backend checkout endpoint (1 PR)
**Business value:** Frontend może już bezpiecznie skierować klienta do Stripe płatności.

- `api/checkout/create.js`:
  - POST z `{line_sku, hardware_combo, addons, period, currency}`
  - Walidacja: czy taka kombinacja istnieje w `product_configurations` i jest `active`
  - Pobiera `stripe_price_id` z DB
  - Tworzy `Stripe.checkout.sessions.create({mode: period === 'yearly' ? 'subscription' : 'subscription', line_items: [{price: stripe_price_id, quantity: 1}], ...})`
  - Success URL: `https://vps4u.xyz/dziekujemy?session_id={CHECKOUT_SESSION_ID}`
  - Cancel URL: `/konfigurator`
  - Zwraca `{checkout_url}`, frontend redirect
- Idempotency: opcjonalnie `idempotency_key` w `Stripe-Idempotency-Key` header
- Testy integracyjne: walidacja payloadu + happy path z zamockowanym Stripe

### Stage 7.4 — Konfigurator UI (`konfigurator.html`) (1 PR)
**Business value:** Klient może wybrać linię + konfigurację + addony i przejść do checkout.

- Nowa strona `/konfigurator?line=czarny` (link z porównywarki / hero)
- Sekcje:
  - **Header**: nazwa marketingowa + "Powered by Hetzner" + krótkie pozycjonowanie + flaga DC
  - **Picker konfiguracji**: 8 kombinacji (Starter, Starter+RAM, Starter+Disk, Starter Plus, Performance, Performance+RAM, Performance+Disk, Pro) z marketingowymi nazwami — radio buttons z miniaturą specy
  - **Checkboxy dodatków**: Rozszerzona sieć (X) — z opisem co konkretnie dodaje per linia; Backup automatyczny (A) — ukryte dla Gold/Orange, disabled dla baz w Biały/Niebieski (wliczone od L)
  - **Toggle okresu**: Miesięcznie / Rocznie z wyświetleniem oszczędności (np. "Oszczędzasz €90 (42%)")
  - **Toggle waluty**: EUR / PLN (zapamiętywany w localStorage)
  - **Cena finalna + przycisk "Zamów"** → POST `/api/checkout/create` → redirect do Stripe
- Disabled jeśli kombinacja nie istnieje w cenniku (lookup po lookup table) — tooltip "Niedostępne w cenniku rocznym, wybierz miesięcznie"
- **Sekcja "Powered by"** — ujawnienie dostawcy (nie ukrywamy)

### Stage 7.5 — Porównywarka MVP (1 PR)
**Business value:** Główny argument sprzedażowy — klient porównuje 6 linii w jednym widoku.

- Sekcja na `index.html` powyżej kart linii — **lista (NIE pełen interactive engine)**:
  - Tabela 6 kolumn (linie) × ~6 wierszy (kluczowe cechy: cena od, RAM bazowy, dysk, lokalizacja DC, backup, anti-DDoS)
  - Filtr ceny (slider max €/mc) — pokazuje/ukrywa kolumny
  - Filtr lokalizacji (checkboxy PL/DE/FR/...) — pokazuje/ukrywa kolumny
  - Filtr backup (toggle "wymagam")
  - Przy każdej kolumnie przycisk "Wybierz" → `/konfigurator?line={sku}`
- Cienki engine: client-side filter + render, dane z `/lib/pricing.js` (export `getAllLines()`)
- **Brak intelligent sugestii** ("Dla WordPress polecamy...") w MVP — to można dodać w przyszłości

### Stage 7.6 — Strona główna refresh (1 PR)
**Business value:** Spójna komunikacja modelu agregatora vs obecna "własna infra".

- `index.html`:
  - Hero: porównywarka + hasło *"Najlepsze VPS-y od europejskich dostawców. Jedna faktura, polski support."*
  - 6 kart linii produktowych pod porównywarką (każda z marketingową nazwą, "od €X/mc", `Powered by`, "Wybierz" → konfigurator)
  - Sekcja "Czemu my a nie bezpośrednio u dostawcy?" — 5 argumentów (D5/D6 decyzje wpływają na konkretną treść)
  - Usunąć wszystkie wzmianki "własna infrastruktura" w `i18n.jsx` i innych miejscach
- `regulamin.html`, `polityka-prywatnosci.html` — dodać sekcję o modelu reseller i ujawnić listę dostawców (RODO wymaga)
- `i18n.jsx` — przepisać dictionaries pod nowy model

### Stage 7.7 — Migracja do Live mode (1 PR + ręczne uruchomienie skryptu)
**Business value:** Realne wpłaty od pierwszego klienta.

- Pre-req: Stage 7.1-7.6 zmergowane i przetestowane w Test mode
- Krok 1: w Stripe Dashboard (Live) → utwórz webhook endpoint `https://vps4u.xyz/api/stripe/webhook` z eventami `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `charge.succeeded`
- Krok 2: w Vercel env vars: zmień `STRIPE_SECRET_KEY` na `sk_live_*`, `STRIPE_WEBHOOK_SECRET` na live `whsec_*`
- Krok 3: uruchom `STRIPE_LIVE=1 npm run setup:stripe` — tworzy Products/Prices w Live mode
- Krok 4: smoke test — wykonaj testową wpłatę z karty osobistej, sprawdź flow webhook → payments → admin dashboard, zrób refund
- Brak zmian w kodzie poza usunięciem Test mode badge'a w UI

---

## Schema bazy (Stage 7.1 referencja)

```sql
-- provider_info: meta-info o 6 dostawcach
create table provider_info (
  id serial primary key,
  code text unique not null check (code in ('hetzner_cx','hetzner_cpx','contabo','hostinger','ovh_value','ovh_comfort')),
  name text not null,
  country text not null,
  has_polish_panel boolean default false,
  notes text
);

-- product_lines: 6 linii marketingowych
create table product_lines (
  id serial primary key,
  sku_code text unique not null check (sku_code in ('gold','orange','czarny','bialy','czerwony','niebieski')),
  marketing_name text not null,
  provider_id int not null references provider_info(id),
  positioning text,
  backup_available boolean default true,
  backup_included_from text, -- null lub 'L' (od konfiguracji L wzwyż)
  anti_ddos_level text check (anti_ddos_level in ('basic','advanced','enterprise')),
  locations text[], -- array kodów DC: ['DE-FSN', 'PL-WAW', ...]
  active boolean default false -- włącz gdy dostawca zakontraktowany (decyzja D1)
);

-- product_configurations: lookup table cen (~96 wierszy)
create table product_configurations (
  id serial primary key,
  line_id int not null references product_lines(id),
  hardware_combo text not null, -- 'base', 'S', 'D', 'S+D', 'L', 'L+S', 'L+D', 'L+S+D'
  addons text[], -- []  lub ['X'], ['A'], ['X','A']
  -- Specy (różnią się per linia, więc denormalizowane)
  vcpu int not null,
  ram_gb int not null,
  disk_gb int not null,
  transfer_tb int,
  ipv4_count int default 1,
  port_mbps int,
  has_backup boolean default false,
  -- Ceny w 4 wariantach
  price_monthly_eur_cents int not null,
  price_monthly_pln_grosze int not null,
  price_yearly_eur_cents int, -- nullable jeśli yearly niedostępne
  price_yearly_pln_grosze int, -- nullable
  -- Stripe wpinane po setupie
  stripe_product_id text,
  stripe_price_monthly_eur_id text,
  stripe_price_monthly_pln_id text,
  stripe_price_yearly_eur_id text,
  stripe_price_yearly_pln_id text,
  -- Operacyjne
  cost_price_monthly_eur_cents int, -- cena u dostawcy (do markupu)
  markup_percent int,
  active boolean default false,
  unique (line_id, hardware_combo, addons)
);

create index idx_configs_line on product_configurations(line_id);
create index idx_configs_active on product_configurations(active);

-- RLS — wszyscy mogą czytać aktywne produkty (dla porównywarki public)
alter table provider_info enable row level security;
alter table product_lines enable row level security;
alter table product_configurations enable row level security;

create policy "Public read providers" on provider_info for select using (true);
create policy "Public read active lines" on product_lines for select using (active = true);
create policy "Public read active configs" on product_configurations for select using (active = true);
create policy "Admin all configs" on product_configurations for all using (public.current_user_is_admin());
-- analogiczne admin policies dla provider_info, product_lines
```

## Critical files

**Nowe:**
- `db/migrations/008_products.sql` (Stage 7.1)
- `lib/pricing.js` + `tests/unit/pricing.test.js` (Stage 7.1)
- `scripts/setup-stripe.js` (Stage 7.2)
- `api/checkout/create.js` + `tests/unit/checkout-validate.test.js` (Stage 7.3)
- `konfigurator.html` (Stage 7.4)

**Modyfikowane:**
- `index.html` — hero + porównywarka + line cards (Stage 7.5 + 7.6)
- `i18n.jsx` — usunięty stary cennik, nowe teksty (Stage 7.6)
- `rejestracja.html` — redirect na `/konfigurator` lub usunięcie (Stage 7.6)
- `regulamin.html`, `polityka-prywatnosci.html` — sekcja reseller + lista dostawców (Stage 7.6)
- `docs/payments.md`, `docs/architecture.md`, `docs/database.md` — update modelu

## Verification (E2E po każdym stage)

- **Stage 7.1:** `select * from product_lines where active=true` zwraca linie z testu, `lookupPrice` ma testy zielone
- **Stage 7.2:** `npm run setup:stripe` w Test mode tworzy oczekiwaną liczbę Products/Prices, `select stripe_product_id from product_configurations where active=true` = wszystkie wypełnione
- **Stage 7.3:** POST do `/api/checkout/create` z poprawnym payloadem zwraca URL Stripe; z błędnym payloadem → 400
- **Stage 7.4:** Lokalnie / preview: konfigurator pokazuje wszystkie opcje, disabled dla niedozwolonych, "Zamów" prowadzi do Stripe Test (test card 4242)
- **Stage 7.5:** Porównywarka filtruje 6 linii, link "Wybierz" prowadzi do konfiguratora
- **Stage 7.6:** Smoke E2E: index → klik linii → konfigurator → klik "Zamów" → Stripe Test → success URL → admin dashboard pokazuje nową płatność
- **Stage 7.7:** Live test z prawdziwą kartą za €15, refund po sukcesie

## Out of scope (do późniejszego rozważenia)

- **Pełen interactive konfigurator z briefu** (slidery RAM/CPU/dysk) — MVP ma radio buttons z gotowych kombinacji, łatwiejsze do utrzymania
- **Intelligent sugestie** ("Dla WordPress polecamy...") — wymaga taksonomii use case'ów
- **Pełna automatyzacja waloryzacji cen** przy zmianach kosztu dostawcy — na MVP zmiany ręczne w DB + re-run setup script
- **Stripe Pricing Tables widget** (Stripe-hosted UI) — bardziej elastyczne ale mniej spójne z brandem
- **Roczny rabat per linia konfigurowalny** — MVP ma sztywne ceny z briefu
- **Multi-region awareness** — wybór DC podczas zakupu (na MVP klient dostaje default per linia)
- **Pełny RGPD/DPA flow** z podpisaniem online — MVP ma PDF do download w karcie produktu

## Decyzje, których MVP NIE robi (świadomie)

- **Nie zaczynamy z aktywacją wszystkich 6 dostawców** — D1 musi dać konkretną listę (rekomenduję start z 2-3: np. Hetzner CPX + Hostinger + OVH Value). Reszta linii w DB ale `active=false`, w UI ukryte lub "wkrótce"
- **Brak SLA na piśmie od nas** (decyzja właściciela) — refakturujemy SLA dostawcy w karcie produktu (D4 propozycja: soft komunikacja)
- **Brak telefonu w supporcie** — email/chat tylko (D4)
- **Migracja: w cenie** (D5 propozycja) — to mocny argument vs bezpośrednio u dostawcy, opłaca się dać darmowe

## Estymata czasu (najgrubsze przybliżenie)

| Stage | Estymata | Zależność |
|---|---|---|
| 7.1 schema | 2-3h | po decyzjach D1, D7 |
| 7.2 setup script | 2-3h | po 7.1 + decyzji D3 |
| 7.3 checkout endpoint | 2h | po 7.2 |
| 7.4 konfigurator UI | 4-6h | po 7.3 |
| 7.5 porównywarka | 3-4h | równolegle z 7.4 |
| 7.6 strona główna refresh | 3-4h | po 7.5 |
| 7.7 Live migration | 1h + smoke test | po wszystkim |
| **Razem** | **17-23h pracy** | ~3-4 dni roboczych |
