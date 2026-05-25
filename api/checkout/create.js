// Public endpoint: tworzy Stripe Checkout Session dla wybranej konfiguracji.
// Klient nie wybiera ceny — wybiera tylko {line, hardware, addons, period, currency},
// backend szuka odpowiadającego stripe_price_id w DB i tworzy Session z tym Price.
//
// Auth: brak (klient może być niezalogowany; Stripe Checkout zbierze email/dane karty).
// Po sukcesie Stripe wyśle `checkout.session.completed` do naszego webhook (Stage 2),
// który utworzy user/profile/payment.

import Stripe from 'stripe';
import { createSupabaseAdmin } from '../../lib/supabase-admin.js';
import { requireEnv } from '../../lib/env.js';
import { validateCheckoutPayload, stripePriceColumnFor } from '../../lib/checkout.js';

export const config = { api: { bodyParser: false } };

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req)
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  let env;
  try {
    env = requireEnv(['STRIPE_SECRET_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY']);
  } catch (err) {
    console.error('Env config error:', err.message);
    res.status(500).send(`Server misconfiguration: ${err.message}`);
    return;
  }

  let payload;
  try {
    const body = await readJsonBody(req);
    payload = validateCheckoutPayload(body);
  } catch (err) {
    res.status(400).send(`Invalid payload: ${err.message}`);
    return;
  }

  const supabase = createSupabaseAdmin({
    url: env.SUPABASE_URL,
    serviceKey: env.SUPABASE_SERVICE_KEY,
  });

  // Lookup stripe_price_id z DB. Constraint unique(line_id, hardware_combo, addons) gwarantuje 1 row.
  const priceCol = stripePriceColumnFor(payload.period, payload.currency);
  const { data: configRows, error } = await supabase
    .from('product_configurations')
    .select(`hardware_combo, addons, ${priceCol}, product_lines!inner(sku_code)`)
    .eq('hardware_combo', payload.hardware_combo)
    .eq('addons', `{${payload.addons.join(',')}}`)
    .eq('product_lines.sku_code', payload.line_sku)
    .eq('active', true);

  if (error) {
    console.error('checkout lookup failed', { error: error.message });
    res.status(500).send(`Lookup failed: ${error.message}`);
    return;
  }

  if (!configRows || configRows.length === 0) {
    res.status(404).send(`Configuration not found or not active: ${JSON.stringify(payload)}`);
    return;
  }

  const stripePriceId = configRows[0][priceCol];
  if (!stripePriceId) {
    res
      .status(409)
      .send(
        `Stripe price not yet set for this configuration (${payload.period} ${payload.currency}). ` +
          `Admin must run /api/admin/setup-stripe first.`
      );
    return;
  }

  // Create Stripe Checkout Session
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const baseUrl = process.env.PUBLIC_BASE_URL || 'https://vps4u.xyz';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${baseUrl}/dziekujemy?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/konfigurator?line=${payload.line_sku}`,
      // Stripe Tax + customer email zbierany przez Stripe Checkout UI.
      // `customer_creation` nie używamy — dla mode='subscription' Stripe i tak tworzy customer automatycznie
      // (param jest dozwolony tylko dla mode='payment').
      automatic_tax: { enabled: true },
      billing_address_collection: 'required',
      metadata: {
        line_sku: payload.line_sku,
        hardware_combo: payload.hardware_combo,
        addons: payload.addons.join(','),
        period: payload.period,
        currency: payload.currency,
      },
    });

    res.status(200).json({ checkout_url: session.url, session_id: session.id });
  } catch (err) {
    console.error('Stripe session create failed', { error: err.message });
    res.status(502).send(`Stripe error: ${err.message}`);
  }
}
