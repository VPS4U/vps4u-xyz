// Pure helpery dla cennika produktów. Walidacja inputu z konfiguratora + formatowanie cen.
// Lookup samej ceny robi backend przez query do public.product_configurations
// (potrzebuje supabase clienta — nie pasuje do pure function).

const VALID_HARDWARE = ['base', 'S', 'D', 'S+D', 'L', 'L+S', 'L+D', 'L+S+D'];
const VALID_ADDONS = new Set(['X', 'A']);
const VALID_CURRENCIES = new Set(['eur', 'pln']);
const VALID_PERIODS = new Set(['monthly', 'yearly']);

// Mapowanie hardware_combo → marketing label (z briefu sekcja 3)
const HARDWARE_LABELS = {
  base: 'Starter',
  S: 'Starter RAM+',
  D: 'Starter Disk+',
  'S+D': 'Starter Plus',
  L: 'Performance',
  'L+S': 'Performance RAM+',
  'L+D': 'Performance Disk+',
  'L+S+D': 'Pro',
};

/**
 * @param {string} combo
 * @returns {string} ten sam string jeśli valid
 * @throws gdy invalid
 */
export function normalizeHardwareCombo(combo) {
  if (!VALID_HARDWARE.includes(combo)) {
    throw new Error(
      `Invalid hardware combo: ${combo}. Must be one of ${VALID_HARDWARE.join(', ')}`
    );
  }
  return combo;
}

export function isValidAddon(addon) {
  return typeof addon === 'string' && VALID_ADDONS.has(addon);
}

export function isValidCurrency(currency) {
  return typeof currency === 'string' && VALID_CURRENCIES.has(currency);
}

export function isValidPeriod(period) {
  return typeof period === 'string' && VALID_PERIODS.has(period);
}

/**
 * @param {string} combo
 * @returns {string} marketingowa nazwa lub combo jeśli nieznana
 */
export function formatHardwareLabel(combo) {
  return HARDWARE_LABELS[combo] ?? combo;
}

/**
 * Format PLN z grosze (np. 6450 → "64,50 zł"). Używa Intl pl-PL (NBSP separators).
 * @param {number} grosze
 */
export function formatPricePln(grosze) {
  const pln = grosze / 100;
  const formatted = new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(pln);
  return `${formatted} zł`;
}

/**
 * Format EUR z cents (np. 1500 → "€15.00").
 * @param {number} cents
 */
export function formatPriceEur(cents) {
  const eur = cents / 100;
  return `€${eur.toFixed(2)}`;
}
