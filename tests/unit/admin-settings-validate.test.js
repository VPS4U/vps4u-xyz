import { describe, it, expect } from 'vitest';
import { validateSettingsPayload } from '../../lib/admin-settings-validate.js';

describe('validateSettingsPayload', () => {
  const valid = {
    quarterly_cap: { grosze: 5000000, currency: 'pln' },
    alert_thresholds_pct: [50, 80, 100],
    alert_email: 'admin@example.com',
  };

  it('przepuszcza poprawny payload', () => {
    expect(() => validateSettingsPayload(valid)).not.toThrow();
  });

  it('rzuca gdy quarterly_cap.grosze <= 0', () => {
    expect(() =>
      validateSettingsPayload({ ...valid, quarterly_cap: { grosze: 0, currency: 'pln' } })
    ).toThrow(/cap/i);
    expect(() =>
      validateSettingsPayload({ ...valid, quarterly_cap: { grosze: -100, currency: 'pln' } })
    ).toThrow(/cap/i);
  });

  it('rzuca gdy currency != pln', () => {
    expect(() =>
      validateSettingsPayload({ ...valid, quarterly_cap: { grosze: 100, currency: 'eur' } })
    ).toThrow(/currency/i);
  });

  it('rzuca gdy alert_thresholds_pct nie jest niepustą tablicą int 1..100', () => {
    expect(() => validateSettingsPayload({ ...valid, alert_thresholds_pct: [] })).toThrow(
      /thresholds/i
    );
    expect(() => validateSettingsPayload({ ...valid, alert_thresholds_pct: [0, 50] })).toThrow(
      /thresholds/i
    );
    expect(() => validateSettingsPayload({ ...valid, alert_thresholds_pct: [50, 101] })).toThrow(
      /thresholds/i
    );
    expect(() => validateSettingsPayload({ ...valid, alert_thresholds_pct: [50.5] })).toThrow(
      /thresholds/i
    );
    expect(() => validateSettingsPayload({ ...valid, alert_thresholds_pct: 'foo' })).toThrow(
      /thresholds/i
    );
  });

  it('rzuca gdy alert_email nie wygląda jak email', () => {
    expect(() => validateSettingsPayload({ ...valid, alert_email: 'not-an-email' })).toThrow(
      /email/i
    );
    expect(() => validateSettingsPayload({ ...valid, alert_email: '' })).toThrow(/email/i);
  });

  it('rzuca gdy brakuje wymaganego pola', () => {
    expect(() =>
      validateSettingsPayload({ alert_thresholds_pct: [50], alert_email: 'a@b.c' })
    ).toThrow(/quarterly_cap/i);
    expect(() =>
      validateSettingsPayload({ quarterly_cap: valid.quarterly_cap, alert_email: 'a@b.c' })
    ).toThrow(/thresholds/i);
  });

  it('deduplikuje i sortuje thresholds', () => {
    const result = validateSettingsPayload({
      ...valid,
      alert_thresholds_pct: [100, 50, 80, 50],
    });
    expect(result.alert_thresholds_pct).toEqual([50, 80, 100]);
  });
});
