// Vercel Function (Node.js runtime, legacy `req`/`res` style).
// W bare `api/` folder (bez Next.js) Vercel domyślnie używa Node IncomingMessage
// — Web API Request nie jest tu dostępne. Dlatego czytamy headers przez obiekt
// i raw body przez stream (potrzebny do weryfikacji sygnatury Stripe).
//
// Env vars:
// - STRIPE_SECRET_KEY (sk_test_* / sk_live_*)
// - STRIPE_WEBHOOK_SECRET (whsec_*)
// - SUPABASE_URL
// - SUPABASE_SERVICE_KEY (service_role JWT, omija RLS)

import Stripe from 'stripe';
import { createSupabaseAdmin } from '../../lib/supabase-admin.js';
import { getEurPlnRate } from '../../lib/fx.js';
import { processStripeEvent } from '../../lib/stripe-webhook.js';
import { checkAndAlertThresholds } from '../../lib/admin-alerts.js';
import { sendBrevoEmail } from '../../lib/brevo.js';
import {
  computeQuarterFromDate,
  computeMonthFromDate,
  formatPlnFromGrosze,
} from '../../lib/admin-stats.js';
import { requireEnv } from '../../lib/env.js';

export const config = {
  api: {
    // Vercel default body parser psuje weryfikację sygnatury — Stripe potrzebuje raw bytes.
    bodyParser: false,
  },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  let env;
  try {
    env = requireEnv([
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_KEY',
      'BREVO_API_KEY',
    ]);
  } catch (err) {
    console.error('Env config error:', err.message);
    res.status(500).send(`Server misconfiguration: ${err.message}`);
    return;
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const signature = req.headers['stripe-signature'];
  const rawBody = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    res.status(400).send(`Webhook signature verification failed: ${err.message}`);
    return;
  }

  const supabase = createSupabaseAdmin({
    url: env.SUPABASE_URL,
    serviceKey: env.SUPABASE_SERVICE_KEY,
  });

  try {
    await processStripeEvent(event, {
      upsertProfileStripeId: async ({ email, stripe_customer_id }) => {
        const { error } = await supabase
          .from('profiles')
          .update({ stripe_customer_id })
          .eq('email', email);
        if (error) throw error;
      },

      findProfileByStripeId: async (stripeCustomerId) => {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', stripeCustomerId)
          .maybeSingle();
        if (error) throw error;
        return data;
      },

      insertPayment: async (payment) => {
        const { error } = await supabase.from('payments').insert(payment);
        if (error) {
          // Idempotencja: 23505 = unique_violation na (provider, external_charge_id) → ignoruj.
          if (error.code === '23505') {
            console.log(
              `Payment ${payment.external_charge_id} już istnieje — webhook retry, ignoruję`
            );
            return false;
          }
          throw error;
        }
        return true;
      },

      getEurPlnRate,

      // Threshold check po każdym nowym insertcie. Stage 6.2: dwa poziomy (quarter + month).
      afterPaymentInserted: async () => {
        const currentQuarter = computeQuarterFromDate(new Date());
        const currentMonth = computeMonthFromDate(new Date());

        // Jeden fetch settings — używany przez oba poziomy.
        const { data: settingsData, error: settingsErr } = await supabase
          .from('admin_settings')
          .select('key, value')
          .in('key', [
            'quarterly_cap',
            'alert_thresholds_pct',
            'monthly_cap',
            'monthly_alert_thresholds_pct',
            'alert_email',
          ]);
        if (settingsErr) throw settingsErr;
        const s = Object.fromEntries(settingsData.map((r) => [r.key, r.value]));
        const alertEmail = s.alert_email;

        // Helper: tworzy callbacki dla danego poziomu (period).
        const buildPeriodDeps = ({
          periodKey,
          periodLabel,
          paymentsColumn,
          alertTable,
          alertColumn,
          capGrosze,
          thresholdsPct,
        }) => ({
          periodKey,
          periodLabel,
          capGrosze,
          thresholdsPct,
          alertEmail,
          sumPeriodPlnGrosze: async () => {
            const { data, error } = await supabase
              .from('payments')
              .select('amount_pln_grosze')
              .eq(paymentsColumn, periodKey);
            if (error) throw error;
            return data.reduce((sum, p) => sum + Number(p.amount_pln_grosze), 0);
          },
          tryInsertAlertLog: async ({
            periodKey: pk,
            threshold_pct,
            amount_pln_grosze,
            cap_pln_grosze,
          }) => {
            const { error } = await supabase.from(alertTable).insert({
              [alertColumn]: pk,
              threshold_pct,
              amount_pln_grosze,
              cap_pln_grosze,
            });
            if (error) {
              if (error.code === '23505') return false;
              throw error;
            }
            return true;
          },
          sendAlertEmail: async ({
            to,
            periodKey: pk,
            periodLabel: pl,
            threshold_pct,
            amount_pln_grosze,
            cap_pln_grosze,
          }) => {
            await sendBrevoEmail({
              apiKey: env.BREVO_API_KEY,
              to,
              subject: `VPS4U: ${pl} ${pk} — przekroczono ${threshold_pct}% capu`,
              htmlContent: `
                <h2>Cap ${pl}owy: próg ${threshold_pct}% osiągnięty</h2>
                <p><strong>Okres (${pl}):</strong> ${pk}</p>
                <p><strong>Suma wpłat:</strong> ${formatPlnFromGrosze(amount_pln_grosze)}</p>
                <p><strong>Cap:</strong> ${formatPlnFromGrosze(cap_pln_grosze)}</p>
                <p><strong>Wykorzystanie:</strong> ${((amount_pln_grosze / cap_pln_grosze) * 100).toFixed(1)}%</p>
                <p style="color:#666; font-size:12px">Alert automatyczny po webhook Stripe. Zobacz <a href="https://vps4u.xyz/admin">panel administracyjny</a>.</p>
              `,
            });
          },
        });

        // 1. Kwartalny check
        await checkAndAlertThresholds(
          buildPeriodDeps({
            periodKey: currentQuarter,
            periodLabel: 'kwartał',
            paymentsColumn: 'quarter',
            alertTable: 'alert_log',
            alertColumn: 'quarter',
            capGrosze: s.quarterly_cap?.grosze,
            thresholdsPct: s.alert_thresholds_pct,
          })
        );

        // 2. Miesięczny check (Stage 6.2). Jeśli monthly_cap nie ma w settings — pomijamy.
        if (s.monthly_cap && s.monthly_alert_thresholds_pct) {
          await checkAndAlertThresholds(
            buildPeriodDeps({
              periodKey: currentMonth,
              periodLabel: 'miesiąc',
              paymentsColumn: 'month',
              alertTable: 'monthly_alert_log',
              alertColumn: 'month',
              capGrosze: s.monthly_cap.grosze,
              thresholdsPct: s.monthly_alert_thresholds_pct,
            })
          );
        }
      },
    });

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook processing failed', { event_id: event.id, error: err.message });
    // Zwracamy 500 — Stripe spróbuje ponownie (do 3 dni z exponential backoff).
    res.status(500).send(`Processing failed: ${err.message}`);
  }
}
