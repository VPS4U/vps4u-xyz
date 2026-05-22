# VPS4U.xyz — dokumentacja

Wewnętrzna dokumentacja projektu. Czytaj w tej kolejności, jeśli widzisz to po raz pierwszy:

1. [architecture.md](architecture.md) — co stoi z czego i jak to gada
2. [development.md](development.md) — jak pracujemy nad kodem
3. [deployment.md](deployment.md) — jak strona trafia na produkcję
4. [auth.md](auth.md) — logowanie magic-linkiem (Supabase)
5. [payments.md](payments.md) — Stripe + provisioning VPS-ów
6. [database.md](database.md) — schemat Postgres + Row Level Security

## Plany / RFC

- [plans/revenue-cap-tracking.md](plans/revenue-cap-tracking.md) — admin tracking kwartalnych wpłat z alertami przez Brevo (zatwierdzony 2026-05-22)

## Aktualny stan (2026-05)

| Komponent       | Status                | Hosting              |
| --------------- | --------------------- | -------------------- |
| Strona (static) | ✅ działa             | Vercel               |
| DNS             | ✅ Cloudflare (only)  | Cloudflare           |
| Auth            | ⏳ w trakcie          | Supabase             |
| Płatności       | ❌ nie zaczęte        | Stripe (planowane)   |
| Provisioning    | ❌ nie zaczęte        | Contabo API (planow.)|
| Poczta domeny   | ✅ działa             | Hostinger            |

## Architektura w jednym zdaniu

Statyczny frontend (HTML + JSX w przeglądarce kompilowany przez Babel) na Vercelu, autoryzacja i baza w Supabase, płatności przez Stripe Payment Links z webhookiem do funkcji serverless w Vercelu, provisioning VPS-ów przez API Contabo.

## Konwencje

- **Język UI**: PL główny, EN przełączalny (`i18n.jsx`, `subpage-i18n.js`)
- **Język kodu / dokumentacji**: polski w komentarzach i docs, angielski w identyfikatorach
- **Praca z repo**: branch + PR, merge robi człowiek
- **Sekrety**: tylko Vercel env vars, nigdy w repo
