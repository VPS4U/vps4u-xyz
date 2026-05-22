# Changelog

Każdy merge'owany PR ma tu wpis. Format: `## [PR #N] — YYYY-MM-DD` + bullet list zmian. CI wymusza aktualizację tego pliku w każdym PR (poza tymi z labelem `no-docs-needed`).

---

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
