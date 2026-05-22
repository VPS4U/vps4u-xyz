# Plan: Admin Quarterly Revenue Cap Tracking

## Context

Właściciel firmy chce kontrolować, ile w danym kwartale wpłacili łącznie klienci, żeby **nie przekroczyć samodzielnie ustalonego progu** (wewnętrzny cap, nie regulacyjny). Po przekroczeniu progów **50% / 80% / 100%** ma dostać email przez Brevo. Brak auto-blokowania — tylko alerty.

**Waluty:** cap w **PLN** (waluta księgowa właściciela). Wpłaty w EUR lub PLN (Stripe + Revolut Pro obsługują obie). EUR przeliczane na PLN po kursie średnim NBP z dnia płatności (tabela A), kurs zapisywany w wierszu płatności (audytowalne, niezmienne historycznie).

**Procesory płatności:** Stripe (start) + Revolut Pro (via email auto-forward parser, drugi etap). Schema od początku ma `provider` żeby uniknąć migracji.

Feature jest rozszerzeniem ścieżki Stripe (jeszcze nie zaimplementowanej w kodzie). Daje trzy benefity: (1) lokalne źródło prawdy o płatnościach, (2) admin panel z bieżącym kwartałem, (3) audytowalny zapis FX rate dla księgowej.

---

## QA Strategy (do zatwierdzenia w pierwszej kolejności)

### Filozofia: TDD jako reguła, nie sugestia

**Każda zmiana funkcjonalna wymaga testów napisanych PRZED kodem.** PR bez testów dla nowej logiki nie przechodzi CI. Wyjątki (czysty markup HTML, zmiany w docs, zmiany config) wymagają etykiety `no-test-needed` na PR-ze, którą może nadać tylko właściciel projektu.

**Cykl pracy nad zmianą funkcjonalną:**
1. Napisz test failujący (red)
2. Napisz minimum kodu żeby test przeszedł (green)
3. Refactor jeśli potrzeba (zielony cały czas)
4. Update docs
5. PR

### Stack testowy

- **Vitest** — runner, lekki, zero-config, Node.js native ESM
- **@testing-library/dom** — dla testów DOM (panel.html, admin.html)
- **MSW (Mock Service Worker)** — mock zewnętrznych API (Stripe, NBP, Brevo) w testach
- **Supabase local stack** (`supabase start`) — prawdziwa baza Postgres do testów integracyjnych, brak mocków DB

**Typy testów (piramida):**
- `tests/unit/` — funkcje czyste (FX conversion, threshold calc, email parser regex)
- `tests/integration/` — endpointy `/api/*` przeciwko lokalnej Supabase + zamockowanym Stripe/Brevo
- `tests/e2e/` — Playwright dla 2 critical paths (logowanie magic-link, admin sees current quarter)

**Cele pokrycia:**
- `lib/*.js` → 80%+ line coverage (helpery)
- `api/*.js` → integration test per endpoint, minimum happy path + 1 error path
- `*.html` (JSX inline) → snapshot test renderowania + smoke test interakcji

### Dokumentacja: gate przy merge

**Każdy PR musi zaktualizować co najmniej:**
- `docs/CHANGELOG.md` — zawsze, jeden wpis per PR z numerem PR, datą, podsumowaniem
- `docs/<relevant>.md` — jeśli zmiana dotyka obszaru (np. zmiana DB → `database.md`, nowy endpoint → `payments.md` lub nowy doc)

**Wersjonowanie dokumentacji:**
- Każdy plik `docs/*.md` zaczyna się od bloku frontmatter:
  ```
  ---
  last_updated: 2026-05-22
  last_pr: 7
  ---
  ```
- `docs/CHANGELOG.md` to single source of truth historii zmian
- Format wpisów CHANGELOG: `## [PR #N] — YYYY-MM-DD` + bullet list zmian

### GitHub Actions jako twardy gate (zabezpieczenie przed pominięciem)

Pliki: `.github/workflows/pr-checks.yml`, `.github/workflows/docs-check.yml`

Wszystkie poniższe checks **required** na branch protection `main` (ustawienie GitHub Settings, nie da się pominąć przez nikogo bez admina repo):

1. **`tests`** — `npm test` → wszystkie testy zielone
2. **`lint`** — `npm run lint` (ESLint + Prettier)
3. **`docs-required`** — custom action sprawdza:
   - Jeśli w PR są zmiany w `**/*.{js,jsx,ts,tsx,html,sql}` → MUSI być też zmiana w `docs/**` lub `docs/CHANGELOG.md`
   - Wyjątek: PR ma label `no-docs-needed` (nadać może tylko owner)
