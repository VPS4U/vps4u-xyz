// Admin endpoint do zarządzania ręcznym provisioning VPS-ów.
// GET  → lista pending (płatności bez vps_instance) + active VPS-y
// POST /:id  → mark delivered (encrypt creds, status=active, send mail)

import { createSupabaseAdmin } from '../../lib/supabase-admin.js';
import { requireAdmin } from '../../lib/admin-auth.js';
import { requireEnv } from '../../lib/env.js';
import { sendBrevoEmail } from '../../lib/brevo.js';
import {
  validateVpsPayload,
  markVpsDelivered,
  listPendingProvisioning,
} from '../../lib/admin-vps.js';
import { formatHardwareLabel, getLineColor } from '../../lib/pricing.js';

export const config = { api: { bodyParser: false } };

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req)
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function buildDeliveryEmailHtml({ vps, sshCredentials }) {
  const color = vps.line_sku ? getLineColor(vps.line_sku) : null;
  const lineLabel = color ? `Linia ${color.label}` : vps.line_sku;
  const hardwareLabel = formatHardwareLabel(vps.hardware_combo);
  const swatch = color
    ? `<span style="display:inline-block;width:14px;height:14px;background:${color.hex};border:1px solid #ccc;vertical-align:middle;margin-right:6px;border-radius:2px;"></span>`
    : '';

  return `
    <h2>Twój VPS jest gotowy 🚀</h2>
    <p>Maszyna została uruchomiona — możesz się zalogować.</p>
    <ul>
      <li><strong>Linia:</strong> ${swatch}${lineLabel}</li>
      <li><strong>Konfiguracja:</strong> <code>${vps.hardware_combo}</code> (${hardwareLabel})</li>
      ${vps.ipv4 ? `<li><strong>IPv4:</strong> <code>${vps.ipv4}</code></li>` : ''}
      ${vps.ipv6 ? `<li><strong>IPv6:</strong> <code>${vps.ipv6}</code></li>` : ''}
      <li><strong>SSH:</strong> <code>ssh ${vps.ssh_user || 'root'}@${vps.ipv4 || vps.hostname}</code></li>
      ${vps.hostname ? `<li><strong>Hostname:</strong> <code>${vps.hostname}</code></li>` : ''}
    </ul>
    ${
      sshCredentials
        ? `<div style="margin:20px 0; padding:14px; background:#fff8e1; border-left:4px solid #f59e0b">
        <strong>⚠️ Dane logowania (jednorazowy mail — zapisz je):</strong>
        <pre style="margin:8px 0 0; font-family:'JetBrains Mono',monospace; font-size:12px; white-space:pre-wrap; word-break:break-all">${sshCredentials.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])}</pre>
        <p style="margin:8px 0 0; font-size:12px; color:#666">Po pierwszym logowaniu <strong>natychmiast zmień hasło</strong> komendą <code>passwd</code> lub wgraj swój klucz SSH i wyłącz logowanie hasłem.</p>
      </div>`
        : ''
    }
    <p>Pełna kontrola w <a href="https://vps4u.xyz/panel">panelu klienta</a> — historia płatności, zmiana karty, anulowanie.</p>
    <p style="color:#666;font-size:12px">Pytania? Odpisz na ten mail.</p>
  `;
}

export default async function handler(req, res) {
  let env;
  try {
    env = requireEnv([
      'SUPABASE_URL',
      'SUPABASE_SERVICE_KEY',
      'SUPABASE_ANON_KEY',
      'BREVO_API_KEY',
      'VPS_CREDENTIALS_KEY',
    ]);
  } catch (err) {
    res.status(500).send(`Server misconfiguration: ${err.message}`);
    return;
  }

  // Auth: bearer token + admin check
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    res.status(401).send('Missing Bearer token');
    return;
  }

  try {
    await requireAdmin(token, {
      url: env.SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY,
      serviceKey: env.SUPABASE_SERVICE_KEY,
    });
  } catch (err) {
    res.status(403).send(`Not authorized: ${err.message}`);
    return;
  }

  const supabase = createSupabaseAdmin({
    url: env.SUPABASE_URL,
    serviceKey: env.SUPABASE_SERVICE_KEY,
  });

  if (req.method === 'GET') {
    try {
      const [{ data: instances }, pending] = await Promise.all([
        supabase
          .from('vps_instances')
          .select(
            'id, user_id, payment_id, line_sku, hardware_combo, addons, provider, provider_instance_id, ipv4, ipv6, ssh_user, hostname, status, provisioned_at, admin_notes, created_at, profiles!inner(email)'
          )
          .order('created_at', { ascending: false })
          .limit(200),
        listPendingProvisioning(supabase),
      ]);
      res.status(200).json({ instances: instances || [], pending });
    } catch (err) {
      console.error('GET vps-instances failed', err);
      res.status(500).send(err.message);
    }
    return;
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      res.status(400).send('Invalid JSON');
      return;
    }

    // POST { action: 'deliver', id, fields, ssh_credentials }
    if (body.action === 'deliver') {
      if (!body.id) {
        res.status(400).send('id required');
        return;
      }
      let fields;
      try {
        fields = validateVpsPayload(body.fields || {});
      } catch (err) {
        res.status(400).send(err.message);
        return;
      }

      try {
        const result = await markVpsDelivered({
          id: body.id,
          fields,
          sshCredentials: body.ssh_credentials || null,
          deps: {
            supabase,
            encryptionKey: env.VPS_CREDENTIALS_KEY,
            sendDeliveryEmail: async ({ to, vps, sshCredentials }) => {
              await sendBrevoEmail({
                apiKey: env.BREVO_API_KEY,
                to,
                subject: 'Twój VPS jest gotowy — dostępy w środku',
                htmlContent: buildDeliveryEmailHtml({ vps, sshCredentials }),
              });
            },
          },
        });
        res.status(200).json({ ok: true, ...result });
      } catch (err) {
        console.error('deliver vps failed', err);
        res.status(500).send(err.message);
      }
      return;
    }

    res.status(400).send('Unknown action');
    return;
  }

  res.status(405).send('Method not allowed');
}
