import { test, expect } from '@playwright/test';

// Bez sesji w localStorage, panel i admin powinny redirect do logowania.
// To wykrywa: SyntaxError w skrypcie, hangujący `getSession()`, brakujące redirect, etc.

// Lokalnie używamy `.html` (serve nie ma cleanUrls jak Vercel).
// JS w panel.html robi `window.location.replace('/logowanie')` (bez .html, bo na prodzie cleanUrls);
// lokalnie serve zwróci index.html dla `/logowanie`, ale URL i tak się zmieni — to wystarczy.

test('/panel.html bez sesji → przekierowuje na /logowanie', async ({ page }) => {
  await page.goto('/panel.html');
  await page.waitForURL(/logowanie/, { timeout: 15000 });
  expect(page.url()).toContain('logowanie');
});

test('/admin.html bez sesji → przekierowuje na /logowanie', async ({ page }) => {
  await page.goto('/admin.html');
  await page.waitForURL(/logowanie/, { timeout: 15000 });
  expect(page.url()).toContain('logowanie');
});

test('/panel.html NIE wisi na "Sprawdzanie sesji"', async ({ page }) => {
  // Regression test dla PR #14: przy SyntaxError loading element pozostaje widoczny.
  // Po fixie albo redirect (DOM znika), albo `loading.style.display = 'none'`.
  await page.goto('/panel.html');
  const loading = page.locator('#panel-loading');
  await expect(loading).toBeHidden({ timeout: 15000 });
});
