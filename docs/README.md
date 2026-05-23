# VPS4U.xyz — dokumentacja

Wewnętrzna dokumentacja projektu. Czytaj w tej kolejności, jeśli widzisz to po raz pierwszy:

1. [architecture.md](architecture.md) — co stoi z czego i jak to gada
2. [development.md](development.md) — jak pracujemy nad kodem
3. [deployment.md](deployment.md) — jak strona trafia na produkcję
4. [qa.md](qa.md) — strategia QA, TDD, gating w CI
5. [auth.md](auth.md) — logowanie magic-linkiem (Supabase)
6. [payments.md](payments.md) — Stripe + provisioning VPS-ów
7. [database.md](database.md) — schemat Postgres + Row Level Security

[CHANGELOG.md](CHANGELOG.md) — historia zmian per PR

## Plany / RFC

- [plans/revenue-cap-tracking.md](plans/revenue-cap-tracking.md) — admin tracking kwartalnych wpłat z alertami przez Brevo (zatwierdzony 2026-05-22, **zrealizowany** PR #5–#18)
- [plans/monthly-cap-tracking.md](plans/monthly-cap-tracking.md) — miesięczny cap równoległy do kwartalnego (do zatwierdzenia, 2026-05-23)

## Backlog (kolejne plany / pomysły)

- Roczny cap (rozszerzenie po monthly cap)
- Per-product cap (cap per kategoria produktu — wymaga segmentowania w Stripe)
- Refundy / chargebacks (Stage 7 z revenue-cap planu)
- Eksport CSV dla księgowej
- Rolling 30-day window (zamiast sztywnych miesięcy)
- Powiadomienia Slack/Discord (oprócz email)
- Contabo provisioning (z `docs/payments.md`)
- Stage 6 Revolut Pro email parser (z revenue-cap planu)

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
