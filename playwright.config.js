import { defineConfig, devices } from '@playwright/test';

// Strona jest statyczna — testujemy lokalnie przez `npx serve`, z dwoma uwagami:
// 1. `cleanUrls` z vercel.json nie działa lokalnie, więc adresujemy `/panel.html`, nie `/panel`.
// 2. Wywołania Supabase idą do prawdziwego projektu w chmurze (bez sesji = null), więc testy
//    NIE wymagają zalogowanego usera — sprawdzają parse JS, brak crashy, redirect logic.

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Pure static via python3 http.server — brak rewrite, brak cleanUrls.
  // Lokalnie testujemy `.html` paths; prawdziwe cleanUrls Vercel weryfikuje smoke test prod URL.
  webServer: {
    command: 'python3 -m http.server 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
  },
});
