// Admin-only: tworzy/synchronizuje Stripe Products + Prices dla wszystkich aktywnych
// product_configurations. Idempotent (czyta stripe_*_id z DB, pomija jeśli już ustawione).
//
// Uruchamiane przyciskiem w /admin → wywołanie POST z `dry_run=true` lub `dry_run=false`.

import Stripe from 'stripe';
import { createSupabaseAdmin } from '../../lib/supabase-admin.js';
import { requireAdmin, extractBearerToken, AuthError } from '../../lib/admin-auth.js';
import { requireEnv } from '../../lib/env.js';
import { syncAllConfigurations } from '../../lib/stripe-setup.js';

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

  const supabaseConfig = { url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_KEY };

  try {
    await requireAdmin(extractBearerToken(req.headers), supabaseConfig);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).send(err.message);
      return;
    }
    throw err;
  }

  const body = await readJsonBody(req);
  const dryRun = body.dry_run === true;
  const isLive = env.STRIPE_SECRET_KEY.startsWith('sk_live_');

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const supabase = createSupabaseAdmin(supabaseConfig);

  try {
    const stats = await syncAllConfigurations({
      stripe,
      supabase,
      dryRun,
      log: (msg) => console.log(`[setup-stripe] ${msg}`),
    });

    res.status(200).json({
      ok: true,
      mode: isLive ? 'live' : 'test',
      dry_run: dryRun,
      ...stats,
    });
  } catch (err) {
    console.error('setup-stripe failed', { error: err.message });
    res.status(500).send(`Setup failed: ${err.message}`);
  }
}
