# Baza danych — Supabase / Postgres

## Środowisko

- **Supabase** projekt `vps4u-xyz`, region Frankfurt
- **Plan**: Free (limity poniżej)
- **Postgres**: 15.x (Supabase trzyma się ~6 mies. za upstream)
- **Pooler**: Supavisor — używamy port `6543` (transaction mode) dla serverless

## Limity Free

| Zasób                  | Limit              | Komentarz                                     |
| ---------------------- | ------------------ | --------------------------------------------- |
| Database size          | 500 MB             | Wystarczy na ~100k userów + subów             |
| Egress                 | 5 GB / mc          | Reads + plików + auth                         |
| MAU (auth)             | 50 000             | Per miesiąc                                   |
| Storage                | 1 GB               | Nie używamy                                   |
| Edge functions         | 500k invocations   | Nie używamy (mamy Vercel)                     |
| Auto-pause             | po 7 dniach idle   | **Rozwiązujemy keepalive cronem**             |
| Backupy                | dzienne, retencja 1 dzień | Pro daje 7 dni + point-in-time          |

**Auto-pause**: jeśli przez 7 dni żadnego query — projekt pauzuje, strona przestaje działać do czasu manualnego "restore" w panelu. Mamy `/api/keepalive` wołany cronem co 3 dni żeby tego uniknąć.

## Schemat

Plik źródłowy SQL: do skopiowania z [README.md](README.md) — będzie zarządzany jako migracja po pierwszym wdrożeniu.

### Tabele

**`auth.users`** — zarządzane przez Supabase, nie modyfikujemy bezpośrednio. Zawiera email, ID, sesje, dane MFA.

**`public.profiles`** — rozszerzenie usera o nasze pola:
- `id uuid` — FK do `auth.users.id`
- `email text` — duplikujemy dla wygody queries
- `stripe_customer_id text unique` — wypełniane po pierwszej płatności
- `preferred_language text` — `'pl' | 'en'`
- `tos_accepted_at timestamptz` — akceptacja regulaminu
- `immediate_service_accepted_at timestamptz` — zgoda na rozpoczęcie usługi przed 14-dniowym prawem odstąpienia (RODO/sprzedaż konsumencka)

**`public.subscriptions`** — aktywne i historyczne subskrypcje:
- `id uuid` — PK
- `user_id uuid` — FK do `profiles.id`
- `stripe_subscription_id text unique` — klucz idempotencji z Stripe
- `stripe_price_id text` — który plan
- `plan_name text` — internal nazwa (`starter`, `pro` etc.)
- `status text` — `active | past_due | canceled | incomplete`
- `current_period_end timestamptz` — kiedy się odnawia
- `cancel_at_period_end boolean` — flaga zaplanowanego anulowania

**`public.payments`** — lokalna kopia każdej udanej wpłaty (provider-agnostic):
- `id uuid` — PK
- `provider text` — `stripe` lub `revolut`
- `external_charge_id text` — ID transakcji u PSP
- `unique(provider, external_charge_id)` — idempotencja webhooków
- `user_id uuid` — FK do `profiles.id`
- `subscription_id uuid` — FK do `subscriptions.id` (nullable, np. one-off charges)
- `amount_cents bigint` — kwota w oryginalnej walucie
- `currency text` — `eur` lub `pln`
- `amount_pln_grosze bigint` — denormalizowane przeliczenie na PLN (po `fx_rate` z dnia płatności)
- `fx_rate numeric(10,4)` — kurs EUR→PLN użyty (1.0 dla PLN→PLN)
- `fx_source text` — `nbp_a` (tabela A NBP) lub `manual` lub `same` (gdy waluta = PLN)
- `fx_table_date date` — data publikacji tabeli NBP (do audytu)
- `charged_at timestamptz` — moment płatności u PSP
- `quarter text` — ustawiane triggerem (`Q1-2026`, `Q2-2026`, ...) — indeksowane dla cap tracking
- `created_at timestamptz`

**`public.vps_instances`** — fizyczne VPS-y:
- `id uuid` — PK
- `subscription_id uuid` — FK
- `user_id uuid` — FK (denormalizacja dla szybszego RLS)
- `contabo_instance_id text unique` — ID w Contabo
- `ip_address inet` — IP po provisioningu
- `region text` — `eu-central-1` itp.
- `ssh_username text` — domyślnie `root`
- `status text` — `provisioning | running | stopped | failed | deleted`
- `provisioned_at timestamptz`

