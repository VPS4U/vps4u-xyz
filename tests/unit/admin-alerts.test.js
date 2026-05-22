import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAndAlertThresholds } from '../../lib/admin-alerts.js';

// Dependency injection — testy nie potrzebują Supabase ani Brevo.
// W produkcji webhook wstrzykuje prawdziwe implementacje.
function makeDeps(overrides = {}) {
  return {
    getSettings: vi.fn().mockResolvedValue({
      quarterly_cap: { grosze: 1000, currency: 'pln' }, // 10 PLN dla łatwych obliczeń
      alert_thresholds_pct: [50, 80, 100],
      alert_email: 'admin@example.com',
    }),
    sumCurrentQuarterPlnGrosze: vi.fn().mockResolvedValue(0),
    tryInsertAlertLog: vi.fn().mockResolvedValue(true), // true = wstawiono (alert leci)
    sendAlertEmail: vi.fn().mockResolvedValue(undefined),
    currentQuarter: 'Q2-2026',
    ...overrides,
  };
}

describe('checkAndAlertThresholds', () => {
  let deps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it('nie wysyła nic gdy suma jest poniżej najniższego progu', async () => {
    deps.sumCurrentQuarterPlnGrosze.mockResolvedValue(400); // 40% z 1000

    await checkAndAlertThresholds(deps);

    expect(deps.tryInsertAlertLog).not.toHaveBeenCalled();
    expect(deps.sendAlertEmail).not.toHaveBeenCalled();
  });

  it('wysyła alert dla progu 50% gdy próg został przekroczony', async () => {
    deps.sumCurrentQuarterPlnGrosze.mockResolvedValue(500); // 50% z 1000

    await checkAndAlertThresholds(deps);

    expect(deps.tryInsertAlertLog).toHaveBeenCalledWith({
      quarter: 'Q2-2026',
      threshold_pct: 50,
      amount_pln_grosze: 500,
      cap_pln_grosze: 1000,
    });
    expect(deps.sendAlertEmail).toHaveBeenCalledOnce();
    expect(deps.sendAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        threshold_pct: 50,
        amount_pln_grosze: 500,
        cap_pln_grosze: 1000,
        quarter: 'Q2-2026',
      })
    );
  });

  it('wysyła alert dla wielu progów jednocześnie przy dużym skoku', async () => {
    deps.sumCurrentQuarterPlnGrosze.mockResolvedValue(1000); // 100% — przekracza 50, 80, 100

    await checkAndAlertThresholds(deps);

    expect(deps.tryInsertAlertLog).toHaveBeenCalledTimes(3);
    expect(deps.sendAlertEmail).toHaveBeenCalledTimes(3);
    const thresholds = deps.sendAlertEmail.mock.calls.map((c) => c[0].threshold_pct);
    // Kod sortuje progi rosnąco, więc alerty lecą w kolejności 50 → 80 → 100.
    expect(thresholds).toEqual([50, 80, 100]);
  });

  it('NIE wysyła alertu po raz drugi (idempotencja przez alert_log)', async () => {
    deps.sumCurrentQuarterPlnGrosze.mockResolvedValue(600);
    // Pierwsza próba insertu zwraca false (conflict — wpis już istnieje).
    deps.tryInsertAlertLog.mockResolvedValue(false);

    await checkAndAlertThresholds(deps);

    expect(deps.tryInsertAlertLog).toHaveBeenCalledOnce();
    expect(deps.sendAlertEmail).not.toHaveBeenCalled();
  });

  it('jeśli sendAlertEmail rzuca błąd, propaguje go (webhook zwróci 500 → Stripe retry)', async () => {
    deps.sumCurrentQuarterPlnGrosze.mockResolvedValue(500);
    deps.sendAlertEmail.mockRejectedValue(new Error('Brevo down'));

    await expect(checkAndAlertThresholds(deps)).rejects.toThrow(/Brevo/);
  });

  it('pomija gdy cap = 0 lub brak (deska zabezpieczająca)', async () => {
    deps.getSettings.mockResolvedValue({
      quarterly_cap: { grosze: 0, currency: 'pln' },
      alert_thresholds_pct: [50, 80, 100],
      alert_email: 'admin@example.com',
    });
    deps.sumCurrentQuarterPlnGrosze.mockResolvedValue(500);

    await checkAndAlertThresholds(deps);

    expect(deps.sendAlertEmail).not.toHaveBeenCalled();
  });
});
