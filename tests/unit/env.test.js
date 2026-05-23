import { describe, it, expect, vi, afterEach } from 'vitest';
import { requireEnv } from '../../lib/env.js';

describe('requireEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('zwraca wartości gdy wszystkie zmienne ustawione', () => {
    vi.stubEnv('TEST_A', 'foo');
    vi.stubEnv('TEST_B', 'bar');
    expect(requireEnv(['TEST_A', 'TEST_B'])).toEqual({ TEST_A: 'foo', TEST_B: 'bar' });
  });

  it('rzuca błąd z listą brakujących zmiennych', () => {
    vi.stubEnv('TEST_A', 'foo');
    vi.stubEnv('TEST_B', '');
    expect(() => requireEnv(['TEST_A', 'TEST_B', 'TEST_C'])).toThrow(/TEST_B.*TEST_C/);
  });

  it('traktuje pustą wartość lub same białe znaki jako brakującą', () => {
    vi.stubEnv('TEST_A', '   ');
    expect(() => requireEnv(['TEST_A'])).toThrow(/TEST_A/);
  });

  it('komunikat błędu wskazuje na Vercel Settings', () => {
    expect(() => requireEnv(['TEST_X_UNSET'])).toThrow(/Vercel/i);
  });
});
