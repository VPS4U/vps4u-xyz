// Czysta logika webhook'a Stripe — bez znajomości HTTP ani Supabase.
// Dependency injection (`deps`) sprawia że testy nie potrzebują prawdziwego klienta DB.
// Vercel handler (`api/stripe/webhook.js`) wstrzykuje implementacje używając klienta Supabase.

import { convertEurCentsToPlnGrosze } from './fx.js';

/**
 * @param {object} event  Stripe event object (już po weryfikacji sygnatury)
 * @param {object} deps
 * @param {(args: {email: string, stripe_customer_id: string}) => Promise<void>} deps.upsertProfileStripeId
 * @param {(stripeCustomerId: string) => Promise<{id: string} | null>} deps.findProfileByStripeId
 * @param {(payment: object) => Promise<void>} deps.insertPayment
 * @param {(date: Date) => Promise<{rate: number, table_date: string, source: string}>} deps.getEurPlnRate
 */
export async function processStripeEvent(event, deps) {
  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutCompleted(event.data.object, deps);

    case 'invoice.payment_succeeded':
    case 'charge.succeeded':
      return handleChargeSucceeded(event.data.object, deps);

    default:
      // Nieznany / nieinteresujący event — Stripe wysyła wiele różnych typów.
      return undefined;
  }
}

async function handleCheckoutCompleted(session, deps) {
  const email = session.customer_details?.email;
  const stripeCustomerId = session.customer;

  if (!email || !stripeCustomerId) {
    console.warn('checkout.session.completed bez email lub customer — pomijam', { id: session.id });
    return;
  }

  await deps.upsertProfileStripeId({
    email,
    stripe_customer_id: stripeCustomerId,
  });
}

async function handleChargeSucceeded(obj, deps) {
  // Wspólny kształt dla invoice.payment_succeeded i charge.succeeded:
  // - amount_paid (invoice) lub amount (charge)
  // - charge (invoice) lub id (charge)
  const amountCents = obj.amount_paid ?? obj.amount;
  const externalChargeId = obj.charge ?? obj.id;
  const stripeCustomerId = obj.customer;
  const currency = obj.currency;
  const chargedAt = new Date(obj.created * 1000);
  const subscriptionId = obj.subscription ?? null;

  if (!['eur', 'pln'].includes(currency)) {
    // Log + skip zamiast throw — niewspierane waluty (np. USD z Stripe CLI test fixtures)
    // nie powinny powodować nieskończonego retry przez Stripe.
    console.warn(
      `Unsupported currency ${currency} on charge ${externalChargeId} — pomijam (akceptujemy tylko EUR/PLN)`
    );
    return;
  }

  const profile = await deps.findProfileByStripeId(stripeCustomerId);
  if (!profile) {
    console.warn(
      `Profile not found for stripe_customer_id=${stripeCustomerId} — pomijam płatność ${externalChargeId}`
    );
    return;
  }

  let amountPlnGrosze;
  let fxRate;
  let fxSource;
  let fxTableDate = null;

  if (currency === 'pln') {
    amountPlnGrosze = amountCents;
    fxRate = 1;
    fxSource = 'same';
  } else {
    // EUR → PLN
    const fx = await deps.getEurPlnRate(chargedAt);
    fxRate = fx.rate;
    fxSource = fx.source;
    fxTableDate = fx.table_date;
    amountPlnGrosze = convertEurCentsToPlnGrosze(amountCents, fxRate);
  }

  const inserted = await deps.insertPayment({
    provider: 'stripe',
    external_charge_id: externalChargeId,
    user_id: profile.id,
    subscription_id: subscriptionId,
    amount_cents: amountCents,
    currency,
    amount_pln_grosze: amountPlnGrosze,
    fx_rate: fxRate,
    fx_source: fxSource,
    fx_table_date: fxTableDate,
    charged_at: chargedAt,
  });

  // Threshold check tylko jeśli to nowy wpis (nie duplikat webhook retry).
  // Stage 4 dodaje to wywołanie; przed Stage 4 deps.afterPaymentInserted był undefined.
  if (inserted && deps.afterPaymentInserted) {
    await deps.afterPaymentInserted();
  }
}
