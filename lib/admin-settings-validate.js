// Walidacja payloadu zmiany ustawień admina. Pure function — łatwo testowalna,
// reused przez /api/admin/settings.js.
//
// Zwraca znormalizowany payload (dedup + sort thresholds) gotowy do upsertu.
// Rzuca błąd z czytelnym komunikatem jeśli payload jest błędny.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCap(value, fieldName) {
  if (!value || typeof value !== 'object') {
    throw new Error(`${fieldName} is required`);
  }
  if (typeof value.grosze !== 'number' || !Number.isInteger(value.grosze) || value.grosze <= 0) {
    throw new Error(`${fieldName}.grosze must be a positive integer`);
  }
  if (value.currency !== 'pln') {
    throw new Error(`${fieldName}.currency must be "pln" (multi-currency not yet supported)`);
  }
  return { grosze: value.grosze, currency: value.currency };
}

function validateThresholds(value, fieldName) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty array`);
  }
  for (const t of value) {
    if (typeof t !== 'number' || !Number.isInteger(t) || t < 1 || t > 100) {
      throw new Error(`${fieldName} entries must be integers 1..100`);
    }
  }
  return [...new Set(value)].sort((a, b) => a - b);
}

export function validateSettingsPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be an object');
  }

  // Kwartalne pola — wymagane (legacy flow z Stage 5).
  const quarterly_cap = validateCap(payload.quarterly_cap, 'quarterly_cap');
  const alert_thresholds_pct = validateThresholds(
    payload.alert_thresholds_pct,
    'alert_thresholds_pct'
  );

  const email = payload.alert_email;
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    throw new Error('alert_email must be a valid email address');
  }

  const result = {
    quarterly_cap,
    alert_thresholds_pct,
    alert_email: email,
  };

  // Miesięczne pola — opcjonalne (Stage 6.1 dodaje walidację, UI dochodzi w 6.3).
  // Jeśli obecne w payloadzie: muszą być prawidłowe. Jeśli nieobecne: pomijamy
  // (endpoint upsertuje tylko klucze z resultu, monthly_* zostają w DB bez zmian).
  // Jeśli któreś z 2 pól jest obecne, to drugie też musi być (parami).
  const hasMonthlyCap = 'monthly_cap' in payload;
  const hasMonthlyThresholds = 'monthly_alert_thresholds_pct' in payload;
  if (hasMonthlyCap !== hasMonthlyThresholds) {
    throw new Error(
      'monthly_cap and monthly_alert_thresholds_pct must be set together (or both omitted)'
    );
  }
  if (hasMonthlyCap) {
    result.monthly_cap = validateCap(payload.monthly_cap, 'monthly_cap');
    result.monthly_alert_thresholds_pct = validateThresholds(
      payload.monthly_alert_thresholds_pct,
      'monthly_alert_thresholds_pct'
    );
  }

  return result;
}