### Indeksy

```sql
create index idx_subscriptions_user on subscriptions(user_id);
create index idx_subscriptions_status on subscriptions(status);
create index idx_vps_user on vps_instances(user_id);
```

Jeszcze nie ma indeksów na `email` w profiles — RLS i tak filtruje po `id`. Dodamy jak będzie potrzebne.

## Row Level Security (RLS)

**Włączone na wszystkich tabelach `public.*`.** Bez RLS frontend (z anon key) mógłby czytać cudze dane. Z RLS Postgres sam filtruje queries po `auth.uid()`.

Polityki:

```sql
create policy "Users read own profile"   on profiles      for select using (auth.uid() = id);
create policy "Users update own profile" on profiles      for update using (auth.uid() = id);
create policy "Users read own subs"      on subscriptions for select using (auth.uid() = user_id);
create policy "Users read own vps"       on vps_instances for select using (auth.uid() = user_id);
```

**Co to znaczy w praktyce:**
- Frontend z anon key → user zalogowany → `select * from profiles` zwraca tylko jego row
- Frontend bez sesji → `select * from profiles` zwraca pusty zestaw
- Backend z `service_role` key → RLS **nie obowiązuje**, widzi wszystko (do webhooków)

**Czego NIE robimy:**
- `INSERT/UPDATE/DELETE` na `profiles`, `subscriptions`, `vps_instances` z frontendu — wszystkie writes idą przez backend (webhook Stripe albo `/api/...`)
- Z tego powodu mamy tylko `select`/`update` policies, brak `insert`/`delete`

## Triggery

### `on_auth_user_created`
Po `INSERT` do `auth.users` — automatycznie tworzy row w `public.profiles`:

```sql
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

Funkcja `handle_new_user()` ma `security definer` — wykonuje się z prawami właściciela funkcji (nie wywołującego), żeby ominąć RLS przy insert.

### `*_touch_updated_at`
Na `profiles` i `subscriptions` — aktualizuje `updated_at = now()` przy każdym update.

## Migracje

Aktualnie: **brak narzędzia migracyjnego**. Zmiany schematu robimy ręcznie w Supabase SQL Editor, ale dokumentujemy w repo:

```
db/
  migrations/
    001_initial.sql      ← startowy schema (z README.md)
    002_add_xxx.sql      ← każda kolejna zmiana
```

Workflow zmian:
1. Napisz SQL w pliku `db/migrations/00X_name.sql`
2. PR z opisem co robi i czemu
3. Po merge — uruchom ręcznie w Supabase SQL Editor (production)
4. Zapisz w PR że uruchomione

Jak projekt urośnie — przejdziemy na `supabase-cli` + automatyczne migracje przez CI.

## Backup i recovery

- **Daily backup** robi Supabase (retencja 1 dzień na Free, 7 dni na Pro)
- **Eksport ręczny**: `Supabase Dashboard → Database → Backups → Download` — rób przed dużymi zmianami
- **Point-in-time recovery**: tylko Pro

Dla nas, dopóki jesteśmy Free:
- Przed każdą migracją ryzykowną — `pg_dump` lub manualny download backupu
- Trzymaj kopię ostatniego eksportu w prywatnym Drive

## Keepalive (anti-pauza)

Plik: `/api/keepalive.js`
Cron Vercela: co 3 dni, `0 0 */3 * *`

```js
export default async function handler(req, res) {
  // dowolne query — wystarczy SELECT 1 albo count(*)
  const { error } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true });
  return res.status(error ? 500 : 200).json({ ok: !error });
}
```

Konfiguracja w `vercel.json`:

```json
{
  "crons": [{ "path": "/api/keepalive", "schedule": "0 0 */3 * *" }]
}
```

## Co może pójść nie tak (i jak debugować)

| Problem                                  | Rozwiązanie                                              |
| ---------------------------------------- | -------------------------------------------------------- |
| "permission denied for table profiles"   | RLS — brak policy lub user nie zalogowany                |
| "duplicate key value violates unique"    | Webhook Stripe retry — dodaj `ON CONFLICT DO NOTHING`    |
| Pooler "max client connections reached"  | Używaj port 6543 (transaction mode) w serverless, nie 5432 |
| Projekt zapauzowany                      | Dashboard → Restore + sprawdź czy keepalive cron działa  |
| Query bardzo wolne                       | Supabase → Database → Query Performance — dodaj indeks   |
