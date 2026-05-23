// Admin-only: wysyła testowy mail z bieżącymi settings, pomijając alert_log.
// Używane do weryfikacji że Brevo + szablon działają, bez czekania na realny próg.

import { createSupabaseAdmin } from '../../lib/supabase-admin.js';
import { requireAdmin, extractBearerToken, AuthError } from '../../lib/admin-auth.js';
import { sendBrevoEmail } from '../../lib/brevo.js';
import {
  computeQuarterFromDate,
  computeMonthFromDate,
  formatPlnFromGrosze,
} from '../../lib/admin-stats.js';
import { requireEnv } from '../../lib/env.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  let env;
  try {
    env = requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'BREVO_API_KEY']);
  } catch (err) {
    console.error('Env config error:', err.message);
    res.status(500).send(`Server misconfiguration: ${err.message}`);
    return;
  }

  const supabaseConfig = {
    url: env.SUPABASE_URL,
    serviceKey: env.SUPABASE_SERVICE_KEY,
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
    .in('key', ['quarterly_cap', 'monthly_cap', 'alert_email']);

  if (error) {
    res.status(500).send(`Failed to load settings: ${error.message}`);
    return;
  }

  const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
  const quarterlyCap = map.quarterly_cap?.grosze ?? 0;
  const monthlyCap = map.monthly_cap?.grosze ?? 0;
  const to = map.alert_email;

  if (!to) {
    res.status(400).send('alert_email not configured');
    return;
  }

  const periods = [
    {
      label: 'kwartalny',
      key: computeQuarterFromDate(new Date()),
      cap: quarterlyCap,
    },
  ];
  if (monthlyCap > 0) {
    periods.push({
      label: 'miesięczny',
      key: computeMonthFromDate(new Date()),
      cap: monthlyCap,
    });
  }

  try {
    for (const p of periods) {
      await sendBrevoEmail({
        apiKey: env.BREVO_API_KEY,
        to,
        subject: `[TEST] VPS4U: alert ${p.label} — to jest tylko test`,
        htmlContent: `
          <h2>To jest testowy alert ${p.label}</h2>
          <p>Wywołany ręcznie z <a href="https://vps4u.xyz/admin">panelu administracyjnego</a>. Nie zapisany do alert log.</p>
          <p><strong>Okres:</strong> ${p.key}</p>
          <p><strong>Aktualny cap:</strong> ${formatPlnFromGrosze(p.cap)}</p>
          <p style="color:#666;font-size:12px">Jeśli widzisz tę wiadomość — Brevo wysyłka działa.</p>
        `,
      });
    }
  } catch (err) {
    res.status(502).send(`Brevo send failed: ${err.message}`);
    return;
  }

  res.status(200).json({ ok: true, sent_to: to, count: periods.length });
}
