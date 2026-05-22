// Klient Supabase z service_role key — używany w serverless functions (np. webhook Stripe).
// **Omija RLS** — wszystkie operacje wykonują się jako superuser.
// service_role key NIGDY nie ląduje w przeglądarce; tylko Vercel env vars.

import { createClient } from '@supabase/supabase-js';

/**
 * @param {object} args
 * @param {string} args.url           Supabase project URL
 * @param {string} args.serviceKey    service_role JWT
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createSupabaseAdmin({ url, serviceKey } = {}) {
  if (!url) throw new Error('url is required');
  if (!serviceKey) throw new Error('serviceKey is required');

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
