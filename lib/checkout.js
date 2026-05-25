// Walidacja payloadu z konfiguratora + helper do mapowania (period, currency) → kolumna DB.
// Frontend wysyła {line_sku, hardware_combo, addons, period, currency},
// backend mapuje to na konkretne stripe_price_id z product_configurations.

import { normalizeHardwareCombo, isValidAddon, isValidCurrency, isValidPeriod } from './pricing.js';

const VALID_LINES = new Set(['gold', 'orange', 'czarny', 'bialy', 'czerwony', 'niebieski']);

/**
 * @param {object} payload
 * @returns {{line_sku, hardware_combo, addons: string[], period, currency}} normalized
 * @throws Error gdy payload nieprawidłowy
 */
export function validateCheckoutPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be an object');
  }
  if (!VALID_LINES.has(payload.line_sku)) {
    throw new Error(`Invalid line_sku: ${payload.line_sku}`);
  }
  normalizeHardwareCombo(payload.hardware_combo);

  const addons = Array.isArray(payload.addons) ? payload.addons : [];
  for (const a of addons) {
    if (!isValidAddon(a)) throw new Error(`Invalid addon: ${a}`);
  }
  const sortedAddons = [...new Set(addons)].sort();

  if (!isValidPeriod(payload.period)) {
    throw new Error(`Invalid period: ${payload.period} (must be 'monthly' or 'yearly')`);
  }
  if (!isValidCurrency(payload.currency)) {
    throw new Error(`Invalid currency: ${payload.currency} (must be 'eur' or 'pln')`);
  }

  return {
    line_sku: payload.line_sku,
    hardware_combo: payload.hardware_combo,
    addons: sortedAddons,
    period: payload.period,
    currency: payload.currency,
  };
}

/**
 * @param {'monthly'|'yearly'} period
 * @param {'eur'|'pln'} currency
 * @returns {string} nazwa kolumny z stripe_price_*_id
 */
export function stripePriceColumnFor(period, currency) {
  return `stripe_price_${period}_${currency}_id`;
}
