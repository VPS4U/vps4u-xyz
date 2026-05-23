import { describe, it, expect } from 'vitest';
import { validateSettingsPayload } from '../../lib/admin-settings-validate.js';

describe('validateSettingsPayload', () => {
  const valid = {
    quarterly_cap: { grosze: 5000000, currency: 'pln' },
    alert_thresholds_pct: [50, 80, 100],
    alert_email: 'admin@example.com',
    monthly_cap: { grosze: 2000000, currency: 'pln' },
    monthly_alert_thresholds_pct: [50, 80, 100],
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

  it('rzuca gdy monthly_cap.grosze <= 0', () => {
    expect(() =>
      validateSettingsPayload({ ...valid, monthly_cap: { grosze: 0, currency: 'pln' } })
    ).toThrow(/monthly_cap/i);
  });

  it('rzuca gdy monthly_alert_thresholds_pct nie jest niepustą tablicą int 1..100', () => {
    expect(() => validateSettingsPayload({ ...valid, monthly_alert_thresholds_pct: [] })).toThrow(
      /monthly.*thresholds/i
    );
    expect(() =>
      validateSettingsPayload({ ...valid, monthly_alert_thresholds_pct: [101] })
    ).toThrow(/monthly.*thresholds/i);
  });

  it('deduplikuje i sortuje monthly_alert_thresholds_pct', () => {
    const result = validateSettingsPayload({
      ...valid,
      monthly_alert_thresholds_pct: [100, 50, 75, 50],
    });
    expect(result.monthly_alert_thresholds_pct).toEqual([50, 75, 100]);
  });

  it('rzuca gdy tylko jedno z monthly_cap / monthly_thresholds jest obecne (parami)', () => {
    const { monthly_cap, ...withoutMonthlyCap } = valid;
    void monthly_cap;
    expect(() => validateSettingsPayload(withoutMonthlyCap)).toThrow(/monthly_cap/i);

    const { monthly_alert_thresholds_pct, ...withoutMonthlyThresh } = valid;
    void monthly_alert_thresholds_pct;
    expect(() => validateSettingsPayload(withoutMonthlyThresh)).toThrow(/monthly/i);
  });

  it('przepuszcza payload BEZ monthly_* (backward-compat dla Stage 5 UI)', () => {
    const { monthly_cap, monthly_alert_thresholds_pct, ...withoutMonthly } = valid;
    void monthly_cap;
    void monthly_alert_thresholds_pct;
    const result = validateSettingsPayload(withoutMonthly);
    expect(result.monthly_cap).toBeUndefined();
    expect(result.monthly_alert_thresholds_pct).toBeUndefined();
    expect(result.quarterly_cap).toBeDefined();
  });
});
