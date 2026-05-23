// Walidacja payloadu zmiany ustawień admina. Pure function — łatwo testowalna,
// reused przez /api/admin/settings.js.
//
// Zwraca znormalizowany payload (dedup + sort thresholds) gotowy do upsertu.
// Rzuca błąd z czytelnym komunikatem jeśli payload jest błędny.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSettingsPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be an object');
  }

  // quarterly_cap
  const cap = payload.quarterly_cap;
  if (!cap || typeof cap !== 'object') {
    throw new Error('quarterly_cap is required');
  }
  if (typeof cap.grosze !== 'number' || !Number.isInteger(cap.grosze) || cap.grosze <= 0) {
    throw new Error('quarterly_cap.grosze must be a positive integer');
  }
  if (cap.currency !== 'pln') {
    throw new Error('quarterly_cap.currency must be "pln" (multi-currency not yet supported)');
  }

  // alert_thresholds_pct
  const thresholds = payload.alert_thresholds_pct;
  if (!Array.isArray(thresholds) || thresholds.length === 0) {
    throw new Error('alert_thresholds_pct must be a non-empty array');
  }
  for (const t of thresholds) {
    if (typeof t !== 'number' || !Number.isInteger(t) || t < 1 || t > 100) {
      throw new Error('alert_thresholds_pct entries must be integers 1..100');
    }
  }
  const normalizedThresholds = [...new Set(thresholds)].sort((a, b) => a - b);

  // alert_email
  const email = payload.alert_email;
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    throw new Error('alert_email must be a valid email address');
  }

  return {
    quarterly_cap: { grosze: cap.grosze, currency: cap.currency },
    alert_thresholds_pct: normalizedThresholds,
    alert_email: email,
  };
}
