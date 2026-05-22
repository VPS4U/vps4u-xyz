# Changelog

Każdy merge'owany PR ma tu wpis. Format: `## [PR #N] — YYYY-MM-DD` + bullet list zmian. CI wymusza aktualizację tego pliku w każdym PR (poza tymi z labelem `no-docs-needed`).

---

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
