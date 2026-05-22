// FX conversion helper — pobiera kurs średni NBP (tabela A) dla EUR→PLN.
// API NBP: https://api.nbp.pl/  (publiczne, darmowe, bez rate limitów).
// W weekendy i święta tabela danego dnia nie istnieje (404) → bierzemy ostatnią dostępną,
// zgodne z praktyką księgową w PL.

const NBP_BASE = 'https://api.nbp.pl/api/exchangerates/rates/A/EUR';

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * @param {Date} date  data płatności (timestamp)
 * @returns {Promise<{rate: number, table_date: string, source: 'nbp_a'}>}
 */
export async function getEurPlnRate(date) {
  const url = `${NBP_BASE}/${isoDate(date)}/`;
  const res = await fetch(url);

  if (res.status === 404) {
    const fallback = await fetch(`${NBP_BASE}/`);
    if (!fallback.ok) {
      throw new Error(`NBP fallback fetch failed: ${fallback.status}`);
    }
    const data = await fallback.json();
    return { rate: data.rates[0].mid, table_date: data.rates[0].effectiveDate, source: 'nbp_a' };
  }

  if (!res.ok) {
    throw new Error(`NBP API error: ${res.status}`);
  }

  const data = await res.json();
  return { rate: data.rates[0].mid, table_date: data.rates[0].effectiveDate, source: 'nbp_a' };
}

/**
 * Konwersja EUR (cents) → PLN (grosze) po podanym kursie.
 * Math.round = half-up. Wystarczająca precyzja dla cap tracking, dokładność ±0.5 grosza per transakcja.
 *
 * @param {number} eurCents  np. 1000 = 10.00 EUR
 * @param {number} rate      np. 4.3215
 * @returns {number}  grosze (integer)
 */
export function convertEurCentsToPlnGrosze(eurCents, rate) {
  if (eurCents < 0) throw new Error('eurCents must be >= 0');
  if (rate <= 0) throw new Error('rate must be > 0');
  return Math.round(eurCents * rate);
}
