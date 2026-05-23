// Czysta logika threshold checking — bez Supabase ani Brevo bezpośrednio.
// Webhook (`api/stripe/webhook.js`) wstrzykuje implementacje jako `deps`.
//
// Flow per wywołanie (po każdym successful insercie do `payments`):
// 1. Pobierz settings (cap, thresholds, email)
// 2. Policz aktualną sumę kwartału
// 3. Dla każdego progu którego suma już sięga: spróbuj INSERT do alert_log
// 4. Jeśli insert się udał (nie był conflict) — wyślij maila
// 5. Jeśli był conflict — already alerted, skip

/**
 * @param {object} deps
 * @param {() => Promise<{quarterly_cap: {grosze: number, currency: string}, alert_thresholds_pct: number[], alert_email: string}>} deps.getSettings
 * @param {() => Promise<number>} deps.sumCurrentQuarterPlnGrosze
 * @param {(args: {quarter: string, threshold_pct: number, amount_pln_grosze: number, cap_pln_grosze: number}) => Promise<boolean>} deps.tryInsertAlertLog
 *   Returns true jeśli insert się udał, false jeśli conflict (already alerted).
 * @param {(args: {to: string, threshold_pct: number, amount_pln_grosze: number, cap_pln_grosze: number, quarter: string}) => Promise<void>} deps.sendAlertEmail
 * @param {string} deps.currentQuarter  np. 'Q2-2026'
 */
export async function checkAndAlertThresholds(deps) {
  const settings = await deps.getSettings();
  const cap = settings.quarterly_cap?.grosze ?? 0;
  const thresholds = settings.alert_thresholds_pct ?? [];
  const to = settings.alert_email;

  if (cap <= 0 || thresholds.length === 0 || !to) {
    // Brak konfiguracji — nic nie alertujemy.
    return;
  }

  const sum = await deps.sumCurrentQuarterPlnGrosze();
  const pct = (sum / cap) * 100;

  // Sortujemy progi rosnąco, żeby alerty leciały w naturalnej kolejności.
  const crossed = [...thresholds].sort((a, b) => a - b).filter((t) => pct >= t);

  for (const threshold_pct of crossed) {
    const inserted = await deps.tryInsertAlertLog({
      quarter: deps.currentQuarter,
      threshold_pct,
      amount_pln_grosze: sum,
      cap_pln_grosze: cap,
    });

    if (!inserted) {
      // Already alerted — skip mail.
      continue;
    }

    await deps.sendAlertEmail({
      to,
      threshold_pct,
      amount_pln_grosze: sum,
      cap_pln_grosze: cap,
      quarter: deps.currentQuarter,
    });
  }
}