4. **`migration-applied`** — jeśli PR zawiera nowy plik w `db/migrations/`, opis PR musi zawierać checkbox `- [x] Migracja zaaplikowana w Supabase Production` (sprawdzane przez action parsujący body PR-a)
5. **`changelog-updated`** — zawsze wymagane: `docs/CHANGELOG.md` zmienione w PR
6. **`branch-naming`** — branch musi pasować do `(feat|fix|chore|docs|test)/.+`

**Konsekwencja:** agent (włącznie ze mną) nie może zmergeować PR-a bez:
- Zielonych testów
- Zaktualizowanej dokumentacji
- Wpisu w CHANGELOG
- (Dla migracji) potwierdzenia że uruchomiona w prod

Branch protection wymusi to nawet jeśli ktoś użyje admina lub force-push.

### Pre-commit hooks (lokalna pierwsza linia obrony)

Plik: `.husky/pre-commit` (Husky 9)

Lokalnie przed `git commit`:
- Format check (Prettier)
- Lint (ESLint)
- Test affected files (vitest --changed)

Nie zastępują GitHub Actions (lokalne hooki można obejść `--no-verify`), ale dają szybki feedback przed pushem.

### Bootstrap QA (jednorazowo)

Pierwszy PR przed jakąkolwiek implementacją feature'u to **„QA scaffolding"**:
- `package.json` z deps testowymi
- `vitest.config.js`, `eslint.config.js`, `.prettierrc`
- `.husky/` + setup script
- `.github/workflows/pr-checks.yml`, `docs-check.yml`
- `docs/CHANGELOG.md` z początkowym wpisem
- Branch protection rules włączone w repo settings
- `docs/qa.md` (nowy doc) z opisem powyższej strategii

Dopiero po merge tego PR-a zaczynamy Stage 1 feature'u.

---

## Approach (etapy)

### Stage 0 — QA Scaffolding (1 PR)

**Business value:** zero user-facing, ale **konieczne** — bez tego cała dalsza praca nie ma gate'ów jakości. Bez Stage 0 ryzykujemy że doraźne zmiany rozjadą się z dokumentacją w 2 tygodnie.

**Zakres:**
- `package.json` + `vitest`, `eslint`, `prettier`, `husky`, `@testing-library/dom`, `msw`, `playwright`
- Configs: `vitest.config.js`, `eslint.config.js`, `.prettierrc`, `playwright.config.ts`
- `.husky/pre-commit`
- `.github/workflows/pr-checks.yml` (test+lint+coverage)
- `.github/workflows/docs-check.yml` (custom action wymuszający docs)
- `docs/CHANGELOG.md`, `docs/qa.md`
- Branch protection rules (manual w GitHub Settings — przez właściciela, ja podam dokładną listę checks do zaznaczenia)
- Przykładowy test smoke (`tests/unit/example.test.js`) żeby workflow przeszedł

**Acceptance:** CI zielone, PR otwierający lub modyfikujący kod bez aktualizacji docs jest **automatycznie blokowany**.

---

### Stage 1 — Helpery + foundations (1 PR, after Stage 0)

**Business value:** zero user-facing. Przygotowanie bloków pod webhook (Stage 2) — wcześniej napisane testowalnie w izolacji.

**Zakres:**
- `lib/supabase-admin.js` — klient z `service_role` (omija RLS)
- `lib/fx.js` — `getEurPlnRate(date)` z NBP API + fallback na ostatnią tabelę
- `lib/brevo.js` — `sendBrevoEmail({to, subject, htmlContent})`
- Pełne testy unit dla każdego helpera (mockowane fetch przez MSW)
- Update `docs/architecture.md` (sekcja "Backend helpery")

**TDD:** napisz `tests/unit/fx.test.js`, `brevo.test.js`, `supabase-admin.test.js` PIERWSZE z scenariuszami (kurs OK, kurs 404 → fallback, kurs PLN→PLN = 1.0, Brevo 200, Brevo 400 → throw, etc.), POTEM kod helperów.

**Acceptance:** wszystkie helpery >85% coverage, używane w Stage 2.

---

### Stage 2 — Schema bazy + Stripe webhook MVP (1 PR)

**Business value (mierzalne):** każda płatność klienta zaczyna się odkładać lokalnie. Właściciel może wykonać SQL query `select sum(amount_pln_grosze)/100 from payments where quarter='Q2-2026'` i zobaczyć ile zarobił. Niezależne od panelu Stripe (np. jak Stripe ma incydent — Ty dalej wiesz ile masz).

**Zakres:**
- `db/migrations/003_admin_and_payments.sql` (tylko `payments` table + provider scaffolding, BEZ admin_settings/alert_log jeszcze)
- `api/stripe/webhook.js`:
  - Sygnatura webhook'a
  - `checkout.session.completed` → user/profile/subscription
  - `invoice.payment_succeeded`/`charge.succeeded` → insert do `payments` z FX
  - Idempotencja przez `unique(provider, external_charge_id)`
