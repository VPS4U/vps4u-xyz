// Smoke test: sprawdza że runner odpala się i ESM imports działają.
// Realne testy helperów dochodzą w Stage 1.

import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('vitest runner działa', () => {
    expect(1 + 1).toBe(2);
  });

  it('Node 20+ ma globalny fetch', () => {
    expect(typeof fetch).toBe('function');
  });
});
