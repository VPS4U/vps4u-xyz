import { describe, it, expect } from 'vitest';
import {
  makeInternalSku,
  buildProductData,
  buildPriceData,
  listPriceVariants,
} from '../../lib/stripe-products.js';

const SAMPLE_CONFIG = {
  line_sku: 'czarny',
  line_marketing_name: 'Cloud Business',
  provider_name: 'Hetzner Cloud (CPX line)',
  hardware_combo: 'L+S+D',
  addons: ['X'],
  vcpu: 4,
  ram_gb: 16,
  disk_gb: 160,
  transfer_tb: 20,
  price_monthly_eur_cents: 4100,
  price_monthly_pln_grosze: 17630,
  price_yearly_eur_cents: 21203,
  price_yearly_pln_grosze: 91173,
};

describe('makeInternalSku', () => {
  it('zwraca format line-hardware[-addons]', () => {
    expect(makeInternalSku(SAMPLE_CONFIG)).toBe('czarny-L+S+D-X');
  });

  it('bez dodatków pomija końcowy segment', () => {
    expect(makeInternalSku({ ...SAMPLE_CONFIG, addons: [] })).toBe('czarny-L+S+D');
  });

  it('sortuje addons alfabetycznie (idempotent SKU)', () => {
    expect(makeInternalSku({ ...SAMPLE_CONFIG, addons: ['X', 'A'] })).toBe('czarny-L+S+D-A,X');
    expect(makeInternalSku({ ...SAMPLE_CONFIG, addons: ['A', 'X'] })).toBe('czarny-L+S+D-A,X');
  });
});

describe('buildProductData', () => {
  it('zwiera nazwę z linią + hardware label + opis addonu', () => {
    const data = buildProductData(SAMPLE_CONFIG);
    expect(data.name).toContain('Cloud Business');
    expect(data.name).toContain('Pro'); // L+S+D = "Pro"
    expect(data.name).toContain('Rozszerzona sieć'); // X
  });

  it('description zawiera specy + dostawcę', () => {
    const data = buildProductData(SAMPLE_CONFIG);
    expect(data.description).toContain('Hetzner');
    expect(data.description).toContain('4 vCPU');
    expect(data.description).toContain('16 GB RAM');
    expect(data.description).toContain('160 GB');
  });

  it('metadata zawiera internal_sku dla idempotency lookupu', () => {
    const data = buildProductData(SAMPLE_CONFIG);
    expect(data.metadata.internal_sku).toBe('czarny-L+S+D-X');
    expect(data.metadata.line_sku).toBe('czarny');
    expect(data.metadata.hardware).toBe('L+S+D');
  });
});

describe('buildPriceData', () => {
  it('monthly EUR — recurring month', () => {
    const price = buildPriceData(SAMPLE_CONFIG, 'monthly', 'eur');
    expect(price).toEqual({
      unit_amount: 4100,
      currency: 'eur',
      recurring: { interval: 'month' },
      lookup_key: 'czarny-L+S+D-X-monthly-eur',
    });
  });

  it('yearly PLN — recurring year', () => {
    const price = buildPriceData(SAMPLE_CONFIG, 'yearly', 'pln');
    expect(price).toEqual({
      unit_amount: 91173,
      currency: 'pln',
      recurring: { interval: 'year' },
      lookup_key: 'czarny-L+S+D-X-yearly-pln',
    });
  });

  it('zwraca null gdy yearly cena nie istnieje', () => {
    const cfg = { ...SAMPLE_CONFIG, price_yearly_eur_cents: null };
    expect(buildPriceData(cfg, 'yearly', 'eur')).toBeNull();
  });
});

describe('listPriceVariants', () => {
  it('zwraca 4 warianty gdy wszystkie ceny obecne', () => {
    const variants = listPriceVariants(SAMPLE_CONFIG);
    expect(variants).toHaveLength(4);
    expect(variants.map((v) => `${v.period}-${v.currency}`).sort()).toEqual([
      'monthly-eur',
      'monthly-pln',
      'yearly-eur',
      'yearly-pln',
    ]);
  });

  it('pomija yearly gdy niedostępne', () => {
    const cfg = { ...SAMPLE_CONFIG, price_yearly_eur_cents: null, price_yearly_pln_grosze: null };
    const variants = listPriceVariants(cfg);
    expect(variants).toHaveLength(2);
    expect(variants.map((v) => v.period)).toEqual(['monthly', 'monthly']);
  });
});
