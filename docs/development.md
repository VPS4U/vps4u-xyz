# Praca z kodem

## Struktura repo

```
vps4u-xyz/
├── index.html                    ← strona główna
├── o-mnie.html                   ← podstrony
├── rejestracja.html
├── logowanie.html
├── regulamin.html
├── polityka-prywatnosci.html
│
├── app.jsx                       ← główny komponent React (homepage)
├── parts-1.jsx                   ← komponenty: hero, plans, features
├── parts-2.jsx                   ← komponenty: about, testimonials
├── parts-3.jsx                   ← komponenty: pricing, footer, etc.
├── i18n.jsx                      ← słownik PL/EN dla homepage
│
├── styles.css                    ← style homepage
├── subpages.css                  ← style podstron
│
├── subpage-glue.js               ← przełącznik języka + email obfuscation (podstrony)
├── subpage-i18n.js               ← słownik PL/EN dla podstron
├── cookie-banner.js              ← banner zgody na cookies
│
├── config.js                     ← (planowany) public config (Supabase URL + anon key)
├── lib/                          ← (planowane) reusable libs
│   ├── supabase.js               ← klient frontend
│   └── supabase-admin.js         ← klient backend (service_role)
├── api/                          ← (planowane) Vercel Functions
│   ├── keepalive.js
│   ├── stripe/
│   │   ├── webhook.js
│   │   └── portal.js
│   └── contabo/
│       └── provision.js
├── db/                           ← (planowane) migracje SQL
│   └── migrations/
│       └── 001_initial.sql
│
├── docs/                         ← TY JESTEŚ TUTAJ
├── vercel.json                   ← konfiguracja Vercela
├── .gitignore
└── README.md
```

## Konwencje

### Kod
- **Indentacja**: 2 spacje
- **Cudzysłowy**: pojedyncze `'` w JS/JSX, podwójne `"` w HTML/JSON
- **Średniki**: tak, na końcu statementów (sanity dla copy-paste)
- **Identyfikatory**: `camelCase` dla zmiennych/funkcji, `PascalCase` dla komponentów React, `kebab-case` dla plików
- **Komentarze**: po polsku, **tylko gdy WHY nie jest oczywiste**. Nie tłumacz co robi kod — kod sam to mówi
- **Brak typów** (TypeScript): obecnie nie używamy. Jak `/api/*` urośnie — rozważymy TS

### i18n
- Wszystkie teksty user-facing przez słownik z `i18n.jsx` (homepage) lub `subpage-i18n.js` (podstrony)
- Klucze po angielsku, np. `cta.start_now`
- Domyślny język: `pl`. EN jako fallback

### CSS
- **BEM-like**: `.block`, `.block__elem`, `.block--mod`
- **Zmienne CSS** (`:root`) na kolory, fonty, spacing — patrz `styles.css` header
- **Brak preprocesora** (Sass/Less) — vanilla CSS

### Git
- **Branche**: `feat/...`, `fix/...`, `chore/...`, `docs/...`
- **Commit messages**: imperatywnie, krótko ("Add Stripe webhook handler"), bez kropki
- **PR**: tytuł < 70 znaków, opis z **Summary** i **Test plan**
- **Squash merge** dla feature branchy (jeden czysty commit w `main`)

## Workflow zmian

### Standardowa zmiana
1. Branch z `main`: `git checkout -b feat/cos-tam`
2. Edycja
3. Commit z czytelną wiadomością
4. Push: `git push -u origin feat/cos-tam`
5. PR przez `gh pr create` lub GitHub UI
6. Vercel zbuduje preview — sprawdź URL
7. Merge do `main` po akceptacji
8. Produkcja gotowa w ~30s

