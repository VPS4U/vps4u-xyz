import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncAllConfigurations } from '../../lib/stripe-setup.js';

// Mock stripe client (tylko 2 metody używane)
function makeStripe() {
  return {
    products: { create: vi.fn(async (data) => ({ id: 'prod_' + data.metadata.internal_sku })) },
    prices: { create: vi.fn(async (data) => ({ id: 'price_' + data.lookup_key })) },
  };
}

// Mock supabase chain — wystarczy update / select dla testów
function makeSupabase(rows) {
  const updates = [];
  return {
    _updates: updates,
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: rows, error: null }),
        }),
      }),
      update: (patch) => ({
        eq: (col, val) => {
          updates.push({ patch, [col]: val });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  };
}

const SAMPLE_ROW = {
  id: 1,
  hardware_combo: 'L',
  addons: [],
  vcpu: 4,
  ram_gb: 8,
  disk_gb: 80,
  transfer_tb: 20,
  price_monthly_eur_cents: 2600,
  price_monthly_pln_grosze: 11180,
  price_yearly_eur_cents: 15827,
  price_yearly_pln_grosze: 68056,
  stripe_product_id: null,
  stripe_price_monthly_eur_id: null,
  stripe_price_monthly_pln_id: null,
  stripe_price_yearly_eur_id: null,
  stripe_price_yearly_pln_id: null,
  product_lines: {
    sku_code: 'czarny',
    marketing_name: 'Cloud Business',
    provider_info: { name: 'Hetzner Cloud (CPX line)' },
  },
};

describe('syncAllConfigurations', () => {
  let stripe, supabase;

  beforeEach(() => {
    stripe = makeStripe();
  });

  it('tworzy product + 4 prices dla świeżego config (wszystkie ID null)', async () => {
    supabase = makeSupabase([SAMPLE_ROW]);
    const stats = await syncAllConfigurations({ stripe, supabase });

    expect(stripe.products.create).toHaveBeenCalledOnce();
    expect(stripe.prices.create).toHaveBeenCalledTimes(4); // monthly EUR/PLN + yearly EUR/PLN
    expect(stats).toEqual({
      products_created: 1,
      products_skipped: 0,
      prices_created: 4,
      prices_skipped: 0,
    });
  });

  it('pomija product gdy stripe_product_id już ustawione (idempotency)', async () => {
    const row = { ...SAMPLE_ROW, stripe_product_id: 'prod_existing' };
    supabase = makeSupabase([row]);
    const stats = await syncAllConfigurations({ stripe, supabase });

    expect(stripe.products.create).not.toHaveBeenCalled();
    expect(stripe.prices.create).toHaveBeenCalledTimes(4);
    expect(stats.products_skipped).toBe(1);
    expect(stats.products_created).toBe(0);
  });

  it('pomija prices gdy stripe_price_*_id już ustawione', async () => {
    const row = {
      ...SAMPLE_ROW,
      stripe_product_id: 'prod_existing',
      stripe_price_monthly_eur_id: 'price_existing_meur',
      stripe_price_monthly_pln_id: 'price_existing_mpln',
    };
    supabase = makeSupabase([row]);
    const stats = await syncAllConfigurations({ stripe, supabase });

    expect(stripe.prices.create).toHaveBeenCalledTimes(2); // tylko yearly
    expect(stats.prices_created).toBe(2);
    expect(stats.prices_skipped).toBe(2);
  });

  it('tylko monthly variants gdy yearly = null (np. combos z addonami)', async () => {
    const row = {
      ...SAMPLE_ROW,
      price_yearly_eur_cents: null,
      price_yearly_pln_grosze: null,
    };
    supabase = makeSupabase([row]);
    const stats = await syncAllConfigurations({ stripe, supabase });

    expect(stripe.prices.create).toHaveBeenCalledTimes(2); // monthly EUR/PLN only
    expect(stats.prices_created).toBe(2);
  });

  it('dryRun=true — wszystkie create pominięte', async () => {
    supabase = makeSupabase([SAMPLE_ROW]);
    const stats = await syncAllConfigurations({ stripe, supabase, dryRun: true });

    expect(stripe.products.create).not.toHaveBeenCalled();
    expect(stripe.prices.create).not.toHaveBeenCalled();
    expect(stats.products_created).toBe(0); // dryRun nie zwiększa created
  });
});