- Integration testy webhook'a (Stripe test events przez Stripe CLI lub Stripe Node SDK)
- Env vars w Vercelu: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_KEY`
- Update `docs/payments.md`, `docs/database.md`

**Pre-req po Twojej stronie:** konto Stripe w trybie Test Mode, 1 produkt + 1 Payment Link, webhook endpoint zarejestrowany w Stripe Dashboard.

**Acceptance:** wykonanie testowej płatności w Stripe Test Mode powoduje pojawienie się wiersza w `payments` z poprawnym `amount_pln_grosze`.

---

### Stage 3 — Admin role + read-only dashboard (1 PR)

**Business value:** właściciel **w przeglądarce** widzi ile zarobił w bieżącym kwartale (PLN). Brak konieczności logowania do Stripe ani uruchamiania SQL. Próg jeszcze nie konfigurowalny — hardcoded w SQL na razie.

**Zakres:**
- `db/migrations/004_admin_role.sql` — `profiles.is_admin` + RLS policies admin-read-all
- `admin.html` — guard + dashboard:
  - Current quarter card (PLN total, # płatności, pasek progress przy hardcoded capie 50000 PLN)
  - Last 4 quarters table
  - Recent 20 payments list
- Link "Admin" w `panel.html` widoczny gdy `is_admin=true`
- E2E test (Playwright): admin zalogowany widzi `/admin`, zwykły user widzi redirect

**Acceptance:** zalogowany admin otwiera `/admin`, widzi prawdziwe dane z `payments` (z poprzedniego stage'u).

---

### Stage 4 — admin_settings + threshold alerts (1 PR)

**Business value:** **właściwy alert email** — gdy nowa płatność powoduje przekroczenie 50/80/100% capa, właściciel dostaje maila z Brevo. To realizuje główny cel projektu.

**Zakres:**
- `db/migrations/005_admin_settings_and_alerts.sql` — `admin_settings` (KV), `alert_log` (unique constraint)
- `lib/admin-alerts.js` — `checkAndAlertThresholds()` używana w webhook'u Stripe
- Update `api/stripe/webhook.js` — wywołuje `checkAndAlertThresholds()` po insertcie do `payments`
- Integration test: insert powodujący przekroczenie progu → mock Brevo dostaje request → `alert_log` ma wiersz
- Test idempotencji: drugi insert nad tym samym progiem → mock Brevo NIE dostaje requestu (already alerted)

**Pre-req:** świeży Brevo API key w Vercel env (`BREVO_API_KEY`), zweryfikowana domena `vps4u.xyz` w Brevo (DKIM zielone).

**Acceptance:** test E2E: ustaw cap 10 PLN, wykonaj test payment €5 (przeliczone ~22 PLN) → mail przychodzi w skrzynce.

---

### Stage 5 — Admin settings UI (1 PR)

**Business value:** właściciel **sam** zmienia cap, progi, email odbiorczy — bez ingerencji programisty. Self-service.

**Zakres:**
- `admin.html` rozszerzone o formularz Settings:
  - Edycja `quarterly_cap.grosze` + waluty (input w PLN, save w groszach)
  - Multi-select progów (25, 50, 75, 80, 90, 100)
  - Email odbiorczy alertów
- Test alert button → wysyła testowy mail pomijając `alert_log`
- E2E test: admin zmienia cap → wykonanie testowej wpłaty → alert dla nowego capa

**Acceptance:** wszystkie pola edytowalne z UI, zapisują się do `admin_settings`, wpływają na threshold check natychmiast (bez deploy'a).

---

### Stage 6 — Revolut Pro email parser (1 PR, opcjonalny)

**Business value:** drugi kanał płatności (Revolut Business jeśli klienci wolą polskie konto). Cap i alerty obejmują też te wpłaty.

**Zakres:** patrz "Out of scope" niżej — decyzja o backendzie inbound (CloudMailin / IMAP polling / Cloudflare Email) podejmowana w momencie startu Stage 6.

**Pre-req:** konto Revolut Business aktywne, regla auto-forward maili o wpłatach na adres inbound.

---

## Schema bazy (referencja dla Stage 2 + 4)

### `public.payments` (Stage 2)
- `id uuid pk default gen_random_uuid()`
- `provider text not null check (provider in ('stripe', 'revolut'))`
- `external_charge_id text not null`
- `user_id uuid not null references profiles(id) on delete restrict`
- `subscription_id uuid references subscriptions(id) on delete set null`
- `amount_cents bigint not null` — w oryginalnej walucie
- `currency text not null` — lower case, `eur` | `pln`
- `amount_pln_grosze bigint not null` — denormalizowane przeliczenie
- `fx_rate numeric(10,4) not null`
- `fx_source text not null default 'nbp_a'` — `nbp_a` | `manual` | `same`
- `fx_table_date date`
- `charged_at timestamptz not null`
- `quarter text generated always as ('Q' || extract(quarter from charged_at) || '-' || extract(year from charged_at)) stored`
- `created_at timestamptz default now()`
- `unique(provider, external_charge_id)`
- Indeks na `quarter`

### `profiles.is_admin` (Stage 3)
- `boolean not null default false`
- Nowe RLS policies admin-read-all (uses `(select is_admin from profiles where id = auth.uid())`)

### `public.admin_settings` (Stage 4)
- `key text pk`, `value jsonb not null`, `updated_at timestamptz default now()`
- Seed: `quarterly_cap` = `{"grosze": 5000000, "currency": "pln"}`, `alert_thresholds_pct` = `[50, 80, 100]`, `alert_email` = `"vps4u.xyz@gmail.com"`

### `public.alert_log` (Stage 4)
- `id uuid pk`, `quarter text not null`, `threshold_pct int not null`, `fired_at timestamptz default now()`
- `unique(quarter, threshold_pct)` — gwarancja jednokrotności alertu

### RLS (wszystkie nowe tabele)
- Włączone, brak policies dla `anon`/`authenticated` oprócz admina
- Admin sees-all przez `(select is_admin from profiles where id = auth.uid())`

---

## Critical files

**Stage 0 (scaffolding):**
- `package.json`, `vitest.config.js`, `eslint.config.js`, `.prettierrc`, `playwright.config.ts`
- `.husky/pre-commit`
- `.github/workflows/pr-checks.yml`, `.github/workflows/docs-check.yml`
- `docs/CHANGELOG.md`, `docs/qa.md`

**Stage 1 (helpery):**
- `lib/supabase-admin.js`, `lib/fx.js`, `lib/brevo.js`
- `tests/unit/{fx,brevo,supabase-admin}.test.js`

**Stage 2 (webhook):**
- `db/migrations/003_payments.sql`
- `api/stripe/webhook.js`
- `tests/integration/stripe-webhook.test.js`

**Stage 3 (admin dashboard read-only):**
- `db/migrations/004_admin_role.sql`
- `admin.html`
- `panel.html` (modyfikacja: warunkowy link)
- `tests/e2e/admin-access.spec.ts`

**Stage 4 (alerts):**
- `db/migrations/005_admin_settings_and_alerts.sql`
- `lib/admin-alerts.js`
- `api/stripe/webhook.js` (modyfikacja: wywołanie alerts po insertcie)
- `tests/integration/threshold-alerts.test.js`

**Stage 5 (settings UI):**
- `admin.html` (rozszerzenie)
- `api/admin/settings.js` (write endpoint, admin-only)
- `tests/e2e/admin-settings.spec.ts`

**Wzorce do reuse:**
- `lib/supabase.js:14` — pattern klienta
- `panel.html:84-89` — session check + redirect
- `db/migrations/001_initial.sql:50-58` — RLS policy template
- `db/migrations/002_harden_functions.sql` — security hardening pattern

---

## Verification (end-to-end per stage)

Każdy stage ma własne acceptance criteria w sekcji etapu. Wspólne:

1. **Po każdym merge:** Vercel deploy zielony, sprawdź preview URL
2. **Po Stage 2:** SQL `select count(*) from payments` rośnie z każdą testową płatnością Stripe
3. **Po Stage 3:** otwórz `/admin` w prywatnym oknie → guard → zaloguj jako admin → widzisz dane
4. **Po Stage 4:** test payment kierowany na cap 10 PLN → mail w skrzynce w <30s
5. **Po Stage 5:** zmień cap przez UI → wykonaj test payment → nowy mail leci z nowym capem

**Audyt FX (kwartalnie):**
```sql
select fx_table_date, fx_rate, count(*)
from payments
where currency = 'eur' and quarter = 'Q2-2026'
group by 1, 2 order by 1;
```
Powinno pokazać kurs NBP per dzień płatności — zgodne z księgowością.

---

## Out of scope

- **Refundy / chargebacks** — dorobimy w Stage 7 (insert ujemnego wiersza albo flaga `is_refund`)
- **Multi-currency cap** — na razie tylko PLN; jeśli kiedyś inne — `admin_settings.value` jest jsonb, łatwo rozszerzyć
- **Eksport CSV** historii — przyda się dla księgowej, Stage 8
- **Cache kursów NBP** — przy >100 płatności/dzień; na razie fetch per płatność
- **Cap + alert kwotowy** (oprócz %) — łatwy add-on do `admin_settings`
- **Per-product cap** — globalny wystarczy na start