### Zmiana wymagająca SQL
1. Napisz SQL w `db/migrations/00X_nazwa.sql`
2. PR jak wyżej
3. **Przed merge**: uruchom SQL ręcznie w Supabase SQL Editor (production)
4. Zapisz w PR że wykonane (komentarz „migracja zaaplikowana")
5. Merge

### Zmiana z nową env var
1. Dodaj env var w Vercelu (Settings → Environment Variables) — najpierw Preview, potem Production
2. **Trigger redeploy** żeby się załadowała
3. PR z kodem używającym tej env var

## Lokalne uruchomienie

### Pure static (bez `/api`)
Każdy serwer statyczny zadziała:

```bash
python3 -m http.server 8000
# albo
npx serve .
```

Otwórz `http://localhost:8000`.

**Uwaga**: niektóre rzeczy działają tylko na produkcji:
- `cleanUrls` (Vercel-specific) — lokalnie musisz wpisywać `.html` (`/o-mnie.html` zamiast `/o-mnie`)
- Sesja Supabase z magic-link redirect URL = `localhost:8000/panel` — trzeba dodać do whitelist w Supabase Auth

### Z `/api` functions
Jak dodamy serverless functions:

```bash
npm i -g vercel
vercel dev
```

Symuluje pełen Vercel env (functions + static).

## Edycja JSX

### Co pamiętać
- JSX kompilowany **w przeglądarce** przez Babel standalone
- Po edycji wystarczy reload, żadnego buildu
- Błędy składniowe widać w konsoli (`Uncaught SyntaxError: ...`)
- **Brak HMR** — nie ma hot reload, full refresh

### Dodanie nowego komponentu
1. Edytuj odpowiedni `parts-X.jsx`
2. Wyeksponuj na `window.VPS4U` (zob. wzorzec w istniejącym kodzie):
   ```js
   window.VPS4U.MyComponent = MyComponent;
   ```
3. W `app.jsx` użyj `<MyComponent />`

### Dodanie nowej strony (podstrona)
1. Skopiuj `o-mnie.html` jako szablon
2. Zmień `<title>`, breadcrumb, content
3. Dodaj klucze tłumaczeń w `subpage-i18n.js` (PL + EN)
4. Dodaj link nawigacyjny w odpowiednich miejscach
5. Zaktualizuj `cleanUrls` — działa out-of-the-box, nic w `vercel.json` nie trzeba

## Bezpieczeństwo (basics)

- ❌ **Nigdy** nie commituj sekretów. `.gitignore` ma `.env*`. Service role, Stripe secret, Contabo creds = tylko Vercel env vars
- ❌ Nie wystawiaj `service_role` Supabase na frontend. Tam tylko `anon` key (z definicji publiczny)
- ✅ Weryfikacja sygnatury Stripe webhook — **zawsze**
- ✅ RLS włączone na wszystkich tabelach
- ✅ HTTPS wszędzie (Vercel daje automatycznie)
- ✅ CSP headers — do dorobienia w `vercel.json` jak mniej będzie ruchomych części

## Debugging

### Frontend
- DevTools → Console: błędy JS, błędy Babel
- DevTools → Network: nieudane fetche, status response
- DevTools → Application → Local Storage: sesja Supabase (`sb-...-auth-token`)

### Backend (functions)
- **Vercel Dashboard → Project → Logs**: real-time, 3 dni retencji
- **Vercel CLI**: `vercel logs <deployment-url>`
- **Stripe Dashboard → Developers → Events**: status webhooków + payload

### Baza
- **Supabase Dashboard → SQL Editor**: ad-hoc queries
- **Supabase Dashboard → Logs → Postgres**: wolne query, błędy
- **Supabase Dashboard → Authentication → Users**: lista userów + ostatnia aktywność

## TODO / debt

- [ ] Migracje SQL przez `supabase-cli` zamiast ręcznie
- [ ] Lint (ESLint/Prettier) jak `/api` urośnie
- [ ] Testy E2E (Playwright) dla critical flows
- [ ] CSP headers w `vercel.json`
- [ ] Migracja JSX → Vite + React (gdy performance lub DX zacznie boleć)
- [ ] CHANGELOG.md
