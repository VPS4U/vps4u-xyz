# Changelog

Każdy merge'owany PR ma tu wpis. Format: `## [PR #N] — YYYY-MM-DD` + bullet list zmian. CI wymusza aktualizację tego pliku w każdym PR (poza tymi z labelem `no-docs-needed`).

---

## [PR #33] — 2026-05-25

- **Stage 7.6**: refresh strony głównej — model agregatora widoczny w UI + kolory linii (klienci znają je z poprzedniego brand'u)
- `lib/pricing.js` — `getLineColor(sku)` zwraca `{hex, label, textOnColor}` dla 6 linii (Gold/Orange/Czarny/Biały/Czerwony/Niebieski). 2 nowe testy
- `i18n.jsx` — sekcja `pricing` przepisana z 6 planów Micro-Beast → **6 linii dostawców** w PL i EN; nowe pole `sku`, `provider`, `url`; cena oznaczona "od €X" (najtańsza konfiguracja Starter w linii)
- `parts-2.jsx` Pricing component — render `LINE_COLORS_INLINE` swatch (14×14px) + polski label koloru ("Linia Niebieski") + border-top 6px w kolorze; `Powered by <provider>` pod nazwą; CTA prowadzi do `konfigurator.html?line={sku}` zamiast martwego `buy.stripe.com/REPLACE_*`. Pod kartami link "Porównaj wszystkie linie"
- `parts-1.jsx` Nav — link `Porównaj` zamiast `VPS`, primary CTA `Konfiguruj` → `konfigurator.html` (zamiast `rejestracja.html`)
- `konfigurator.html` — color stripe nad nagłówkiem wybranej linii + swatch w line picker cards
- `porownaj.html` — nagłówki kolumn w tabeli z kolorem linii + label "Linia X"
- Total: **107 unit + 11 E2E** zielone

## [PR #32] — 2026-05-25

- **Stage 7.5**: porównywarka MVP (`/porownaj`)
- `porownaj.html` — tabela 6 linii (kolumny) × 9 cech (wiersze): cena od, CPU/RAM/dysk bazowy, transfer, lokalizacje, backup, anti-DDoS, polski support
- Filtry interaktywne (vanilla JS, bez reload):
  - **Cena max** — slider 10-40 €/mc (ukrywa kolumny droższe)
  - **Lokalizacja** — checkboxy z krajów (PL/DE/FR/UK/NL/LT/FI/EU) wygenerowane dynamicznie z DB
  - **Backup wymagany** — toggle
  - "Reset filtrów"
- Każda kolumna ma w stopce CTA "Wybierz →" do `/konfigurator?line={sku}`
- Dane fetchowane z Supabase z `product_lines` + min cena per linia (z `product_configurations`)
- Link z `konfigurator.html` line picker → `/porownaj`
- Smoke E2E rozszerzony (11/11 zielone)

## [PR #31] — 2026-05-25

- `docs/email-templates/` — polskie szablony HTML dla Supabase Auth (do skopiowania w UI)
  - `magic-link.html` — "🔑 Twój link logowania do VPS4U" (używany przy każdym logowaniu)
  - `change-email.html` — "Potwierdź zmianę adresu email w VPS4U" (gdy user zmieni)
  - `invite-user.html` — "Twoje konto w VPS4U jest gotowe" (gdy admin doda usera, np. webhook Stripe)
- Style: inline CSS, brand zgodny ze stroną (czarne tło buttona, akcent pomarańczowy, Archivo Black), kompatybilne z mailowymi klientami
- Następny krok dla operatora: skopiować zawartość plików do Supabase Dashboard → Authentication → Email Templates

## [PR #30] — 2026-05-25

- `docs/deployment.md` — sekcja "Stable preview (`preview.vps4u.xyz`)"
- Setup: branch `preview` w repo, Vercel domain assignment do tego brancha, Cloudflare CNAME
- Workflow "luźny" — operator mówi "wrzuć PR #X na preview", agent robi `reset --hard origin/main && merge origin/<branch> && push origin preview`
- Auth zachowany (Vercel Deployment Protection), shareable links przez Vercel Dashboard / MCP

## [PR #29] — 2026-05-25

- **Stage 7.4**: konfigurator UI + dziękujemy
- `konfigurator.html` (URL `/konfigurator`):
  - Bez parametru → lista 6 linii (cards z marketingową nazwą, "Powered by ...", cena "od", positioning)
  - Z `?line=czarny` → konfigurator: nagłówek linii + 8 radio buttonów hardware (Starter/Pro/...) + checkboxy addonów X i A (A ukryty dla Gold/Orange) + toggle okresu (Miesięcznie/Rocznie) + toggle waluty (EUR/PLN zapamiętany w localStorage)
  - Cena finalna na żywo z lookup table (client-side z DB Supabase)
  - Toggle rocznie pokazuje oszczędność % vs 12× miesięcznie
  - Przycisk "Zamów" → POST `/api/checkout/create` → redirect na Stripe Checkout URL
  - Disabled gdy kombinacja niedostępna w cenniku rocznym (np. yearly + addon) lub brak `stripe_price_id` w DB
- `dziekujemy.html` — strona success_url po Stripe Checkout (✓ + linki do panelu)
- Smoke E2E rozszerzony o `konfigurator` i `dziekujemy` (10/10 zielone)

## [PR #28] — 2026-05-25

- **Stage 7.3**: backend endpoint `/api/checkout/create` (z planu aggregator-reseller-mvp)
- `lib/checkout.js` — pure walidator: `validateCheckoutPayload({line_sku, hardware_combo, addons, period, currency})` + `stripePriceColumnFor(period, currency)`. Normalizuje, sortuje addons (idempotent lookup)
- `api/checkout/create.js` — public POST endpoint (bez auth, Stripe Checkout sam zbierze email):
  - Walidacja payloadu
  - Lookup `stripe_price_id` z `product_configurations` po `(line_sku, hardware_combo, addons)`
  - `stripe.checkout.sessions.create({mode:'subscription', line_items, automatic_tax, customer_creation, billing_address})`
  - Success URL: `/dziekujemy?session_id={CHECKOUT_SESSION_ID}`
  - Metadata na session: line/hardware/addons/period/currency dla audytu
- Stripe Tax `automatic_tax: enabled` — EU VAT robi się automatycznie
- 10 nowych testów walidatora, total **105 unit + 8 E2E** zielone

## [PR #27] — 2026-05-25

- `admin.html` — nowa sekcja "Stripe — stan synchronizacji"
- Pokazuje na żywo z DB (admin RLS): products synced / total, monthly EUR/PLN, yearly EUR/PLN (z `expected` jako dzielnik bo niektóre combo nie mają yearly), tabela per linia z postępem %
- Przycisk "Odśwież" + auto-reload po sukcesie setup
- Pomaga zobaczyć ile jeszcze brakuje przy timeout'ach Vercel (po każdym kliknięciu "Wykonaj setup" widać progres)
- Brak nowych endpointów ani migracji — pure frontend query

## [PR #26] — 2026-05-24

- **Stage 7.2**: Stripe setup — tworzy Products + Prices dla wszystkich aktywnych konfiguracji
- **2 sposoby uruchomienia**: endpoint admin (rekomendowany, z Vercel env) lub CLI script (lokalny `.env.local`)
- `lib/stripe-products.js` — pure helpers do budowy Stripe data:
  - `makeInternalSku(config)` — `czarny-L+S+D-X` (sortowane addons → idempotent)
  - `buildProductData(config)` — name, description, metadata.internal_sku do lookupu
  - `buildPriceData(config, period, currency)` — Stripe Price z `lookup_key`
  - `listPriceVariants(config)` — 4 warianty (monthly×eur/pln + yearly×eur/pln, pomija null)
- `lib/stripe-setup.js` — orchestrator `syncAllConfigurations({stripe, supabase, dryRun})` — DI pattern, używany przez endpoint i script
- **`api/admin/setup-stripe.js`** — POST endpoint:
  - Auth: `requireAdmin` (JWT) + `requireEnv` (Stripe + Supabase creds z Vercel)
  - Body: `{dry_run: bool}`
  - Returns: `{ok, mode: 'test'|'live', dry_run, products_created, products_skipped, prices_created, prices_skipped}`
- `scripts/setup-stripe.js` — thin CLI wrapper (alternatywa lokalnego uruchomienia, env z `.env.local`)
- `package.json` — `npm run setup:stripe` i `setup:stripe:dry` dla CLI mode
- `eslint.config.js` — dodano `scripts/**/*.js` do lintingu
- `admin.html` — sekcja "Setup Stripe" z 2 przyciskami: Dry-run + Wykonaj setup (z confirm dialog) + JSON output
- 16 nowych unit testów (11 stripe-products + 5 stripe-setup), total **95 unit + 8 E2E** zielone

## [PR #25] — 2026-05-24

- **Stage 7.1**: schema produktów dla modelu agregatora (z planu aggregator-reseller-mvp)
- Migracja 008: 3 tabele:
  - `provider_info` — 6 dostawców (Hetzner CX/CPX, Contabo, Hostinger, OVH Value/Comfort) + RLS public read
  - `product_lines` — 6 linii (Gold/Orange/Czarny/Biały/Czerwony/Niebieski) z marketingowymi nazwami, mapowane na dostawców, `active=true`
  - `product_configurations` — **90 aktywnych konfiguracji** (16 combo × 6 linii − 6 nieaktywnych A dla Gold/Orange) z cennikiem z briefu sekcji 7-8
- PLN ceny = EUR × 4.30 round (do późniejszej korekty admina)
- Stripe Price ID columns (puste na razie, wypełnione przez setup script w Stage 7.2)
- `scripts/_gen_seed_configurations.py` — deterministyczny generator seed SQL z briefu
- `lib/pricing.js` — pure helpery walidacji: `normalizeHardwareCombo`, `isValidAddon/Currency/Period`, `formatHardwareLabel` (mapping na marketingowe nazwy z briefu), `formatPricePln/Eur`
- 13 nowych testów, total **79 unit + 8 E2E**

## [PR #24] — 2026-05-24

- Plan: aggregator/reseller MVP — przerobienie strony pod model agregatora 6 dostawców (z `vps-brief.md`), zachowując pełen cennik
- 7 etapów (schema → setup script → checkout → konfigurator → porównywarka → strona główna → live migration)
- Architektura Stripe: pre-created Products + Prices via setup script (~96 SKU × 4 wariantów = ~384 Stripe Prices), checkout dynamiczny przez `Stripe.checkout.sessions.create`
- Hybrydowa marka (VPS4U front + ujawnienie dostawcy w karcie + regulaminie)
- Drop: SLA %, sztywne czasy supportu (właściciel nie chce zobowiązań)
- Wymaga rozstrzygnięć właściciela (D1-D9) — kluczowe D1 (zakontraktowani dostawcy) i D3 (nazwy marketingowe)

## [PR #23] — 2026-05-24

- Chore: Actions storage cleanup — usunięty Playwright cache step + retencja `playwright-report` artifact 7→1 dni
- Powód: 0.5GB Actions storage na free tier wyczerpane (głównie przez cache Chromium ~150MB)
- Konsekwencja: każdy run `e2e` instaluje Chromium od zera (+~30s); nie cache'ujemy = nie zajmujemy storage

## [PR #22] — 2026-05-24

- **Stage 6.3**: monthly cap — UI (część 3/3 z planu monthly-cap-tracking)
- `lib/admin-stats.js` — `groupByMonth(payments)` (analog do `groupByQuarter`), refactor do wspólnego `groupByKey`. 2 nowe testy
- `admin.html`:
  - Sekcja **"Bieżący miesiąc"** (karta z capem, sumą, % barem) — analogiczna do kwartału
  - Tabela **"Ostatnie 6 miesięcy"** — historia
  - Settings form rozszerzony o pole `monthly_cap` (input PLN) + 6 checkboxów monthly thresholds — w osobnym `<fieldset>`
  - Submit wysyła oba poziomy (`quarterly_cap` + `monthly_cap`)
  - Helper `renderCard()` deduplikuje boilerplate dla obu kart
- Title strony: "Admin · cap monthly + quarterly"
- Total: **66 unit + 8 E2E** zielone
- **Plan monthly-cap-tracking.md zrealizowany w pełni** (6.1 + 6.2 + 6.3)

## [PR #21] — 2026-05-23

- **Stage 6.2**: monthly cap — alert logic + wiring (część 2/3 z planu monthly-cap-tracking)
- `lib/admin-alerts.js` — refactor na **period-agnostic**: `checkAndAlertThresholds({periodKey, periodLabel, capGrosze, thresholdsPct, alertEmail, sumPeriodPlnGrosze, tryInsertAlertLog, sendAlertEmail})`. Działa identycznie dla quarter (`'Q2-2026'`) i month (`'2026-05'`)
- `api/stripe/webhook.js` — `afterPaymentInserted` jeden fetch settings, wywołuje `checkAndAlertThresholds` 2× (quarter + month). Jeśli `monthly_cap` brakuje w settings — pomija monthly check (backward-compat)
- `api/admin/test-alert.js` — wysyła 2 maile (kwartalny + miesięczny). Returns `{ok: true, sent_to, count}`
- Templates maili rozróżniają `periodLabel` ("kwartał"/"miesiąc") w tytule i body
- 7 testów `admin-alerts.test.js` przepisane pod nowe API (period-agnostic), + nowy test "działa dla okresu miesięcznego"
- Total: **64 unit + 8 E2E** zielone

## [PR #20] — 2026-05-23

- **Stage 6.1**: monthly cap — schema + helpery (część 1/3 z planu monthly-cap-tracking)
- Migracja 007:
  - `payments.month text not null` (format `YYYY-MM` UTC) — backfill istniejących wierszy
  - Trigger `compute_payment_period` (zastępuje `compute_payment_quarter`) — ustawia oba `quarter` i `month` naraz
  - Tabela `monthly_alert_log` z `unique(month, threshold_pct)` + indeks + RLS admin-read
  - Seed `admin_settings.monthly_cap` (20 000 PLN domyślnie) + `monthly_alert_thresholds_pct` ([50,80,100])
- `lib/admin-stats.js` — `computeMonthFromDate(date)` (analog do quarter)
- `lib/admin-settings-validate.js` — accept `monthly_cap` i `monthly_alert_thresholds_pct` (paired: oba lub żaden; backward-compat: payload bez monthly też przechodzi, używane przez stare UI do Stage 6.3)
- `api/admin/settings.js` — upsert dynamiczny z `Object.entries(payload)` zamiast hardcoded listy
- 8 nowych testów (3 dla `computeMonth` + 5 dla walidacji monthly), total **63 unit + 8 E2E**

## [PR #19] — 2026-05-23

- Plan: miesięczny cap (równoległy do kwartalnego) — `docs/plans/monthly-cap-tracking.md`
- Backlog w `docs/README.md` z dalszymi pomysłami (roczny cap, per-product, refundy, CSV export, rolling window, Slack notifications, Contabo provisioning, Revolut Pro)
- `lib/env.js` z `requireEnv(names[])` — wczesna walidacja env vars; brak/pusta wartość → czytelny 500 "Missing required environment variables: X. Check Vercel project Settings → Environment Variables" zamiast późniejszego nieoczywistego "Brevo API 401". 4 testy
- Wpięte w `/api/admin/settings`, `/api/admin/test-alert`, `/api/stripe/webhook`

## [PR #18] — 2026-05-23

- **Stage 5**: admin self-service settings + test alert button
- `lib/admin-settings-validate.js` — `validateSettingsPayload`: walidacja capa (positive int grosze, currency=pln), thresholds (int 1..100, dedup+sort), email (regex). 7 testów
- `lib/admin-auth.js` — `requireAdmin(token, supabaseConfig)`: weryfikacja JWT przez Supabase + check `is_admin`; `extractBearerToken(headers)`. 5 testów dla extractora
- `api/admin/settings.js` — PUT endpoint: auth (Bearer JWT) + validate + upsert do `admin_settings`
- `api/admin/test-alert.js` — POST: wysyła testowy mail przez Brevo z bieżącymi settings, pomija `alert_log`
- `admin.html` — nowy formularz Settings: cap PLN (input number), thresholds (6 checkboxów: 25/50/75/80/90/100), email; przycisk "Wyślij testowy mail"
- Usunięty hardcoded `QUARTERLY_CAP_GROSZE` — teraz ładowany z `admin_settings` przez Supabase
- Total: **51 unit** + 8 E2E zielone

## [PR #17] — 2026-05-22

- **Stage 4**: threshold alerts przez Brevo
- Migracja 006: `admin_settings` (KV: `quarterly_cap`, `alert_thresholds_pct`, `alert_email`) + `alert_log` z `unique(quarter, threshold_pct)`. RLS przez `current_user_is_admin()`. Seed defaultów (50 000 PLN cap, [50,80,100]%, email właściciela)
- `lib/admin-alerts.js` — `checkAndAlertThresholds(deps)`: pure logika, port-and-adapter pattern
- 6 nowych testów (`tests/unit/admin-alerts.test.js`): under, single threshold, multi-threshold, idempotency, error propagation, cap=0
- `lib/stripe-webhook.js` — extended: `insertPayment` zwraca bool, `afterPaymentInserted` wywoływane tylko dla nowych wpisów (nie duplikatów retry)
- 2 nowe testy webhook'a — afterPaymentInserted dla nowego insertu vs conflict
- `api/stripe/webhook.js` — wiring: po każdym nowym insertcie pobiera settings, sumuje kwartał, wstawia do alert_log, wysyła Brevo
- Total: **39 unit testów** + 8 E2E

## [PR #16] — 2026-05-22

- Stage 0c: Playwright E2E + nowy CI check `e2e`
- `playwright.config.js`: Chromium only, lokalny webServer `python3 -m http.server 4173`, baseURL `localhost:4173`, retries 2 w CI
- `tests/e2e/smoke.spec.js` — 5 testów weryfikujących że każda strona (index, panel, admin, logowanie, rejestracja) ładuje się bez pageerror i console.error. **Wykryłby SyntaxError z PR #14.**
- `tests/e2e/guards.spec.js` — 3 testy że `/panel` i `/admin` bez sesji przekierowują na `/logowanie` i nie wiszą na "Sprawdzanie sesji"
- Nowy job `e2e` w `.github/workflows/pr-checks.yml` z cache'em Playwright browsers
- Required status check `e2e` na branch protection (dodam po pierwszym przebiegu CI)
- `.gitignore` — `test-results/`, `playwright-report/`, `playwright/.cache/`

## [PR #15] — 2026-05-22

- Migracja 005: fix infinite recursion w admin RLS policies
- Poprzednie policies (PR #13) używały subquery `select is_admin from public.profiles where id = auth.uid()` w `using (...)` — sam subquery podlega RLS, więc Postgres szedł w nieskończoność i zwracał 500 dla wszystkich SELECT-ów na profiles/subscriptions/vps_instances/payments
- Naprawione przez SECURITY DEFINER funkcję `current_user_is_admin()` która omija RLS (ma `set search_path = ''` dla bezpieczeństwa, `stable` dla cache'owania per query)
- Policies przepisane na `using (public.current_user_is_admin())` — bez rekursji
- Zaaplikowane na prod przez Supabase MCP (zanim PR został otwarty — bo blokowało użytkownika w UI)

## [PR #14] — 2026-05-22

- Hotfix `panel.html`: `return;` na top-level `<script type="module">` to SyntaxError w ES module — cały skrypt nie kompilował się i strona stale wisiała na "Sprawdzanie sesji…"
- Zamieniony na `throw new Error('no session')` (jak w `admin.html`)
- Bug obecny od PR #4 (Stage 1); użytkownik nigdy nie zobaczył pełnej zawartości panelu

## [PR #13] — 2026-05-22

- Stage 3: rola adminowa + read-only dashboard `/admin`
- Migracja 004 (`db/migrations/004_admin_role.sql`): kolumna `profiles.is_admin boolean`, RLS policies admin-read-all dla `profiles`, `subscriptions`, `vps_instances`, `payments`
- Admin seeded ręcznie SQL'em (`update profiles set is_admin=true where email='vps4u.xyz@gmail.com'`)
- `lib/admin-stats.js` — czyste helpery: `computeQuarterFromDate`, `sumPaymentsPlnGrosze`, `groupByQuarter`, `formatPlnFromGrosze` (Intl pl-PL z NBSP)
- `admin.html` — read-only dashboard: bieżący kwartał (suma PLN, cap 50 000 hardcoded, % bar), historia 4 ostatnich kwartałów, ostatnie 20 płatności
- `panel.html` — warunkowy link "Admin" w nav widoczny gdy `profile.is_admin=true`
- 8 nowych testów (`tests/unit/admin-stats.test.js`) — wszystkie zielone; total 31 testów

## [PR #12] — 2026-05-22

- Webhook tolerancja na nieobsługiwane waluty: zamiast `throw` → `console.warn` + skip
- Powód: Stripe CLI test fixtures wysyłają eventy w USD; rzucanie błędu powodowało infinite retry ze strony Stripe i 500 w logach. Real prod traffic będzie EUR/PLN, ale safety net jest ważny
- Update testu `pomija (z warningiem) płatność w nieobsługiwanej walucie`

## [PR #11] — 2026-05-22

- Drugi hotfix webhook'a Stripe — przepisany na **Node-style** (`req`/`res`, raw body przez stream)
- Powód: bare `api/` folder bez Next.js w Vercelu używa Node IncomingMessage by default; Web API `Request` nie jest tu dostępne. Pierwsza próba (PR #10) usuwała tylko `config.api.bodyParser`, ale to nie zmieniło runtime mode'u — funkcja dalej dostawała `req`, a kod wołał `.headers.get()`
- Przywrócony `bodyParser: false` (potrzebny dla legacy Node mode żeby Stripe mógł zweryfikować raw bytes)
- Dodany `readRawBody(req)` helper czytający body przez stream
- `process_stripe_event` (czysta logika w `lib/`) bez zmian — 23 testy nadal zielone

## [PR #10] — 2026-05-22

- Hotfix: usunięty legacy `export const config = { api: { bodyParser: false } }` z `api/stripe/webhook.js`
- Konsekwencja: funkcja uruchamia się w trybie modern Web API (zgodnym z `request.text()` + `request.headers.get()`), zamiast trybu legacy Node `IncomingMessage` w którym `.headers.get()` nie istnieje
- Test ręczny w produkcji: `POST /api/stripe/webhook` bez sygnatury zwraca teraz 400 (verify error) zamiast 500 (crash)

## [PR #9] — 2026-05-22

- Stage 2: pierwszy backend endpoint + lokalna kopia płatności
- Migracja 003 (`db/migrations/003_payments.sql`): tabela `public.payments` z `provider`, `external_charge_id`, FX columns (`amount_pln_grosze`, `fx_rate`, `fx_source`, `fx_table_date`), kolumną `quarter` ustawianą triggerem, RLS włączone
- `lib/stripe-webhook.js` — czysta logika `processStripeEvent(event, deps)` (port-and-adapter pattern, łatwo testowalna)
- `api/stripe/webhook.js` — Vercel handler: weryfikacja sygnatury Stripe + dispatch + zapis do `payments`
- Obsługa eventów: `checkout.session.completed` (link profilu ze Stripe customer ID), `invoice.payment_succeeded` + `charge.succeeded` (insert do `payments` z FX z NBP)
- Idempotencja przez `unique(provider, external_charge_id)` + ignore na `23505`
- 6 nowych testów (`tests/unit/stripe-webhook.test.js`): EUR z FX, PLN bez FX, missing profile, unsupported currency, checkout linking, ignored events
- `stripe` SDK jako prod dep

## [PR #8] — 2026-05-22

- Stage 1: helpery backendowe z testami TDD
  - `lib/fx.js` — `getEurPlnRate(date)` z NBP API + `convertEurCentsToPlnGrosze(cents, rate)`
  - `lib/brevo.js` — `sendBrevoEmail({apiKey, to, subject, htmlContent, sender})`
  - `lib/supabase-admin.js` — `createSupabaseAdmin({url, serviceKey})` (service_role klient)
- MSW (Mock Service Worker) jako mock zewnętrznych API w testach (NBP, Brevo)
- `@supabase/supabase-js` jako pierwsza prod dependency
- 17 testów w `tests/unit/` (fx, brevo, supabase-admin, smoke)

## [PR #7] — 2026-05-22

- Stage 0b: GitHub Actions workflows (`pr-checks.yml`, `docs-check.yml`) wymuszające testy, lint, format i aktualizację dokumentacji
- Husky 9 pre-commit hook lokalnie (lint + format check)
- `docs/CHANGELOG.md` z startowym wpisem
- `docs/qa.md` — opis strategii QA (TDD, dokumentacja, branch protection)

## [PR #6] — 2026-05-22

- Stage 0a: Vitest, ESLint 9 (flat config), Prettier — scaffolding tooling testowego
- Lint i format ograniczone do nowych folderów (`lib/`, `api/`, `tests/`) — istniejący frontend bez zmian
- Smoke test (`tests/unit/smoke.test.js`) — weryfikacja runnera
- `coverage/` dodane do `.gitignore`

## [PR #5] — 2026-05-22

- Plan: admin tracking kwartalnych wpłat z alertami przez Brevo (zatwierdzony)
- Lokalizacja: `docs/plans/revenue-cap-tracking.md`
- Link w `docs/README.md`

## [PR #4] — 2026-05-22

- Supabase Auth: magic-link logowanie podpięte (`logowanie.html` → `signInWithOtp`)
- Schemat startowy bazy (migracja 001): `profiles`, `subscriptions`, `vps_instances` + RLS + triggery
- Hardening funkcji (migracja 002): search_path + revoke execute
- `panel.html` MVP z wykrywaniem sesji + redirect

## [PR #3] — 2026-05-22

- Konfiguracja Supabase MCP w `.mcp.json` (project ref `qwnwxrsdjzyddebovims`)

## [PR #2] — 2026-05-22

- Dokumentacja projektu (`docs/`): architecture, auth, payments, database, deployment, development

## [PR #1] — 2026-05-22

- Vercel jako hosting (zamiast Hostinger FTP)
- `vercel.json` z `cleanUrls`, cache headers
