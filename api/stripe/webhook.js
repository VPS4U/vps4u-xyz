// Vercel Function: webhook Stripe.
// Endpoint: POST https://vps4u.xyz/api/stripe/webhook
//
// Odpowiedzialności:
// 1. Odczytuje RAW body (potrzebne do weryfikacji sygnatury)
// 2. Weryfikuje sygnaturę przez Stripe SDK
// 3. Deleguje obsługę eventu do `processStripeEvent` (lib/stripe-webhook.js)
// 4. Wstrzykuje implementacje Supabase / FX jako deps
//
// Env vars:
// - STRIPE_SECRET_KEY (sk_test_* / sk_live_*)
// - STRIPE_WEBHOOK_SECRET (whsec_*)
// - SUPABASE_URL
// - SUPABASE_SERVICE_KEY (service_role JWT, omija RLS)

import Stripe from 'stripe';
import { createSupabaseAdmin } from '../../lib/supabase-admin.js';
import { getEurPlnRate } from '../../lib/fx.js';
import { processStripeEvent } from '../../lib/stripe-webhook.js';

// Modern Vercel Function — używa Web API `Request`.
// `request.text()` zwraca raw body, idealne do weryfikacji sygnatury Stripe.
// Legacy `export const config = { api: { bodyParser: false } }` tu NIE używamy
// — to przełączyłoby funkcję w tryb Node `IncomingMessage`, w którym headers
// nie ma metody `.get()`.

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = request.headers.get('stripe-signature');
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
  }

  const supabase = createSupabaseAdmin({
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  });

  try {
    await processStripeEvent(event, {
      upsertProfileStripeId: async ({ email, stripe_customer_id }) => {
        // Update tylko jeśli profile istnieje (user wcześniej zalogowany przez magic-link).
        // Tworzenie nowego usera z poziomu webhook'a jest planowane w przyszłości (auth.admin.createUser).
        const { error } = await supabase
          .from('profiles')
          .update({ stripe_customer_id })
          .eq('email', email);
        if (error) throw error;
      },

      findProfileByStripeId: async (stripeCustomerId) => {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', stripeCustomerId)
          .maybeSingle();
        if (error) throw error;
        return data;
      },

      insertPayment: async (payment) => {
        const { error } = await supabase.from('payments').insert(payment);
        if (error) {
          // Idempotencja: 23505 = unique_violation na (provider, external_charge_id) → ignoruj.
          if (error.code === '23505') {
            console.log(
              `Payment ${payment.external_charge_id} już istnieje — webhook retry, ignoruję`
            );
            return;
          }
          throw error;
        }
      },

      getEurPlnRate,
    });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook processing failed', { event_id: event.id, error: err.message });
    // Zwracamy 500 — Stripe spróbuje ponownie (do 3 dni z exponential backoff).
    return new Response(`Processing failed: ${err.message}`, { status: 500 });
  }
}
