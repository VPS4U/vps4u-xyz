// Admin-only: wysyła testowy mail z bieżącymi settings, pomijając alert_log.
// Używane do weryfikacji że Brevo + szablon działają, bez czekania na realny próg.

import { createSupabaseAdmin } from '../../lib/supabase-admin.js';
import { requireAdmin, extractBearerToken, AuthError } from '../../lib/admin-auth.js';
import { sendBrevoEmail } from '../../lib/brevo.js';
import { computeQuarterFromDate, formatPlnFromGrosze } from '../../lib/admin-stats.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const supabaseConfig = {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  };

  try {
    await requireAdmin(extractBearerToken(req.headers), supabaseConfig);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).send(err.message);
      return;
    }
    throw err;
  }

  const supabase = createSupabaseAdmin(supabaseConfig);

  const { data, error } = await supabase
    .from('admin_settings')
    .select('key, value')
    .in('key', ['quarterly_cap', 'alert_email']);

  if (error) {
    res.status(500).send(`Failed to load settings: ${error.message}`);
    return;
  }

  const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
  const cap = map.quarterly_cap?.grosze ?? 0;
  const to = map.alert_email;

  if (!to) {
    res.status(400).send('alert_email not configured');
    return;
  }

  try {
    await sendBrevoEmail({
      apiKey: process.env.BREVO_API_KEY,
      to,
      subject: `[TEST] VPS4U: alert kwartalny — to jest tylko test`,
      htmlContent: `
        <h2>To jest testowy alert</h2>
        <p>Wywołany ręcznie z <a href="https://vps4u.xyz/admin">panelu administracyjnego</a>. Nie zapisany do <code>alert_log</code>.</p>
        <p><strong>Bieżący kwartał:</strong> ${computeQuarterFromDate(new Date())}</p>
        <p><strong>Aktualny cap:</strong> ${formatPlnFromGrosze(cap)}</p>
        <p style="color:#666;font-size:12px">Jeśli widzisz tę wiadomość — Brevo wysyłka działa.</p>
      `,
    });
  } catch (err) {
    res.status(502).send(`Brevo send failed: ${err.message}`);
    return;
  }

  res.status(200).json({ ok: true, sent_to: to });
}
