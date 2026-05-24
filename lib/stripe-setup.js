// Orchestrator dla one-time setupu Stripe Products+Prices.
// Wywoływany przez:
//   - api/admin/setup-stripe.js (endpoint, env z Vercela)
//   - scripts/setup-stripe.js (CLI, env z .env.local)
//
// Idempotent: czyta stripe_*_id z DB, tworzy tylko brakujące.

import { buildProductData, listPriceVariants } from './stripe-products.js';

/**
 * @param {object} args
 * @param {import('stripe').default} args.stripe        — Stripe client (live lub test)
 * @param {object} args.supabase                        — Supabase service-role client
 * @param {boolean} [args.dryRun=false]                 — true = nic nie wywołuje, tylko zlicza co BYŁOBY utworzone
 * @param {(msg: string) => void} [args.log=console.log]
 * @returns {Promise<{products_created, products_skipped, prices_created, prices_skipped, is_live}>}
 */
export async function syncAllConfigurations({ stripe, supabase, dryRun = false, log = () => {} }) {
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

  if (error) throw new Error(`Failed to load configs: ${error.message}`);

  log(`Loaded ${configs.length} active configurations`);

  const stats = {
    products_created: 0,
    products_skipped: 0,
    prices_created: 0,
    prices_skipped: 0,
  };

  for (const cfg of configs) {
    // Flatten join — Supabase zwraca zagnieżdżone obiekty
    cfg.line_sku = cfg.product_lines.sku_code;
    cfg.line_marketing_name = cfg.product_lines.marketing_name;
    cfg.provider_name = cfg.product_lines.provider_info.name;

    // 1. Product
    let productId = cfg.stripe_product_id;
    if (productId) {
      stats.products_skipped += 1;
    } else if (dryRun) {
      log(`[DRY] product CREATE: ${buildProductData(cfg).name}`);
    } else {
      const productData = buildProductData(cfg);
      const product = await stripe.products.create(productData);
      productId = product.id;
      stats.products_created += 1;
      await supabase
        .from('product_configurations')
        .update({ stripe_product_id: productId })
        .eq('id', cfg.id);
    }

    // 2. Prices (2-4 wariantów)
    const variants = listPriceVariants(cfg);
    for (const { period, currency, data } of variants) {
      const dbCol = `stripe_price_${period}_${currency}_id`;
      if (cfg[dbCol]) {
        stats.prices_skipped += 1;
        continue;
      }
      if (dryRun) {
        log(`[DRY] price CREATE: ${data.lookup_key} = ${data.unit_amount} ${currency}`);
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

  return stats;
}
