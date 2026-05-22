# QA Strategy

## Filozofia: TDD jako reguła, nie sugestia

Każda zmiana funkcjonalna wymaga testów napisanych **przed** kodem. PR bez testów dla nowej logiki nie przechodzi CI. Wyjątki (czysty markup HTML, zmiany w docs, zmiany config) wymagają labela `no-test-needed` na PR-ze (nadaje tylko owner).

**Cykl pracy nad zmianą funkcjonalną:**

1. Napisz failujący test (red)
2. Napisz minimum kodu żeby przeszedł (green)
3. Refactor jeśli potrzeba (zielony cały czas)
4. Update docs (CHANGELOG + relevant)
5. PR

## Stack testowy

- **Vitest** — runner, lekki, ESM-native
- **MSW** (planowane) — mock zewnętrznych API (Stripe, NBP, Brevo)
- **@testing-library/dom** (planowane) — DOM testy dla `panel.html`/`admin.html`
- **Playwright** ✅ (Stage 0c) — E2E przeciwko lokalnemu `python3 -m http.server`

## Cele pokrycia

- `lib/*.js` → ≥80% line coverage (helpery; wymuszane przez `vitest.config.js`)
- `api/*.js` → integration test per endpoint, minimum happy path + 1 error path
- `*.html` (JSX inline) → snapshot + smoke interakcji (po Playwrightcie)

## Lokalna pierwsza linia obrony (Husky pre-commit)

Plik: `.husky/pre-commit`

Wykonuje przy każdym `git commit`:

- `npm run lint` — ESLint
- `npm run format:check` — Prettier

**Nie** odpalamy testów w pre-commit (za wolne dla codziennej pracy). Testy odpalają się w CI.

Hooki można obejść `--no-verify`, dlatego serwerowy gate (poniżej) jest source of truth.

## Twardy gate: GitHub Actions

Pliki: `.github/workflows/pr-checks.yml`, `.github/workflows/docs-check.yml`

Required status checks na branch protection `main`:

| Check                 | Co sprawdza                                                                   |
| --------------------- | ----------------------------------------------------------------------------- |
| `tests`               | `npm test` zwraca 0 (unit + integration via Vitest)                           |
| `lint`                | `npm run lint` zwraca 0                                                       |
| `format`              | `npm run format:check` zwraca 0                                               |
| `e2e`                 | `npm run test:e2e` zwraca 0 (Playwright + Chromium)                           |
| `docs-required`       | `docs/CHANGELOG.md` zmieniony **i** (zmiana kodu → `docs/**` też zmienione) |

Wyjątek: PR z labelem `no-docs-needed` pomija `docs-required` (label nadaje tylko owner).

## Wersjonowanie dokumentacji

- `docs/CHANGELOG.md` — single source of truth historii zmian
- Format wpisu: `## [PR #N] — YYYY-MM-DD` + bullet list
- `docs/*.md` mogą zawierać frontmatter `last_updated: YYYY-MM-DD` (dodawane w razie potrzeby)

## Branch protection na `main`

Włączone przez GitHub API (PR #6 — Stage 0a) + uzupełnione w PR #7 (Stage 0b):

- ❌ Force pushes
- ❌ Deletions
- ✅ Required linear history (squash/rebase only)
- ✅ Required conversation resolution
- ✅ Required status checks: `tests`, `lint`, `format`, `docs-required` (dodawane po pierwszym uruchomieniu workflow)
- `enforce_admins`: początkowo OFF (awaryjny override), zostanie włączone gdy potwierdzimy że nic nie blokuje normalnej pracy

## Wyjątki — kiedy stosować

- `no-docs-needed` — PR typu test-only, no-op refactor, naprawa typo w komentarzu. Nadawanie wyłącznie przez ownera.
- `no-test-needed` — PR pure markup (HTML changes bez logiki), zmiany config. Nadawanie wyłącznie przez ownera.

Etykiety nie są domyślnie zdefiniowane w repo — pierwsze użycie wymaga utworzenia. Owner robi to z UI GitHuba.

## Konsekwencje

Agent (AI lub człowiek) **nie może zmergować PR-a** bez:

1. Zielonych testów
2. Czystego linta i formatu
3. Wpisu w CHANGELOG
4. (Dla zmian kodu) update dokumentacji

To gwarancja mechaniczna, niezależna od pamiętania o dyscyplinie.
