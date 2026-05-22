# VPS4U.xyz

Strona sprzedażowa serwerów VPS — czyste statyczne pliki (HTML/CSS/JS), bez backendu, gotowe do wgrania na Hostinger.

## Co tu jest

| Plik | Opis |
|---|---|
| `index.html` | Strona główna — hero, konfigurator, cennik, usługi, kalkulator, opinie, dashboard, blog, FAQ |
| `o-mnie.html` | Strona zespołu (Karol + Wojtek) |
| `rejestracja.html` | Zakup VPS-a (Stripe Payment Links, consent checkboxes) |
| `logowanie.html` | Logowanie magic linkiem przez Stripe Customer Portal |
| `regulamin.html` | Regulamin świadczenia usług (10 paragrafów, RODO, ODR) |
| `polityka-prywatnosci.html` | Polityka prywatności (11 sekcji) |
| `styles.css`, `subpages.css` | Style |
| `*.jsx`, `*.js` | React/vanilla JS — komponenty, i18n, cookie banner |

## Deploy: GitHub → Hostinger (automatyczny)

Każdy `git push` do gałęzi `main` uruchamia GitHub Action, która synchronizuje pliki na Hostinger przez FTPS w ~30 sekund.

### Jednorazowa konfiguracja

1. **Załóż repo na GitHub** (publiczne albo prywatne) i wrzuć ten katalog jako początkowy commit.
2. **Skopiuj dane FTP z Hostingera:** hPanel → Files → FTP Accounts → utwórz konto (albo użyj domyślnego) → zapisz:
   - `FTP Hostname` (np. `ftp.vps4u.xyz` albo `files.000webhost.com`)
   - `FTP Username` (najczęściej `u123456789`)
   - `FTP Password`
3. **Wklej je w GitHubie:** repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Dodaj trzy sekrety:
   - `FTP_SERVER` — hostname z Hostingera
   - `FTP_USERNAME` — login FTP
   - `FTP_PASSWORD` — hasło FTP
4. **Sprawdź ścieżkę docelową** w `.github/workflows/deploy.yml`:
   - Jeśli `vps4u.xyz` jest domeną główną planu → zostaw `server-dir: /public_html/`
   - Jeśli jest to addon domain → zmień na `/domains/vps4u.xyz/public_html/`

### Workflow — jak go używać

- Każdy push do `main` deployuje automatycznie.
- Możesz też uruchomić ręcznie: zakładka **Actions** w repo → **Deploy to Hostinger via FTP** → **Run workflow**.
- Pierwszy run trwa ~1 min (wgranie wszystkich plików). Kolejne ~10–30s (tylko zmienione).

### Co NIE jest wgrywane na serwer

Workflow wyklucza z deployu: `.git/`, `.github/`, `.gitignore`, `README.md`, `.DS_Store`, `node_modules/`. Te pliki są tylko dla developera, nie dla użytkownika końcowego.

## Konfiguracja produkcyjna — co musisz uzupełnić

1. **Stripe Payment Links** w 2 plikach (szukaj `REPLACE_WITH_STRIPE_LINK_`):
   - `i18n.jsx` — pole `stripe:` przy każdym z 6 planów (PL i EN)
   - `rejestracja.html` — 3 buttony "Zamów →" (Mały / Średni / Duży)
2. **Stripe Customer Portal** — w `logowanie.html` zmień handler submit-form na przekierowanie do publicznego URL portalu (lub własnego endpointu w PHP/Node).
3. **Webhook handler** dla provisioningu VPS-ów (Stripe `checkout.session.completed` → API Contabo → mail z danymi SSH). To osobny komponent w PHP/Node — strona statyczna sama tego nie zrobi.

## Tech stack

- **Frontend**: ręcznie pisany HTML5 + CSS3 + React 18 (in-browser przez Babel) — wszystko statyczne, zero build step
- **Płatności**: Stripe Payment Links (+ ew. Revolut Pro)
- **Hosting fizyczny VPS-ów**: Contabo GmbH (Niemcy, USA, Singapur)
- **Analytics**: Plausible.io (no-cookie, RODO-friendly)
- **CI/CD**: GitHub Actions + FTPS na Hostinger

## Język

PL/EN switcher w prawym górnym rogu — wybór zapisywany w localStorage.

## Zespół

- **Karol Błażej Balikiewicz** — operator, sprzedawca (Bytom)
- **Wojciech Maciejewski** — co-founder, infra & blog (Świnoujście)

Kontakt: info@vps4u.xyz

---

© 2024–2026 VPS4U.xyz
