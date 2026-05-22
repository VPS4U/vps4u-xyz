// Frontendowy klient Supabase — używa anon key.
// RLS w bazie pilnuje izolacji danych między userami.
// Zaimportuj jako ES module: import { supabase } from '/lib/supabase.js'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cfg = window.VPS4U_CONFIG;
if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON_KEY) {
  throw new Error('VPS4U_CONFIG missing — załaduj config.js przed lib/supabase.js');
}

export const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
