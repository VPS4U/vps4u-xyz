import { describe, it, expect } from 'vitest';
import {
  normalizeHardwareCombo,
  isValidAddon,
  isValidCurrency,
  isValidPeriod,
  formatHardwareLabel,
  formatPricePln,
  formatPriceEur,
} from '../../lib/pricing.js';

describe('normalizeHardwareCombo', () => {
  it('akceptuje wszystkie dozwolone kombinacje', () => {
    for (const c of ['base', 'S', 'D', 'S+D', 'L', 'L+S', 'L+D', 'L+S+D']) {
      expect(normalizeHardwareCombo(c)).toBe(c);
    }
  });

  it('rzuca dla nieprawidłowej kombinacji', () => {
    expect(() => normalizeHardwareCombo('X+Y')).toThrow(/hardware/i);
    expect(() => normalizeHardwareCombo('')).toThrow(/hardware/i);
    expect(() => normalizeHardwareCombo(null)).toThrow();
  });
});

describe('isValidAddon', () => {
  it('akceptuje X i A', () => {
    expect(isValidAddon('X')).toBe(true);
    expect(isValidAddon('A')).toBe(true);
  });

  it('odrzuca inne', () => {
    expect(isValidAddon('B')).toBe(false);
    expect(isValidAddon('')).toBe(false);
    expect(isValidAddon(null)).toBe(false);
  });
});

describe('isValidCurrency', () => {
  it('akceptuje eur i pln', () => {
    expect(isValidCurrency('eur')).toBe(true);
    expect(isValidCurrency('pln')).toBe(true);
  });

  it('odrzuca inne (case-sensitive)', () => {
    expect(isValidCurrency('EUR')).toBe(false);
    expect(isValidCurrency('usd')).toBe(false);
    expect(isValidCurrency('')).toBe(false);
  });
});

describe('isValidPeriod', () => {
  it('akceptuje monthly i yearly', () => {
    expect(isValidPeriod('monthly')).toBe(true);
    expect(isValidPeriod('yearly')).toBe(true);
  });

  it('odrzuca inne', () => {
    expect(isValidPeriod('weekly')).toBe(false);
    expect(isValidPeriod('')).toBe(false);
  });
});

describe('formatHardwareLabel', () => {
  it('mapuje hardware_combo na czytelne nazwy z briefu', () => {
    expect(formatHardwareLabel('base')).toBe('Starter');
    expect(formatHardwareLabel('S')).toBe('Starter RAM+');
    expect(formatHardwareLabel('D')).toBe('Starter Disk+');
    expect(formatHardwareLabel('S+D')).toBe('Starter Plus');
    expect(formatHardwareLabel('L')).toBe('Performance');
    expect(formatHardwareLabel('L+S')).toBe('Performance RAM+');
    expect(formatHardwareLabel('L+D')).toBe('Performance Disk+');
    expect(formatHardwareLabel('L+S+D')).toBe('Pro');
  });

  it('fallback dla nieznanej kombinacji', () => {
    expect(formatHardwareLabel('foo')).toBe('foo');
  });
});

describe('formatPricePln', () => {
  it('formatuje grosze jako PLN z separatorem dziesiętnym', () => {
    expect(formatPricePln(6450)).toBe('64,50 zł');
    expect(formatPricePln(100)).toBe('1,00 zł');
    expect(formatPricePln(0)).toBe('0,00 zł');
  });

  it('formatuje duże kwoty z separatorami tysięcy (NBSP)', () => {
    // Intl pl-PL używa NBSP (U+00A0) jako separator tysięcy — wymuszamy w stringu literałem unicode
    expect(formatPricePln(158240)).toBe('1\u00A0582,40 zł');
  });
});

describe('formatPriceEur', () => {
  it('formatuje cents jako EUR', () => {
    expect(formatPriceEur(1500)).toBe('€15.00');
    expect(formatPriceEur(3650)).toBe('€36.50');
    expect(formatPriceEur(0)).toBe('€0.00');
  });
});
