// User endpoint: deszyfruje SSH credentials konkretnego VPS-a klienta.
// GET /api/me/vps-credentials?id=<vps_instance_id>
//
// Bezpieczeństwo:
// - wymaga Bearer token user'a
// - RLS by tak czy tak nie pozwoliłaby selektować bytes encrypted bez service key
// - my czytamy service key'em ale FILTRUJEMY po user_id = auth.userId (double-check)
// - logujemy każde odczytanie (audit) — Vercel logs zostają
//
// To NIE zwraca metadata VPS-a (tych klient czyta przez RLS bezpośrednio z supabase).
// Tylko plaintext hasła/klucza, po fakcie weryfikacji właściciela.

import { createSupabaseAdmin } from '../../lib/supabase-admin.js';
import { requireUser, extractBearerToken } from '../../lib/admin-auth.js';
import { requireEnv } from '../../lib/env.js';
import { decryptCredentials } from '../../lib/vps-crypto.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }

  let env;
  try {
    env = requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'VPS_CREDENTIALS_KEY']);
  } catch (err) {
    res.status(500).send(`Server misconfiguration: ${err.message}`);
    return;
  }

  const token = extractBearerToken(req.headers);
  let user;
  try {
    user = await requireUser(token, {
      url: env.SUPABASE_URL,
      serviceKey: env.SUPABASE_SERVICE_KEY,
    });
  } catch (err) {
    res.status(err.status || 401).send(err.message);
    return;
  }

  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const vpsId = url.searchParams.get('id');
  if (!vpsId) {
    res.status(400).send('Missing id query param');
    return;
  }

  const supabase = createSupabaseAdmin({
    url: env.SUPABASE_URL,
    serviceKey: env.SUPABASE_SERVICE_KEY,
  });

  const { data: vps, error } = await supabase
    .from('vps_instances')
    .select('id, user_id, ssh_credentials_encrypted, status')
    .eq('id', vpsId)
    .maybeSingle();

  if (error) {
    res.status(500).send(error.message);
    return;
  }
  if (!vps) {
    res.status(404).send('VPS not found');
    return;
  }
  if (vps.user_id !== user.userId) {
    // 404 zamiast 403 — nie ujawniaj że istnieje
    res.status(404).send('VPS not found');
    return;
  }
  if (!vps.ssh_credentials_encrypted) {
    res.status(404).send('Brak zapisanych poświadczeń (VPS jeszcze nie został dostarczony)');
    return;
  }

  let plaintext;
  try {
    // supabase-js zwraca bytea jako string "\\x..." (PostgreSQL hex format) lub base64
    // — sprawdźmy format i konwertujmy do Buffer.
    let blob = vps.ssh_credentials_encrypted;
    if (typeof blob === 'string') {
      if (blob.startsWith('\\x')) {
        blob = Buffer.from(blob.slice(2), 'hex');
      } else {
        blob = Buffer.from(blob, 'base64');
      }
    }
    plaintext = decryptCredentials(blob, env.VPS_CREDENTIALS_KEY);
  } catch (err) {
    console.error('vps credentials decrypt failed', { vpsId, error: err.message });
    res.status(500).send('Decryption failed — skontaktuj się z supportem');
    return;
  }

  console.log('vps credentials revealed', { vpsId, userId: user.userId });
  res.status(200).json({ credentials: plaintext });
}
