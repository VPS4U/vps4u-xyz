# Plan: Miesięczny cap (rozszerzenie revenue cap tracking)

**Status:** do zatwierdzenia · **Data utworzenia:** 2026-05-23 · **Bazuje na:** [revenue-cap-tracking.md](revenue-cap-tracking.md)

## Context

Po dostarczeniu kwartalnego capu (PR #5–#18) właściciel chce dodatkowy **miesięczny cap**. Powód: kwartał ma 3 miesiące — wpłata przekraczająca cały miesięczny budżet w pierwszych dniach kwartału nie wywoła alertu, bo nie sięgnęła kwartalnego progu. Miesięczny cap daje krótsze okno reakcji i pozwala wcześniej wyłapać "spike" przychodów.

**Wymagania funkcjonalne:**
1. **Niezależny od kwartalnego** — oba capy działają równolegle, każdy ma własne progi i własną historię alertów (kwartalny cap dalej działa bez zmian).
2. Cap edytowalny w PLN z `/admin` (jak kwartalny).
3. Te same progi `[50, 80, 100]` domyślnie (też edytowalne).
4. Email odbiorczy — wspólny z kwartalnym (jeden `alert_email` w settings dla obu).
5. Idempotencja: jeden alert per `(month, threshold_pct)` per kwartał — analogicznie jak `(quarter, threshold_pct)`.
6. Format miesiąca: `YYYY-MM` (np. `2026-05`) — sortowane chronologicznie.

**Pochodne (out of scope tego planu, zostawić na potem):**
- Roczny cap
- Per-product cap (np. cap tylko na VPS, osobny na WordPress hosting)
- Dynamiczne capy z rolling window (np. ostatnie 30 dni)

## Approach (etapy)

### Stage 6.1 — Schema + helpery (1 PR)

**Migracja 007** `db/migrations/007_monthly_cap.sql`:
- Tabela `payments` — **nowa kolumna `month text not null`** ustawiana triggerem z `charged_at` (format `YYYY-MM` UTC). Reuse pattern z `compute_payment_quarter`.
- Indeks `idx_payments_month` na `payments(month)`.
- Tabela `monthly_alert_log` (analogiczna do `alert_log`):
  - `id uuid pk, month text, threshold_pct int, amount_pln_grosze bigint, cap_pln_grosze bigint, fired_at timestamptz`
  - `unique(month, threshold_pct)`
- RLS: `Admins read monthly_alert_log` przez `current_user_is_admin()`
- Seed do `admin_settings`:
  - `monthly_cap` = `{"grosze": 2000000, "currency": "pln"}` (20 000 PLN = 1/2.5 kwartalnego startowego)
  - `monthly_alert_thresholds_pct` = `[50, 80, 100]`

**Backfill kolumny `month`** dla istniejących wierszy (one-shot SQL w migracji).

**Helper `lib/admin-stats.js`** — dodać `computeMonthFromDate(date)` (analogicznie do `computeQuarterFromDate`).

**Walidacja** `lib/admin-settings-validate.js` — rozszerzyć o `monthly_cap` i `monthly_alert_thresholds_pct` (oba z tymi samymi regułami co kwartalne wersje).

**Testy:** unit dla `computeMonthFromDate`, rozszerzenie testów walidacji o monthly fields. Pre-req acceptance: 51 + nowe testy zielone.

---

### Stage 6.2 — Alert logic + wiring (1 PR)

**`lib/admin-alerts.js`** — refactor żeby `checkAndAlertThresholds` był reused dla obu poziomów. Idea:

```
processPaymentInserted(deps) -> dla każdego poziomu (quarter, month):
  checkAndAlertThresholds(deps + poziom-specific config)
```

Konkretnie: funkcja przyjmuje `period` (np. `{ key: 'quarter', label: 'Q2-2026', cap, thresholds, alertLogTable }`) i pure-logika identyczna. Webhook wywołuje ją 2 razy z różnymi periodami.

**`api/stripe/webhook.js`** — w `afterPaymentInserted` wywołuje 2 razy: dla quarter i month.

**Testy:** rozbudowa `admin-alerts.test.js` o monthly scenariusze + test że oba lecą niezależnie (kwartalny + miesięczny mogą trafić w ten sam moment bez kolizji idempotencji).

---

### Stage 6.3 — UI w admin.html (1 PR)

**Sekcja "Bieżący miesiąc"** — analogiczna karta jak "Bieżący kwartał":
- Suma wpłat miesiąca + cap + % bar (kolory tak samo: <50 zielony, <80 żółty, ≥80 czerwony)

**Tabela "Ostatnie 6 miesięcy"** — historia.

**Settings form** — rozszerzyć o:
- Cap miesięczny PLN (input number)
- Progi miesięczne (6 checkboxów: 25/50/75/80/90/100) — osobne od kwartalnych

**Endpoint `/api/admin/settings`** — accept nowe pola w payloadzie.

**Endpoint `/api/admin/test-alert`** — opcja: dropdown do wyboru "kwartalny / miesięczny" (albo wysyła oba dla pewności).

**Testy E2E:** smoke że strona `/admin` ładuje się z nową sekcją bez błędów.

---

## Schema bazy (referencja)

### `payments` — dodanie kolumny
```
alter table public.payments add column month text;
update public.payments set month = to_char(charged_at at time zone 'UTC', 'YYYY-MM');
alter table public.payments alter column month set not null;
```
+ rozszerzenie triggera `compute_payment_quarter` (rename → `compute_payment_period`) o `month`.

### `monthly_alert_log`
```
create table public.monthly_alert_log (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  threshold_pct int not null,
  amount_pln_grosze bigint not null,
  cap_pln_grosze bigint not null,
  fired_at timestamptz default now(),
  unique (month, threshold_pct)
);
```

### `admin_settings` — nowe klucze
- `monthly_cap`: `{"grosze": 2000000, "currency": "pln"}`
- `monthly_alert_thresholds_pct`: `[50, 80, 100]`

## Critical files

**Nowe:**
- `db/migrations/007_monthly_cap.sql`
- (rozszerzenie istniejących plików `lib/admin-*.js` zamiast nowych)

**Modyfikowane:**
- `lib/admin-stats.js` — dodaj `computeMonthFromDate`
- `lib/admin-settings-validate.js` — accept nowe pola
- `lib/admin-alerts.js` — refactor na period-agnostic
- `api/stripe/webhook.js` — 2x wywołanie `checkAndAlertThresholds`
- `api/admin/settings.js` — accept nowe pola
- `api/admin/test-alert.js` — test mail dla obu poziomów
- `admin.html` — nowa karta + tabela + rozszerzony settings form
- `docs/database.md`, `docs/payments.md`, `docs/CHANGELOG.md`

## Verification (end-to-end)

1. **Po Stage 6.1:** migracja na prod, `select month from payments limit 5` zwraca format `YYYY-MM`
2. **Po Stage 6.2:** smoke test analogiczny do Stage 4 — 4 wpłaty (1/5/8/10 PLN) przy capie miesięcznym 10 PLN → 3 maile miesięczne (50%, 80%, 100%)
3. **Po Stage 6.3:** /admin pokazuje "Bieżący miesiąc" + edytowalny cap; "Wyślij testowy mail" wysyła 2 maile

## Out of scope

- **Roczny cap** — analogiczne rozszerzenie, dorobimy gdy będzie sens
- **Per-product cap** — najpierw potrzebne segmentowanie cennika w Stripe (subscription metadata)
- **Rolling 30-day window** — bardziej skomplikowane, oddzielny RFC
- **Powiadomienia inne niż email** — Slack/Discord webhook, opcjonalnie w przyszłości
