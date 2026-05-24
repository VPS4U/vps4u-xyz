// Pure helpery do budowania Stripe Product/Price data ze schema product_configurations.
// Używane przez scripts/setup-stripe.js (orchestrator nie jest testowalny bez mocków).
//
// Internal SKU = `{line_sku}-{hardware_combo}[-{addons sorted, joined by comma}]`
//   przykład: 'czarny-L+S+D-X' lub 'czarny-base' (bez addonów)
// Lookup key = `{internal_sku}-{period}-{currency}` — używany jako Stripe Price.lookup_key

import { formatHardwareLabel } from './pricing.js';

const ADDON_LABELS = {
  X: 'Rozszerzona sieć',
  A: 'Backup automatyczny',
};

/**
 * @param {object} config  product_configurations row z line_sku
 * @returns {string}
 */
export function makeInternalSku(config) {
  const addons = [...(config.addons ?? [])].sort();
  const addonsPart = addons.length > 0 ? `-${addons.join(',')}` : '';
  return `${config.line_sku}-${config.hardware_combo}${addonsPart}`;
}

/**
 * @param {object} config
 * @returns {{name: string, description: string, metadata: object}}
 */
export function buildProductData(config) {
  const sku = makeInternalSku(config);
  const hardwareLabel = formatHardwareLabel(config.hardware_combo);
  const addonsDesc = (config.addons ?? []).map((a) => ADDON_LABELS[a] ?? a).join(' + ');
  const nameAddon = addonsDesc ? ` + ${addonsDesc}` : '';
  const transferStr = config.transfer_tb
    ? `${config.transfer_tb} TB transfer`
    : 'unlimited transfer';

  return {
    name: `${config.line_marketing_name} ${hardwareLabel}${nameAddon}`,
    description: `${config.provider_name} • ${config.vcpu} vCPU, ${config.ram_gb} GB RAM, ${config.disk_gb} GB NVMe • ${transferStr}`,
    metadata: {
      internal_sku: sku,
      line_sku: config.line_sku,
      hardware: config.hardware_combo,
      addons: (config.addons ?? []).join(','),
    },
  };
}

/**
 * @param {object} config
 * @param {'monthly'|'yearly'} period
 * @param {'eur'|'pln'} currency
 * @returns {object|null}  Stripe Price data lub null jeśli cena nie istnieje
 */
export function buildPriceData(config, period, currency) {
  const amount = getAmount(config, period, currency);
  if (amount == null) return null;

  return {
    unit_amount: amount,
    currency,
    recurring: { interval: period === 'monthly' ? 'month' : 'year' },
    lookup_key: `${makeInternalSku(config)}-${period}-${currency}`,
  };
}

/**
 * Lista wszystkich wariantów (period × currency) dla configa, z pominięciem nullowych cen.
 * @param {object} config
 * @returns {Array<{period: string, currency: string, data: object}>}
 */
export function listPriceVariants(config) {
  const variants = [];
  for (const period of ['monthly', 'yearly']) {
    for (const currency of ['eur', 'pln']) {
      const data = buildPriceData(config, period, currency);
      if (data) variants.push({ period, currency, data });
    }
  }
  return variants;
}

function getAmount(config, period, currency) {
  if (period === 'monthly' && currency === 'eur') return config.price_monthly_eur_cents;
  if (period === 'monthly' && currency === 'pln') return config.price_monthly_pln_grosze;
  if (period === 'yearly' && currency === 'eur') return config.price_yearly_eur_cents;
  if (period === 'yearly' && currency === 'pln') return config.price_yearly_pln_grosze;
  return null;
}
