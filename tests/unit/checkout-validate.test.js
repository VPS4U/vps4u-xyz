import { describe, it, expect } from 'vitest';
import { validateCheckoutPayload, stripePriceColumnFor } from '../../lib/checkout.js';

const valid = {
  line_sku: 'czarny',
  hardware_combo: 'L+S+D',
  addons: ['X'],
  period: 'monthly',
  currency: 'eur',
};

describe('validateCheckoutPayload', () => {
  it('przepuszcza poprawny payload', () => {
    const result = validateCheckoutPayload(valid);
    expect(result).toEqual(valid);
  });

  it('normalizuje brakujące addons jako []', () => {
    const result = validateCheckoutPayload({ ...valid, addons: undefined });
    expect(result.addons).toEqual([]);
  });

  it('sortuje addons (idempotent lookup)', () => {
    const result = validateCheckoutPayload({ ...valid, addons: ['X', 'A'] });
    expect(result.addons).toEqual(['A', 'X']);
  });

  it('rzuca dla nieprawidłowej linii', () => {
    expect(() => validateCheckoutPayload({ ...valid, line_sku: 'fake' })).toThrow(/line/i);
  });

  it('rzuca dla nieprawidłowego hardware', () => {
    expect(() => validateCheckoutPayload({ ...valid, hardware_combo: 'XYZ' })).toThrow(/hardware/i);
  });

  it('rzuca dla nieprawidłowego addonu', () => {
    expect(() => validateCheckoutPayload({ ...valid, addons: ['Z'] })).toThrow(/addon/i);
  });

  it('rzuca dla nieprawidłowej waluty', () => {
    expect(() => validateCheckoutPayload({ ...valid, currency: 'usd' })).toThrow(/currency/i);
  });

  it('rzuca dla nieprawidłowego okresu', () => {
    expect(() => validateCheckoutPayload({ ...valid, period: 'weekly' })).toThrow(/period/i);
  });

  it('rzuca gdy payload nie jest obiektem', () => {
    expect(() => validateCheckoutPayload(null)).toThrow();
    expect(() => validateCheckoutPayload('foo')).toThrow();
  });
});

describe('stripePriceColumnFor', () => {
  it('zwraca poprawną nazwę kolumny', () => {
    expect(stripePriceColumnFor('monthly', 'eur')).toBe('stripe_price_monthly_eur_id');
    expect(stripePriceColumnFor('monthly', 'pln')).toBe('stripe_price_monthly_pln_id');
    expect(stripePriceColumnFor('yearly', 'eur')).toBe('stripe_price_yearly_eur_id');
    expect(stripePriceColumnFor('yearly', 'pln')).toBe('stripe_price_yearly_pln_id');
  });
});
