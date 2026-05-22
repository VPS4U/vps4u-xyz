# Architektura

## Wysokopoziomowy obraz

```
            ┌──────────────┐
            │  Cloudflare  │  (tylko DNS, proxy off)
            │     DNS      │
            └──────┬───────┘
                   │
                   ▼
   ┌──────────────────────────────┐
   │           Vercel             │
   │  ┌────────────────────────┐  │
   │  │ Static frontend        │  │  HTML + CSS + JSX
   │  │ index.html, *.jsx      │  │  (Babel standalone)
   │  └────────────────────────┘  │
   │  ┌────────────────────────┐  │
   │  │ Serverless Functions   │  │  /api/*
   │  │ /api/stripe/webhook    │  │
   │  │ /api/contabo/provision │  │
   │  │ /api/keepalive (cron)  │  │
   │  └────────┬───────────────┘  │
   └───────────┼──────────────────┘
               │
       ┌───────┴────────┬───────────────┐
       ▼                ▼               ▼
  ┌─────────┐    ┌────────────┐   ┌──────────┐
  │Supabase │    │   Stripe   │   │ Contabo  │
  │(Postgres│    │ (Payments) │   │  (VPS)   │
  │ + Auth) │    │            │   │   API    │
  └─────────┘    └────────────┘   └──────────┘
```

## Komponenty

### Frontend
- **Pliki**: `index.html`, `o-mnie.html`, `rejestracja.html`, `logowanie.html`, `regulamin.html`, `polityka-prywatnosci.html`
- **Logika React**: `app.jsx`, `parts-1.jsx`, `parts-2.jsx`, `parts-3.jsx`
- **i18n**: `i18n.jsx` (homepage), `subpage-i18n.js` (podstrony)
- **Klej podstrony**: `subpage-glue.js` (przełącznik języka, mailto)
- **Banner cookies**: `cookie-banner.js`
- **Style**: `styles.css` (homepage), `subpages.css` (podstrony)

JSX kompilowany jest **w przeglądarce** przez `@babel/standalone`. To znaczy:
- Brak build stepu
- Każdy plik `.jsx` ma `<script type="text/babel" src="..."></script>` w HTML
- Wada: spory boilerplate JS leci do klienta. Zaleta: prostota — edytujesz plik i działa
- Jeśli kiedyś wąsko z performance — migracja do Vite/Next zajmie 1–2h, większość kodu zostanie

### Backend (Vercel Serverless Functions)
- **Folder**: `/api/` w repo
- **Runtime**: Node.js 20.x (default Vercela)
- **Limity hobby**: 10s na wywołanie, 1024 MB RAM, brak cold-start friendly featurów
- **Każdy plik** `/api/foo.js` = endpoint `https://vps4u.xyz/api/foo`

### Baza i Auth — Supabase
- **Projekt**: oddzielny dla `vps4u.xyz` (Frankfurt)
- **Plan**: Free (limity: [docs/database.md](database.md))
- **Auth**: magic-link, sesja w cookies, RLS pilnuje izolacji userów
- **Klient frontend**: `@supabase/supabase-js` przez ESM CDN
- **Klient backend** (webhook): osobny klient z `service_role` key, omija RLS

### Płatności — Stripe
- **Stripe Payment Links** (6 produktów = 6 linków)
- **Webhook**: `POST /api/stripe/webhook` weryfikuje sygnaturę i zapisuje do Supabase
- **Customer Portal**: hostowany u Stripe (faktury, anulowanie, zmiana planu)
- Szczegóły: [payments.md](payments.md)

### Provisioning — Contabo API
- Wywołanie z webhooka Stripe po sukcesie płatności
- Tworzy instancję, czeka na IP, zapisuje do `vps_instances`, wysyła mail
- **Wymaga**: konta biznesowego Contabo z aktywnym Cloud API

