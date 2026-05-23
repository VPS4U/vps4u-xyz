import { describe, it, expect } from 'vitest';
import {
  computeQuarterFromDate,
  computeMonthFromDate,
  sumPaymentsPlnGrosze,
  groupByQuarter,
  groupByMonth,
  formatPlnFromGrosze,
} from '../../lib/admin-stats.js';

describe('computeQuarterFromDate', () => {
  it('zwraca quarter w formacie "Q<N>-<YYYY>"', () => {
    expect(computeQuarterFromDate(new Date('2026-01-15T12:00:00Z'))).toBe('Q1-2026');
    expect(computeQuarterFromDate(new Date('2026-04-01T00:00:00Z'))).toBe('Q2-2026');
    expect(computeQuarterFromDate(new Date('2026-07-31T23:59:59Z'))).toBe('Q3-2026');
    expect(computeQuarterFromDate(new Date('2026-12-31T23:59:59Z'))).toBe('Q4-2026');
  });

  it('akceptuje string ISO', () => {
    expect(computeQuarterFromDate('2026-05-15')).toBe('Q2-2026');
  });
});

describe('computeMonthFromDate', () => {
  it('zwraca miesiąc w formacie YYYY-MM (UTC)', () => {
    expect(computeMonthFromDate(new Date('2026-01-15T12:00:00Z'))).toBe('2026-01');
    expect(computeMonthFromDate(new Date('2026-05-31T23:59:59Z'))).toBe('2026-05');
    expect(computeMonthFromDate(new Date('2026-12-01T00:00:00Z'))).toBe('2026-12');
  });

  it('akceptuje string ISO', () => {
    expect(computeMonthFromDate('2026-07-15')).toBe('2026-07');
  });

  it('pad'.concat('uje miesiąc do dwóch cyfr (np. styczeń → 01)'), () => {
    expect(computeMonthFromDate(new Date('2026-03-15T12:00:00Z'))).toBe('2026-03');
  });
});

describe('sumPaymentsPlnGrosze', () => {
  it('sumuje amount_pln_grosze', () => {
    const payments = [
      { amount_pln_grosze: 1000 },
      { amount_pln_grosze: 2500 },
      { amount_pln_grosze: 12345 },
    ];
    expect(sumPaymentsPlnGrosze(payments)).toBe(15845);
  });

  it('pusta lista = 0', () => {
    expect(sumPaymentsPlnGrosze([])).toBe(0);
  });
});

describe('groupByQuarter', () => {
  it('grupuje płatności po polu quarter i sumuje', () => {
    const payments = [
      { quarter: 'Q1-2026', amount_pln_grosze: 1000 },
      { quarter: 'Q1-2026', amount_pln_grosze: 2000 },
      { quarter: 'Q2-2026', amount_pln_grosze: 5000 },
    ];
    expect(groupByQuarter(payments)).toEqual({
      'Q1-2026': { count: 2, total_pln_grosze: 3000 },
      'Q2-2026': { count: 1, total_pln_grosze: 5000 },
    });
  });

  it('pusta lista = {}', () => {
    expect(groupByQuarter([])).toEqual({});
  });
});

describe('groupByMonth', () => {
  it('grupuje po polu month i sumuje', () => {
    const payments = [
      { month: '2026-05', amount_pln_grosze: 1000 },
      { month: '2026-05', amount_pln_grosze: 2000 },
      { month: '2026-04', amount_pln_grosze: 5000 },
    ];
    expect(groupByMonth(payments)).toEqual({
      '2026-05': { count: 2, total_pln_grosze: 3000 },
      '2026-04': { count: 1, total_pln_grosze: 5000 },
    });
  });

  it('pusta lista = {}', () => {
    expect(groupByMonth([])).toEqual({});
  });
});

describe('formatPlnFromGrosze', () => {
  it('formatuje grosze jako "X,YZ zł"', () => {
    expect(formatPlnFromGrosze(15845)).toBe('158,45 zł');
    expect(formatPlnFromGrosze(100)).toBe('1,00 zł');
    expect(formatPlnFromGrosze(0)).toBe('0,00 zł');
  });

  it('formatuje duże kwoty z separatorami tysięcy (NBSP)', () => {
    // Intl pl-PL używa NBSP (U+00A0) jako separator tysięcy — lepiej dla HTML rendering.
    expect(formatPlnFromGrosze(5000000)).toBe('50 000,00 zł');
    expect(formatPlnFromGrosze(123456789)).toBe('1 234 567,89 zł');
  });
});
