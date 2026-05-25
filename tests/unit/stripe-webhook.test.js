import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processStripeEvent } from '../../lib/stripe-webhook.js';

// Deps to dependency-injection ports — webhook nie zna konkretnego klienta Supabase ani API NBP.
// Vercel handler wstrzykuje prawdziwe implementacje (Supabase + getEurPlnRate).
function makeDeps() {
  return {
    upsertProfileStripeId: vi.fn(),
    findProfileByStripeId: vi.fn(),
    insertPayment: vi.fn().mockResolvedValue(true), // domyślnie: nowy insert (nie duplikat)
    getEurPlnRate: vi.fn(),
    afterPaymentInserted: vi.fn(),
    onOrderConfirmed: vi.fn(),
  };
}

const EUR_INVOICE_EVENT = {
  type: 'invoice.payment_succeeded',
  data: {
    object: {
      id: 'in_test_001',
      customer: 'cus_test_001',
      amount_paid: 1000, // 10.00 EUR
      currency: 'eur',
      created: 1747310400, // 2025-05-15 12:00:00 UTC
      charge: 'ch_test_001',
      subscription: 'sub_test_001',
    },
  },
};

const PLN_INVOICE_EVENT = {
  type: 'invoice.payment_succeeded',
  data: {
    object: {
      id: 'in_test_002',
      customer: 'cus_test_001',
      amount_paid: 4500, // 45.00 PLN
      currency: 'pln',
      created: 1747310400,
      charge: 'ch_test_002',
    },
  },
};

describe('processStripeEvent — invoice.payment_succeeded', () => {
  let deps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it('insertuje płatność EUR z konwersją FX z NBP', async () => {
    deps.findProfileByStripeId.mockResolvedValue({ id: 'user-uuid-1' });
    deps.getEurPlnRate.mockResolvedValue({
      rate: 4.3215,
      table_date: '2025-05-15',
      source: 'nbp_a',
    });

    await processStripeEvent(EUR_INVOICE_EVENT, deps);

    expect(deps.getEurPlnRate).toHaveBeenCalledOnce();
    expect(deps.insertPayment).toHaveBeenCalledWith({
      provider: 'stripe',
      external_charge_id: 'ch_test_001',
      user_id: 'user-uuid-1',
      subscription_id: 'sub_test_001',
      amount_cents: 1000,
      currency: 'eur',
      amount_pln_grosze: 4322,
      fx_rate: 4.3215,
      fx_source: 'nbp_a',
      fx_table_date: '2025-05-15',
      charged_at: expect.any(Date),
    });
  });

  it('insertuje płatność PLN bez konwersji (fx_rate=1, source=same)', async () => {
    deps.findProfileByStripeId.mockResolvedValue({ id: 'user-uuid-1' });

    await processStripeEvent(PLN_INVOICE_EVENT, deps);

    expect(deps.getEurPlnRate).not.toHaveBeenCalled();
    expect(deps.insertPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'pln',
        amount_cents: 4500,
        amount_pln_grosze: 4500,
        fx_rate: 1,
        fx_source: 'same',
        fx_table_date: null,
      })
    );
  });

  it('pomija płatność gdy profil nie znaleziony po stripe_customer_id', async () => {
    deps.findProfileByStripeId.mockResolvedValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await processStripeEvent(EUR_INVOICE_EVENT, deps);

    expect(deps.insertPayment).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/profile not found/i));
    warn.mockRestore();
  });

  it('pomija (z warningiem) płatność w nieobsługiwanej walucie', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const evt = {
      type: 'invoice.payment_succeeded',
      data: {
        object: { ...EUR_INVOICE_EVENT.data.object, currency: 'usd' },
      },
    };

    await processStripeEvent(evt, deps);

    expect(deps.insertPayment).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/usd/i));
    warn.mockRestore();
  });
});

describe('processStripeEvent — threshold callback', () => {
  let deps;

  beforeEach(() => {
    deps = makeDeps();
    deps.findProfileByStripeId.mockResolvedValue({ id: 'user-uuid-1' });
  });

  it('wywołuje afterPaymentInserted po pomyślnym insertcie nowej płatności', async () => {
    deps.insertPayment.mockResolvedValue(true);
    await processStripeEvent(PLN_INVOICE_EVENT, deps);
    expect(deps.afterPaymentInserted).toHaveBeenCalledOnce();
  });

  it('NIE wywołuje afterPaymentInserted gdy płatność była duplikatem (conflict)', async () => {
    deps.insertPayment.mockResolvedValue(false);
    await processStripeEvent(PLN_INVOICE_EVENT, deps);
    expect(deps.afterPaymentInserted).not.toHaveBeenCalled();
  });
});

describe('processStripeEvent — checkout.session.completed', () => {
  let deps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it('aktualizuje stripe_customer_id w profilu istniejącego usera', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_001',
          customer: 'cus_test_001',
          customer_details: { email: 'klient@example.com' },
        },
      },
    };

    await processStripeEvent(event, deps);

    expect(deps.upsertProfileStripeId).toHaveBeenCalledWith({
      email: 'klient@example.com',
      stripe_customer_id: 'cus_test_001',
    });
  });

  it('wywołuje onOrderConfirmed z pełną sesją po upsert profilu', async () => {
    const session = {
      id: 'cs_test_002',
      customer: 'cus_test_002',
      customer_details: { email: 'k@e.com' },
      metadata: {
        line_sku: 'czarny',
        hardware_combo: 'L',
        addons: 'X',
        period: 'monthly',
        currency: 'eur',
      },
      amount_total: 2800,
      currency: 'eur',
    };
    await processStripeEvent(
      { type: 'checkout.session.completed', data: { object: session } },
      deps
    );
    expect(deps.onOrderConfirmed).toHaveBeenCalledWith(session);
  });

  it('NIE wywołuje onOrderConfirmed gdy brak email/customer (skip session)', async () => {
    const session = { id: 'cs_test_003', customer: null, customer_details: null };
    await processStripeEvent(
      { type: 'checkout.session.completed', data: { object: session } },
      deps
    );
    expect(deps.onOrderConfirmed).not.toHaveBeenCalled();
  });
});

describe('processStripeEvent — inne eventy', () => {
  it('ignoruje nieznane event types bez błędu', async () => {
    const deps = makeDeps();
    await expect(
      processStripeEvent({ type: 'customer.created', data: { object: {} } }, deps)
    ).resolves.toBeUndefined();
    expect(deps.insertPayment).not.toHaveBeenCalled();
  });
});
