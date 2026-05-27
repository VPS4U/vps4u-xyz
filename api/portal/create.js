// User endpoint: tworzy Stripe Customer Portal session i zwraca redirect URL.
// Klient klika "Zarządzaj płatnościami" w panelu → my robimy POST → Stripe URL → 302 redirect.
//
// Customer Portal pozwala klientowi:
// - zmieniać kartę
// - pobierać paragony (nie faktury VAT — nie obsługujemy)
// - anulować subskrypcję
// - widzieć historię płatności
//
// Wymaga: w Stripe Dashboard → Settings → Billing → Customer Portal włączyć i skonfigurować
// (jakie funkcje są dostępne — minimum: update payment, view invoices, cancel subscription).

import Stripe from 'stripe';
import { createSupabaseAdmin } from '../../lib/supabase-admin.js';
import { requireUser, extractBearerToken } from '../../lib/admin-auth.js';
import { requireEnv } from '../../lib/env.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  let env;
  try {
    env = requireEnv(['STRIPE_SECRET_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY']);
  } catch (err) {
    res.status(500).send(`Server misconfiguration: ${err.message}`);
    return;
  }

  const token = extractBearerToken(req.headers);
  let user;
  try {
    user = await requireUser(token, {
      url: env.SUPABASE_URL,
      serviceKey: env.SUPABASE_SERVICE_KEY,
    });
  } catch (err) {
    res.status(err.status || 401).send(err.message);
    return;
  }

  const supabase = createSupabaseAdmin({
    url: env.SUPABASE_URL,
    serviceKey: env.SUPABASE_SERVICE_KEY,
  });

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.userId)
    .maybeSingle();

  if (!profile?.stripe_customer_id) {
    res
      .status(404)
      .send('Brak konta Stripe — najpierw musisz mieć przynajmniej jedną opłaconą subskrypcję.');
    return;
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const baseUrl = process.env.PUBLIC_BASE_URL || 'https://vps4u.xyz';

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${baseUrl}/panel`,
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('billingPortal create failed', { error: err.message });
    res.status(502).send(`Stripe error: ${err.message}`);
  }
}
