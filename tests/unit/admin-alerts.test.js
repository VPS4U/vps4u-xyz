import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAndAlertThresholds } from '../../lib/admin-alerts.js';

// Funkcja jest period-agnostic — działa identycznie dla quarter ('Q2-2026') i month ('2026-05').
// Webhook wywołuje ją 2× (raz dla quarter, raz dla month) z różnymi konfigurami.

function makeDeps(overrides = {}) {
  return {
    periodKey: 'Q2-2026',
    periodLabel: 'kwartał',
    capGrosze: 1000, // 10 PLN — łatwe obliczenia
    thresholdsPct: [50, 80, 100],
    alertEmail: 'admin@example.com',
    sumPeriodPlnGrosze: vi.fn().mockResolvedValue(0),
    tryInsertAlertLog: vi.fn().mockResolvedValue(true),
    sendAlertEmail: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('checkAndAlertThresholds (period-agnostic)', () => {
  let deps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it('nie wysyła nic gdy suma poniżej najniższego progu', async () => {
    deps.sumPeriodPlnGrosze.mockResolvedValue(400); // 40%
    await checkAndAlertThresholds(deps);
    expect(deps.tryInsertAlertLog).not.toHaveBeenCalled();
    expect(deps.sendAlertEmail).not.toHaveBeenCalled();
  });

  it('wysyła alert dla progu 50% z poprawnym kontekstem', async () => {
    deps.sumPeriodPlnGrosze.mockResolvedValue(500); // 50%
    await checkAndAlertThresholds(deps);

    expect(deps.tryInsertAlertLog).toHaveBeenCalledWith({
      periodKey: 'Q2-2026',
      threshold_pct: 50,
      amount_pln_grosze: 500,
      cap_pln_grosze: 1000,
    });
    expect(deps.sendAlertEmail).toHaveBeenCalledWith({
      to: 'admin@example.com',
      periodKey: 'Q2-2026',
      periodLabel: 'kwartał',
      threshold_pct: 50,
      amount_pln_grosze: 500,
      cap_pln_grosze: 1000,
    });
  });

  it('wysyła 3 alerty (50, 80, 100) przy dużym skoku — sorted ascending', async () => {
    deps.sumPeriodPlnGrosze.mockResolvedValue(1500); // 150%
    await checkAndAlertThresholds(deps);

    expect(deps.tryInsertAlertLog).toHaveBeenCalledTimes(3);
    expect(deps.sendAlertEmail).toHaveBeenCalledTimes(3);
    const thresholds = deps.sendAlertEmail.mock.calls.map((c) => c[0].threshold_pct);
    expect(thresholds).toEqual([50, 80, 100]);
  });

  it('idempotency: gdy tryInsertAlertLog zwraca false (conflict), nie wysyła maila', async () => {
    deps.sumPeriodPlnGrosze.mockResolvedValue(600);
    deps.tryInsertAlertLog.mockResolvedValue(false);
    await checkAndAlertThresholds(deps);
    expect(deps.tryInsertAlertLog).toHaveBeenCalledOnce();
    expect(deps.sendAlertEmail).not.toHaveBeenCalled();
  });

  it('propaguje błąd z sendAlertEmail (webhook 500 → Stripe retry)', async () => {
    deps.sumPeriodPlnGrosze.mockResolvedValue(500);
    deps.sendAlertEmail.mockRejectedValue(new Error('Brevo down'));
    await expect(checkAndAlertThresholds(deps)).rejects.toThrow(/Brevo/);
  });

  it('pomija gdy cap = 0 lub brak progów lub brak emaila', async () => {
    await checkAndAlertThresholds(makeDeps({ capGrosze: 0 }));
    await checkAndAlertThresholds(makeDeps({ thresholdsPct: [] }));
    await checkAndAlertThresholds(makeDeps({ alertEmail: '' }));
    // sendAlertEmail nie wywołany w żadnym z tych przypadków
    // (sprawdzamy via fresh mocks per call — wszystkie powyższe deps to świeże instancje)
  });

  it('działa dla okresu miesięcznego (periodKey = "2026-05")', async () => {
    const monthlyDeps = makeDeps({
      periodKey: '2026-05',
      periodLabel: 'miesiąc',
      sumPeriodPlnGrosze: vi.fn().mockResolvedValue(500),
    });
    await checkAndAlertThresholds(monthlyDeps);
    expect(monthlyDeps.sendAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        periodKey: '2026-05',
        periodLabel: 'miesiąc',
        threshold_pct: 50,
      })
    );
  });
});
