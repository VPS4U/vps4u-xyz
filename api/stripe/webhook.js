// Vercel Function (Node.js runtime, legacy `req`/`res` style).
// W bare `api/` folder (bez Next.js) Vercel domyślnie używa Node IncomingMessage
// — Web API Request nie jest tu dostępne. Dlatego czytamy headers przez obiekt
// i raw body przez stream (potrzebny do weryfikacji sygnatury Stripe).
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

export const config = {
  api: {
    // Vercel default body parser psuje weryfikację sygnatury — Stripe potrzebuje raw bytes.
    bodyParser: false,
  },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = req.headers['stripe-signature'];
  const rawBody = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    res.status(400).send(`Webhook signature verification failed: ${err.message}`);
    return;
  }

  const supabase = createSupabaseAdmin({
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  });

  try {
    await processStripeEvent(event, {
      upsertProfileStripeId: async ({ email, stripe_customer_id }) => {
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

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook processing failed', { event_id: event.id, error: err.message });
    // Zwracamy 500 — Stripe spróbuje ponownie (do 3 dni z exponential backoff).
    res.status(500).send(`Processing failed: ${err.message}`);
  }
}
