#!/usr/bin/env node
// Lokalny wariant uruchomienia setupu Stripe (alternatywa dla endpointu /api/admin/setup-stripe).
// Logika w lib/stripe-setup.js — ta sama co używana przez endpoint.
//
// Wymaga env (w `.env.local` lub `process.env`):
//   STRIPE_SECRET_KEY      sk_test_* lub sk_live_*
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY
//
// Run:
//   node --env-file=.env.local scripts/setup-stripe.js
//   DRY_RUN=1 node --env-file=.env.local scripts/setup-stripe.js

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { syncAllConfigurations } from '../lib/stripe-setup.js';

for (const k of ['STRIPE_SECRET_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
  if (!process.env[k]) {
    console.error(`Missing env: ${k}`);
    process.exit(1);
  }
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isLive = process.env.STRIPE_SECRET_KEY.startsWith('sk_live_');
const dryRun = process.env.DRY_RUN === '1';
console.log(`[setup-stripe] Mode: ${isLive ? 'LIVE' : 'TEST'}${dryRun ? ' (DRY-RUN)' : ''}`);

const stats = await syncAllConfigurations({
  stripe,
  supabase,
  dryRun,
  log: (msg) => console.log(`[setup-stripe] ${msg}`),
});

console.log('[setup-stripe] Done:', stats);
