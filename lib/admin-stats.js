// Pure helpers do agregacji płatności w admin dashboardzie.
// Wszystko bezstanowe i deterministyczne — łatwe testy unitowe.

/**
 * Format używany w kolumnie `payments.quarter` (ustawianej przez trigger).
 * @param {Date|string} date
 * @returns {string}  np. 'Q2-2026'
 */
export function computeQuarterFromDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${q}-${d.getUTCFullYear()}`;
}

/**
 * Format używany w kolumnie `payments.month` (ustawianej przez trigger, Stage 6.1).
 * @param {Date|string} date
 * @returns {string}  np. '2026-05'
 */
export function computeMonthFromDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * @param {Array<{amount_pln_grosze: number}>} payments
 * @returns {number}  suma w groszach
 */
export function sumPaymentsPlnGrosze(payments) {
  return payments.reduce((sum, p) => sum + p.amount_pln_grosze, 0);
}

/**
 * @param {Array<{quarter: string, amount_pln_grosze: number}>} payments
 * @returns {Record<string, {count: number, total_pln_grosze: number}>}
 */
export function groupByQuarter(payments) {
  return groupByKey(payments, 'quarter');
}

/**
 * @param {Array<{month: string, amount_pln_grosze: number}>} payments
 * @returns {Record<string, {count: number, total_pln_grosze: number}>}
 */
export function groupByMonth(payments) {
  return groupByKey(payments, 'month');
}

function groupByKey(payments, keyField) {
  const groups = {};
  for (const p of payments) {
    const k = p[keyField];
    if (!groups[k]) {
      groups[k] = { count: 0, total_pln_grosze: 0 };
    }
    groups[k].count += 1;
    groups[k].total_pln_grosze += p.amount_pln_grosze;
  }
  return groups;
}

/**
 * Formatowanie groszy jako "X,YZ zł" (z separatorami tysięcy).
 * Używa Intl.NumberFormat dla poprawnej lokalizacji.
 * @param {number} grosze
 * @returns {string}
 */
export function formatPlnFromGrosze(grosze) {
  const pln = grosze / 100;
  const formatted = new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(pln);
  return `${formatted} zł`;
}
