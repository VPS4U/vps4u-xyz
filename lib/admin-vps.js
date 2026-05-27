// Logika pure dla admin provisioning workflow.
// DI: wszystkie operacje DB i side-effects (mail) przekazywane jako deps.
// Endpoint api/admin/vps-instances.js wstrzykuje supabase + sendMail.

import { encryptCredentials } from './vps-crypto.js';

const VALID_PROVIDERS = new Set([
  'hetzner_cx',
  'hetzner_cpx',
  'contabo',
  'hostinger',
  'ovh_value',
  'ovh_comfort',
]);

// Mapowanie linia (sku) → provider enum w vps_instances
const LINE_TO_PROVIDER = {
  gold: 'hetzner_cx',
  orange: 'contabo',
  czarny: 'hetzner_cpx',
  bialy: 'hostinger',
  czerwony: 'ovh_value',
  niebieski: 'ovh_comfort',
};

export function providerForLine(lineSku) {
  return LINE_TO_PROVIDER[lineSku] || null;
}

/**
 * Walidacja payloadu dla create/update vps_instance.
 * @returns {object} znormalizowany payload
 * @throws Error gdy invalid
 */
export function validateVpsPayload(input) {
  if (!input || typeof input !== 'object') throw new Error('payload must be object');

  const out = {};

  if (input.provider !== undefined) {
    if (!VALID_PROVIDERS.has(input.provider)) {
      throw new Error(`provider must be one of ${[...VALID_PROVIDERS].join(', ')}`);
    }
    out.provider = input.provider;
  }
  if (input.provider_instance_id !== undefined)
    out.provider_instance_id = String(input.provider_instance_id).trim();
  if (input.ipv4 !== undefined) out.ipv4 = String(input.ipv4).trim() || null;
  if (input.ipv6 !== undefined) out.ipv6 = String(input.ipv6).trim() || null;
  if (input.ssh_user !== undefined) out.ssh_user = String(input.ssh_user).trim() || 'root';
  if (input.hostname !== undefined) out.hostname = String(input.hostname).trim() || null;
  if (input.admin_notes !== undefined) out.admin_notes = String(input.admin_notes);

  return out;
}

/**
 * Mark VPS as delivered: encrypt credentials, set status=active, provisioned_at=now, send mail.
 * Idempotent: jeśli już active, zwraca obecny stan bez modyfikacji.
 */
export async function markVpsDelivered({ id, fields, sshCredentials, deps }) {
  const { supabase, encryptionKey, sendDeliveryEmail } = deps;

  const { data: existing, error: fetchErr } = await supabase
    .from('vps_instances')
    .select('id, user_id, line_sku, hardware_combo, addons, provider, status')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!existing) throw new Error(`vps_instance ${id} not found`);
  if (existing.status === 'active') {
    return { id, already_active: true };
  }

  const update = {
    ...fields,
    status: 'active',
    provisioned_at: new Date().toISOString(),
  };
  if (sshCredentials) {
    update.ssh_credentials_encrypted = encryptCredentials(sshCredentials, encryptionKey);
  }

  const { data: updated, error: updateErr } = await supabase
    .from('vps_instances')
    .update(update)
    .eq('id', id)
    .select(
      'id, user_id, line_sku, hardware_combo, addons, provider, ipv4, ipv6, ssh_user, hostname, provisioned_at'
    )
    .single();
  if (updateErr) throw updateErr;

  // Pobierz email klienta — wymagane do wysłki maila z dostępami
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', existing.user_id)
    .maybeSingle();

  if (profile?.email && sendDeliveryEmail) {
    await sendDeliveryEmail({
      to: profile.email,
      vps: updated,
      sshCredentials, // plaintext do mail body — jednorazowo, po stronie admina po zapisaniu
    });
  }

  return { id, delivered: true };
}

/**
 * Lista płatności bez vps_instance — to są "do provisioning".
 */
export async function listPendingProvisioning(supabase) {
  // payments LEFT JOIN vps_instances — gdzie brak vps_instance.id.
  // Supabase JS client nie obsługuje LEFT JOIN bezpośrednio dobrze — zamiast tego 2 query.
  const { data: vpsRows, error: vpsErr } = await supabase
    .from('vps_instances')
    .select('payment_id')
    .not('payment_id', 'is', null);
  if (vpsErr) throw vpsErr;
  const usedPaymentIds = new Set((vpsRows || []).map((r) => r.payment_id));

  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('id, user_id, amount_cents, currency, charged_at, profiles!inner(email)')
    .order('charged_at', { ascending: false })
    .limit(100);
  if (payErr) throw payErr;

  return (payments || []).filter((p) => !usedPaymentIds.has(p.id));
}
