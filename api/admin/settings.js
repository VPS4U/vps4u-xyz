// Endpoint admin-only do edycji admin_settings.
// Auth: `Authorization: Bearer <session.access_token>` (frontend bierze z supabase.auth.getSession).
// PUT body: { quarterly_cap, alert_thresholds_pct, alert_email } — schema w lib/admin-settings-validate.js.

import { createSupabaseAdmin } from '../../lib/supabase-admin.js';
import { requireAdmin, extractBearerToken, AuthError } from '../../lib/admin-auth.js';
import { validateSettingsPayload } from '../../lib/admin-settings-validate.js';

export const config = { api: { bodyParser: false } };

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req)
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return null;
  return JSON.parse(raw);
}

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.status(405).send('Method not allowed');
    return;
  }

  const supabaseConfig = {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  };

  // 1. Auth
  try {
    await requireAdmin(extractBearerToken(req.headers), supabaseConfig);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).send(err.message);
      return;
    }
    throw err;
  }

  // 2. Parse + validate
  let payload;
  try {
    const body = await readJsonBody(req);
    payload = validateSettingsPayload(body);
  } catch (err) {
    res.status(400).send(`Invalid payload: ${err.message}`);
    return;
  }

  // 3. Upsert do admin_settings (service_role omija RLS)
  const supabase = createSupabaseAdmin(supabaseConfig);
  const rows = [
    { key: 'quarterly_cap', value: payload.quarterly_cap },
    { key: 'alert_thresholds_pct', value: payload.alert_thresholds_pct },
    { key: 'alert_email', value: payload.alert_email },
  ];

  for (const row of rows) {
    const { error } = await supabase.from('admin_settings').upsert(row, { onConflict: 'key' });
    if (error) {
      console.error('admin_settings upsert failed', { key: row.key, error: error.message });
      res.status(500).send(`Failed to update ${row.key}: ${error.message}`);
      return;
    }
  }

  res.status(200).json({ ok: true, settings: payload });
}
