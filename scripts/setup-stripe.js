#!/usr/bin/env node
// One-time setup: tworzy w Stripe Products + Prices dla wszystkich aktywnych
// konfiguracji w bazie. Idempotent — pomija jeśli stripe_*_id już zapisane w DB.
//
// Wymaga env (w `.env.local` lub `process.env`):
//   STRIPE_SECRET_KEY      — sk_test_* dla Test, sk_live_* dla Live mode
//   SUPABASE_URL           — https://<project>.supabase.co
//   SUPABASE_SERVICE_KEY   — service_role JWT
//
// Run:
//   node --env-file=.env.local scripts/setup-stripe.js
//   # lub żeby tylko podejrzeć co będzie wysłane (dry-run):
//   DRY_RUN=1 node --env-file=.env.local scripts/setup-stripe.js
//
// Przy ~90 konfiguracjach × ~3-4 Price = ~360 wywołań Stripe API. ~25/sec test, ~100/sec live.
// Szacunkowy czas: 15-30s w test, <5s w live.

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { buildProductData, listPriceVariants } from '../lib/stripe-products.js';

const env = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
};
for (const [k, v] of Object.entries(env)) {
  if (!v) {
    console.error(`Missing env: ${k}`);
    process.exit(1);
  }
}
const DRY_RUN = process.env.DRY_RUN === '1';
const IS_LIVE = env.STRIPE_SECRET_KEY.startsWith('sk_live_');
console.log(`[setup-stripe] Mode: ${IS_LIVE ? 'LIVE' : 'TEST'}${DRY_RUN ? ' (DRY-RUN)' : ''}`);

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Fetch aktywnych konfiguracji z join'em (line + provider info)
const { data: configs, error } = await supabase
  .from('product_configurations')
  .select(
    `id, hardware_combo, addons, vcpu, ram_gb, disk_gb, transfer_tb,
     price_monthly_eur_cents, price_monthly_pln_grosze,
     price_yearly_eur_cents, price_yearly_pln_grosze,
     stripe_product_id, stripe_price_monthly_eur_id, stripe_price_monthly_pln_id,
     stripe_price_yearly_eur_id, stripe_price_yearly_pln_id,
     product_lines!inner(sku_code, marketing_name, provider_info!inner(name))`
  )
  .eq('active', true)
  .order('id');

if (error) {
  console.error('Failed to load configs:', error.message);
  process.exit(1);
}

console.log(`[setup-stripe] Loaded ${configs.length} active configurations`);

let stats = { products_created: 0, products_skipped: 0, prices_created: 0, prices_skipped: 0 };

for (const cfg of configs) {
  // Flatten join — supabase zwraca product_lines i provider_info zagnieżdżone
  cfg.line_sku = cfg.product_lines.sku_code;
  cfg.line_marketing_name = cfg.product_lines.marketing_name;
  cfg.provider_name = cfg.product_lines.provider_info.name;

  // 1. Product
  let productId = cfg.stripe_product_id;
  if (productId) {
    stats.products_skipped += 1;
  } else {
    const productData = buildProductData(cfg);
    if (DRY_RUN) {
      console.log(`[DRY] product CREATE: ${productData.name}`);
      productId = `prod_DRY_${cfg.id}`;
    } else {
      const product = await stripe.products.create(productData);
      productId = product.id;
      stats.products_created += 1;
      await supabase
        .from('product_configurations')
        .update({ stripe_product_id: productId })
        .eq('id', cfg.id);
    }
  }

  // 2. Prices (4 warianty, niektóre mogą być null)
  const variants = listPriceVariants(cfg);
  for (const { period, currency, data } of variants) {
    const dbCol = `stripe_price_${period}_${currency}_id`;
    if (cfg[dbCol]) {
      stats.prices_skipped += 1;
      continue;
    }
    if (DRY_RUN) {
      console.log(`[DRY] price CREATE: ${data.lookup_key} = ${data.unit_amount} ${currency}`);
      continue;
    }
    const price = await stripe.prices.create({ ...data, product: productId });
    stats.prices_created += 1;
    await supabase
      .from('product_configurations')
      .update({ [dbCol]: price.id })
      .eq('id', cfg.id);
  }
}

console.log('[setup-stripe] Done:', stats);
