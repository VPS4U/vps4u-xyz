import { test, expect } from '@playwright/test';

// Smoke testy które uratowałyby nas przed:
// - PR #14: `return;` na top-level module → SyntaxError → cała strona stuck na loading
// - PR #15: infinite recursion w RLS → 500 ze Supabase
// - przyszłymi błędami JS w inline `<script type="module">`

// Lokalnie używamy `.html` (serve nie ma cleanUrls tak jak Vercel).
// Produkcyjne testy `/panel` są weryfikowane manualnie po deploy.
const PAGES = [
  { name: 'homepage', path: '/index.html' },
  { name: 'panel', path: '/panel.html' },
  { name: 'admin', path: '/admin.html' },
  { name: 'logowanie', path: '/logowanie.html' },
  { name: 'rejestracja', path: '/rejestracja.html' },
];

for (const { name, path } of PAGES) {
  test(`${name}: ładuje się bez błędów JS w konsoli`, async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(path);
    // Dajemy chwilę na uruchomienie async kodu modułu (Supabase calls).
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Filtrujemy known noise:
    // - 404 na favicon
    // - "no session" / "not admin" — intencjonalne throws po `window.location.replace()`,
    //   żeby zatrzymać dalsze wykonanie modułu (alternatywa to wrap w IIFE)
    const KNOWN_NOISE = ['favicon', 'no session', 'not admin'];
    const isNoise = (m) => KNOWN_NOISE.some((noise) => m.includes(noise));

    const realPageErrors = pageErrors.filter((m) => !isNoise(m));
    const realConsoleErrors = consoleErrors.filter(
      (m) => !isNoise(m) && !m.includes('Failed to load resource')
    );

    expect(realPageErrors, `pageerror events for ${name}`).toEqual([]);
    expect(realConsoleErrors, `console.error for ${name}`).toEqual([]);
  });
}
