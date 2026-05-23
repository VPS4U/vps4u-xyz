// Wczesne sprawdzanie env vars — żeby brak konfiguracji dawał czytelny błąd 500
// z konkretną zmienną, zamiast późniejszego nieoczywistego "Brevo API 401" itp.
//
// Use:
//   const env = requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'BREVO_API_KEY']);
//   // env.BREVO_API_KEY → gwarantowanie niepuste, otrzymane z process.env

/**
 * @param {string[]} names
 * @returns {Record<string, string>}  mapa name → value
 * @throws Error z listą brakujących zmiennych
 */
export function requireEnv(names) {
  const env = {};
  const missing = [];

  for (const name of names) {
    const value = process.env[name];
    if (!value || typeof value !== 'string' || value.trim() === '') {
      missing.push(name);
    } else {
      env[name] = value;
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `Check Vercel project Settings → Environment Variables.`
    );
  }

  return env;
}
