// Period-agnostic threshold checker — działa dla quarter, month (i ew. innych okresów).
// Webhook wywołuje 2× z różnymi konfigami (Stage 6.2).
//
// Flow:
// 1. Walk through thresholds sorted ascending
// 2. Dla każdego progu którego suma już sięga: spróbuj insert do alert_log (atomic, unique constraint)
// 3. Jeśli insert się udał (nie był conflict) — wyślij maila
// 4. Jeśli conflict — already alerted, skip

/**
 * @param {object} args
 * @param {string} args.periodKey            np. 'Q2-2026' lub '2026-05'
 * @param {string} args.periodLabel          np. 'kwartał' / 'miesiąc' (do treści maila)
 * @param {number} args.capGrosze
 * @param {number[]} args.thresholdsPct      np. [50, 80, 100]
 * @param {string} args.alertEmail
 * @param {() => Promise<number>} args.sumPeriodPlnGrosze
 * @param {(args: {periodKey, threshold_pct, amount_pln_grosze, cap_pln_grosze}) => Promise<boolean>} args.tryInsertAlertLog
 *   Returns true jeśli insert się udał, false jeśli conflict (already alerted).
 * @param {(args: {to, periodKey, periodLabel, threshold_pct, amount_pln_grosze, cap_pln_grosze}) => Promise<void>} args.sendAlertEmail
 */
export async function checkAndAlertThresholds({
  periodKey,
  periodLabel,
  capGrosze,
  thresholdsPct,
  alertEmail,
  sumPeriodPlnGrosze,
  tryInsertAlertLog,
  sendAlertEmail,
}) {
  if (!capGrosze || capGrosze <= 0) return;
  if (!Array.isArray(thresholdsPct) || thresholdsPct.length === 0) return;
  if (!alertEmail) return;

  const sum = await sumPeriodPlnGrosze();
  const pct = (sum / capGrosze) * 100;

  const crossed = [...thresholdsPct].sort((a, b) => a - b).filter((t) => pct >= t);

  for (const threshold_pct of crossed) {
    const inserted = await tryInsertAlertLog({
      periodKey,
      threshold_pct,
      amount_pln_grosze: sum,
      cap_pln_grosze: capGrosze,
    });

    if (!inserted) continue;

    await sendAlertEmail({
      to: alertEmail,
      periodKey,
      periodLabel,
      threshold_pct,
      amount_pln_grosze: sum,
      cap_pln_grosze: capGrosze,
    });
  }
}
