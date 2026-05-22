# Autoryzacja — magic-link via Supabase

Klient nie ma hasła. Wpisuje email, dostaje jednorazowy link na 10 minut, klika, jest zalogowany. Bezpieczniejsze (brak hasła do wycieku) i tańsze (brak resetowania, brak captchy).

## Konfiguracja w Supabase

**Authentication → Providers → Email:**
- ✅ Enable Email provider
- ❌ Confirm email — wyłączone (magic-link sam to robi)
- ✅ Enable Magic Link

**Authentication → URL Configuration:**
- Site URL: `https://vps4u.xyz`
- Redirect URLs:
  - `https://vps4u.xyz/panel`
  - `https://vps4u.xyz/panel/**`
  - `https://*.vercel.app/**` (preview deploye)

**Authentication → Email Templates → Magic Link:**
- Polski szablon (do napisania przy implementacji)

## Frontend — `logowanie.html`

Inicjalizacja klienta:

```js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  window.VPS4U_CONFIG.SUPABASE_URL,
  window.VPS4U_CONFIG.SUPABASE_ANON_KEY
);
```

Submit formularza:

```js
const { error } = await supabase.auth.signInWithOtp({
  email: emailInput.value,
  options: { emailRedirectTo: 'https://vps4u.xyz/panel' }
});

if (error) {
  // pokaż błąd
} else {
  // pokaż overlay "sprawdź email"
}
```

## Co dzieje się po kliknięciu linka z maila

1. User klika `https://vps4u.xyz/panel#access_token=...&refresh_token=...`
2. Klient Supabase JS automatycznie wykrywa tokeny w URL, wymienia je na sesję
3. Sesja zapisywana w `localStorage` (default) lub `cookies` (jak skonfigurujemy SSR)
4. Frontend `/panel` woła `supabase.auth.getUser()` i pobiera dane

## Trigger w bazie: `auth.users` → `public.profiles`

Supabase trzyma userów w `auth.users` (zarządzane przez Supabase, nie modyfikujemy bezpośrednio). My potrzebujemy własnej tabeli `public.profiles` na pola spoza Supabase (Stripe customer ID, język, akceptacje).

Trigger `on_auth_user_created` (zob. [database.md](database.md)) automatycznie tworzy row w `profiles` przy każdym nowym userze w `auth.users`.

## Rejestracja vs logowanie

W naszym modelu **rejestracji jako osobnego kroku nie ma**:

- **Pierwszy raz**: user płaci u Stripe → webhook tworzy user w `auth.users` przez admin API (`supabase.auth.admin.createUser({ email })`), wysyła mail z dostępami SSH + linkiem do panelu (magic-link osobno)
- **Kolejne razy**: user wpisuje email na `/logowanie` → magic-link

Wniosek: strona `/rejestracja` jest landingiem produktu (plany, ceny, CTA do Stripe), nie formularzem rejestracji.

## Sesje, wygasanie, refresh

- Sesja Supabase: **1h access token**, **24h refresh token** (domyślnie)
- Klient JS auto-refreshuje access token w tle
- Po 24h bez aktywności — user musi się zalogować ponownie magic-linkiem
- Można podnieść do 1 tygodnia (Settings → Auth → JWT expiry) — zrobimy, jak panel się ustabilizuje

## Wylogowanie

```js
await supabase.auth.signOut();
window.location.href = '/';
```

## Ochrona stron (`/panel`)

Strona `/panel` jest statyczna, ale ładuje dane wymagające autoryzacji. Pattern:

```js
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  window.location.href = '/logowanie';
  return;
}
// ładuj dane z RLS — Supabase sam filtruje po auth.uid()
```

To jest **client-side guard**, nie security. Security daje RLS w bazie: nawet jak ktoś obejdzie redirect, baza nie odda mu cudzych danych.

## Rate limiting

Supabase ma wbudowane limity magic-linków:
- 4 maile / godz / email
- 30 maili / godz / IP

Wystarczające na MVP. Jak będą problemy z spamem maili — dodamy hCaptcha (Supabase wspiera natywnie).

## Co może pójść nie tak (i jak debugować)

| Problem                              | Diagnostyka                                            |
| ------------------------------------ | ------------------------------------------------------ |
| User nie dostaje maila               | Supabase → Logs → Auth — sprawdź czy wysyłka się udała |
| Mail trafia do spamu                 | Skonfiguruj custom SMTP (Resend) zamiast default       |
| Link "Email link is invalid/expired" | Token jednorazowy lub po 10 min — user klika ponownie  |
| `redirect_to is not allowed`         | Dodaj URL do whitelist w Supabase Auth → URL Config    |
| Sesja znika po refreshu              | `localStorage` blokowany — sprawdź browser settings    |
