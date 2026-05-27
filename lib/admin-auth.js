// Helper do weryfikacji że request pochodzi od zalogowanego admina.
// Webhook'i Stripe używają sygnatury, ale endpointy admin'owe wymagają sesji usera.
// Klient frontend wysyła `Authorization: Bearer <session.access_token>`.

import { createSupabaseAdmin } from './supabase-admin.js';

/**
 * @param {string} bearerToken  JWT z headera `Authorization: Bearer ...`
 * @param {{url: string, serviceKey: string}} supabaseConfig
 * @returns {Promise<{userId: string, email: string}>}
 * @throws gdy token nieważny, user nie istnieje, lub nie jest adminem
 */
export async function requireAdmin(bearerToken, supabaseConfig) {
  if (!bearerToken || typeof bearerToken !== 'string') {
    throw new AuthError(401, 'Missing bearer token');
  }

  const supabase = createSupabaseAdmin(supabaseConfig);

  // Weryfikacja JWT przez Supabase Auth (sprawdza signature + expiry).
  const { data: userData, error: userErr } = await supabase.auth.getUser(bearerToken);
  if (userErr || !userData?.user) {
    throw new AuthError(401, 'Invalid or expired token');
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('is_admin, email')
    .eq('id', userData.user.id)
    .single();

  if (profileErr || !profile?.is_admin) {
    throw new AuthError(403, 'Admin role required');
  }

  return { userId: userData.user.id, email: profile.email };
}

/**
 * Weryfikuje JWT i zwraca user (bez admin check) — dla endpointów user-scoped.
 * @param {string} bearerToken
 * @param {{url: string, serviceKey: string}} supabaseConfig
 * @returns {Promise<{userId: string, email: string}>}
 */
export async function requireUser(bearerToken, supabaseConfig) {
  if (!bearerToken || typeof bearerToken !== 'string') {
    throw new AuthError(401, 'Missing bearer token');
  }
  const supabase = createSupabaseAdmin(supabaseConfig);
  const { data, error } = await supabase.auth.getUser(bearerToken);
  if (error || !data?.user) {
    throw new AuthError(401, 'Invalid or expired token');
  }
  return { userId: data.user.id, email: data.user.email };
}

export class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'AuthError';
  }
}

/**
 * Wyciąga token z `Authorization: Bearer <token>` headera.
 * @param {import('http').IncomingHttpHeaders} headers
 */
export function extractBearerToken(headers) {
  const auth = headers.authorization || headers.Authorization;
  if (!auth || typeof auth !== 'string') return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