### Maile transakcyjne
- **Magic-link**: wysyła Supabase (własny SMTP, free)
- **Dostępy SSH po płatności**: Resend (3000/mies free), wywołany z funkcji webhook
- Szczegóły szablonów: [auth.md](auth.md), [payments.md](payments.md)

## Przepływy

### Rejestracja + płatność (happy path)
1. User klika "Zamów" na `/rejestracja` → przekierowanie na Stripe Payment Link
2. Płaci kartą u Stripe (hosted checkout)
3. Stripe wysyła webhook `checkout.session.completed` na `/api/stripe/webhook`
4. Webhook:
   a. weryfikuje sygnaturę
   b. tworzy/aktualizuje user w Supabase (`auth.users` + `profiles`)
   c. tworzy `subscriptions` row
   d. wywołuje Contabo API, zapisuje `vps_instances`
   e. wysyła mail z dostępami przez Resend
5. User dostaje mail z IP + SSH, klika link do panelu
6. Panel automatycznie loguje (magic-link z tego samego maila lub osobny)

### Logowanie istniejącego usera
1. User wpisuje email na `/logowanie`
2. Frontend wywołuje `supabase.auth.signInWithOtp({ email })`
3. Supabase wysyła magic-link
4. User klika link → ląduje na `/panel?token=...` → Supabase JS wymienia token na sesję (cookie)
5. Panel ładuje dane z Supabase z RLS

## Decyzje architektoniczne

### Dlaczego Vercel, nie Hostinger
- Auto-deploy z GitHuba — każdy PR = preview URL
- Brak SSH na Hostingerze blokował automatyzację
- Vercel daje serverless functions w tym samym deployu co frontend
- Zob. [deployment.md](deployment.md)

### Dlaczego Supabase, nie własna baza
- Magic-link auth out-of-the-box (oszczędność ~6h kodu)
- RLS oznacza, że frontend może czytać bazę bezpośrednio bez API gatekeepera
- Free tier wystarczy do MVP

### Dlaczego JSX w przeglądarce, nie build step
- Strona istniała już w tej formie, brak powodu, żeby ruszać
- Edycja → push → deploy bez krokowania build
- Jeśli kiedykolwiek dorzucamy serwerowy rendering, przepiszemy na Next.js w jeden weekend

### Dlaczego Cloudflare bez proxy
- Vercel ma własny CDN + SSL + DDoS
- Proxy CF blokowałoby wystawienie certu Vercela na apex
- Cloudflare zostaje tylko dla wygody zarządzania DNS-em (i ew. przyszłe usługi)

### Dlaczego Stripe Payment Links, nie własny Checkout
- Najmniej kodu (zero kodu frontu)
- PCI compliance po stronie Stripe
- Customer Portal hostowany u Stripe — userzy zarządzają subskrypcją bez naszego UI
- Wada: mniej kontroli nad UX checkout. Akceptowalne na MVP.

## Sekrety i gdzie żyją

| Sekret                    | Gdzie                                  | Kto czyta              |
| ------------------------- | -------------------------------------- | ---------------------- |
| Supabase `anon` key       | `config.js` (w repo, public)           | Frontend               |
| Supabase `service_role`   | Vercel env var `SUPABASE_SERVICE_KEY`  | Webhook backend        |
| Stripe publishable        | (nie używamy — Payment Links)          | —                      |
| Stripe webhook secret     | Vercel env var `STRIPE_WEBHOOK_SECRET` | `/api/stripe/webhook`  |
| Contabo client_id/secret  | Vercel env var `CONTABO_*`             | `/api/contabo/*`       |
| Resend API key            | Vercel env var `RESEND_API_KEY`        | Webhook backend        |

Zasady:
- **Nigdy** sekretów w repo (anon key i publishable są wyjątkami — z definicji publiczne)
- Vercel ma osobne env vars dla **Production**, **Preview**, **Development**
- Rotacja: jak ktoś odchodzi z dostępu albo coś wycieka — wszystkie sekrety regenerujemy na raz
