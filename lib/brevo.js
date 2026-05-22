// Cienki helper na Brevo Transactional Email API.
// API key przekazywany explicite (nie sięga do process.env), żeby było łatwo testowalne.
// W produkcji caller (np. webhook Stripe) przekazuje process.env.BREVO_API_KEY.

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const DEFAULT_SENDER = { name: 'VPS4U', email: 'info@vps4u.xyz' };

/**
 * @param {object} args
 * @param {string} args.apiKey
 * @param {string} args.to
 * @param {string} args.subject
 * @param {string} args.htmlContent
 * @param {{name: string, email: string}} [args.sender]  default: VPS4U <info@vps4u.xyz>
 * @returns {Promise<{messageId: string}>}
 */
export async function sendBrevoEmail({ apiKey, to, subject, htmlContent, sender }) {
  if (!apiKey) throw new Error('apiKey is required');
  if (!to) throw new Error('to is required');
  if (!subject) throw new Error('subject is required');
  if (!htmlContent) throw new Error('htmlContent is required');

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: sender ?? DEFAULT_SENDER,
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });

  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      // ignore parse error
    }
    throw new Error(`Brevo API ${res.status}: ${body}`);
  }

  return res.json();
}
