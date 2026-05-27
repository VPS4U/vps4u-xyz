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
import {
  formatHardwareLabel,
  formatPricePln,
  formatPriceEur,
  getLineColor,
} from '../../lib/pricing.js';
import { providerForLine } from '../../lib/admin-vps.js';
import { requireEnv } from '../../lib/env.js';

const ADDON_LABELS = { X: 'Rozszerzona sieć', A: 'Automatyczny backup' };

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
        // Sprawdź czy profile istnieje
        const { data: existing, error: lookupErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        if (lookupErr) throw lookupErr;

        // Jeśli brak — utwórz auth user (trigger on_auth_user_created stworzy profile)
        if (!existing) {
          const { error: createErr } = await supabase.auth.admin.createUser({
            email,
            email_confirm: true, // pomijamy weryfikację — Stripe już zweryfikował email płatnością
          });
          if (createErr) {
            // Race: gdy 2 webhooks równolegle, drugi dostanie "already registered" — to OK
            if (!/already.*register|already.*exist|duplicate/i.test(createErr.message)) {
              throw createErr;
            }
          }
        }

        // Update stripe_customer_id (teraz profile na pewno istnieje)
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ stripe_customer_id })
          .eq('email', email);
        if (updateErr) throw updateErr;
      },

      // Po checkout.session.completed: 2 maile (klient + admin) + utworzenie pending vps_instance.
      onOrderConfirmed: async (session) => {
        const meta = session.metadata || {};
        const customerEmail = session.customer_details?.email;

        // Utwórz pending vps_instance — admin zobaczy w /admin do provisioningu.
        // Idempotent: jeśli ten sam stripe session_id już ma vps_instance, skipnij.
        if (meta.line_sku && meta.hardware_combo && customerEmail) {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', customerEmail)
              .maybeSingle();
            const provider = providerForLine(meta.line_sku);
            if (profile && provider) {
              const { data: exists } = await supabase
                .from('vps_instances')
                .select('id')
                .eq('user_id', profile.id)
                .eq('admin_notes', `stripe_session=${session.id}`)
                .maybeSingle();
              if (!exists) {
                const addons = (meta.addons || '').split(',').filter(Boolean);
                const { error: insertErr } = await supabase.from('vps_instances').insert({
                  user_id: profile.id,
                  line_sku: meta.line_sku,
                  hardware_combo: meta.hardware_combo,
                  addons,
                  provider,
                  status: 'pending',
                  admin_notes: `stripe_session=${session.id}`,
                });
                if (insertErr) {
                  console.error('vps_instances insert failed', { error: insertErr.message });
                } else {
                  console.log('vps_instance created (pending)', { session: session.id });
                }
              }
            }
          } catch (err) {
            console.error('vps_instance create failed', { error: err.message });
            // Nie throw — to nie powinno blokować maila potwierdzenia.
          }
        }

        // Pobierz line marketing name + provider z DB
        let lineName = meta.line_sku || 'VPS';
        let providerName = '';
        if (meta.line_sku) {
          const { data: line } = await supabase
            .from('product_lines')
            .select('marketing_name, provider_info!inner(name)')
            .eq('sku_code', meta.line_sku)
            .maybeSingle();
          if (line) {
            lineName = line.marketing_name;
            providerName = line.provider_info?.name || '';
          }
        }

        // Kolor linii — klienci znają stare oznaczenia ("Linia Czarny", "Linia Gold").
        const color = meta.line_sku ? getLineColor(meta.line_sku) : null;
        const lineLabel = color ? `Linia ${color.label}` : lineName;
        const swatchHtml = color
          ? `<span style="display:inline-block;width:14px;height:14px;background:${color.hex};border:1px solid #ccc;vertical-align:middle;margin-right:6px;border-radius:2px;"></span>`
          : '';

        // Surowe kody (L, S, D, X, A) + marketing label w nawiasie.
        const hardwareCombo = meta.hardware_combo || '';
        const hardwareMarketing = hardwareCombo ? formatHardwareLabel(hardwareCombo) : '';
        const addons = (meta.addons || '').split(',').filter(Boolean);
        const addonsCodes = addons.join(' + ');
        const addonsDesc = addons.map((a) => ADDON_LABELS[a] || a).join(' + ');

        const configRaw = hardwareCombo
          ? addonsCodes
            ? `${hardwareCombo} + ${addonsCodes}`
            : hardwareCombo
          : '';
        const configFriendly =
          hardwareMarketing && addonsDesc
            ? `${hardwareMarketing} + ${addonsDesc}`
            : hardwareMarketing || addonsDesc || '';

        const periodLabel = meta.period === 'yearly' ? 'rocznie' : 'miesięcznie';
        const amountFormatted =
          session.currency === 'pln'
            ? formatPricePln(session.amount_total)
            : formatPriceEur(session.amount_total);

        const detailsListHtml = `
          <li><strong>Linia:</strong> ${swatchHtml}${lineLabel}${providerName ? ' — powered by ' + providerName : ''} <span style="color:#666">(${lineName})</span></li>
          <li><strong>Konfiguracja:</strong> <code style="background:#f5f5f5;padding:2px 6px;border-radius:3px">${configRaw}</code>${configFriendly ? ' <span style="color:#666">(' + configFriendly + ')</span>' : ''}</li>
          <li><strong>Okres rozliczeniowy:</strong> ${periodLabel}</li>
          <li><strong>Kwota:</strong> ${amountFormatted}</li>
        `;

        // 1. Klient
        if (customerEmail) {
          try {
            await sendBrevoEmail({
              apiKey: env.BREVO_API_KEY,
              to: customerEmail,
              subject: `Dziękujemy za zamówienie — ${lineLabel} ${configRaw}`,
              htmlContent: `
                <h2>Dziękujemy za zamówienie!</h2>
                <p>Twoja płatność została odebrana. Oto szczegóły:</p>
                <ul>${detailsListHtml}</ul>
                <p>Twój VPS będzie aktywny w ciągu kilku minut. Dostaniesz osobnego maila z dostępami SSH gdy maszyna będzie gotowa.</p>
                <p><a href="https://vps4u.xyz/panel">Zaloguj się do panelu klienta →</a></p>
                <p style="color:#666;font-size:12px">Pytania? Odpisz na ten mail — przeczyta to człowiek.</p>
              `,
            });
            console.log('Customer confirmation email sent', { to: customerEmail });
          } catch (err) {
            console.error('Customer confirmation email failed', { error: err.message });
            // Nie throw — webhook ma return 200 nawet jeśli email nie poszedł
          }
        }

        // 2. Admin (z admin_settings.alert_email)
        try {
          const { data: setting } = await supabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'alert_email')
            .maybeSingle();
          const adminEmail = setting?.value;
          if (!adminEmail) {
            console.warn('Admin notification skip: admin_settings.alert_email is empty');
          } else if (adminEmail === customerEmail) {
            console.warn('Admin notification skip: admin email == customer email', { adminEmail });
          } else {
            await sendBrevoEmail({
              apiKey: env.BREVO_API_KEY,
              to: adminEmail,
              subject: `Nowe zamówienie VPS4U: ${lineLabel} ${configRaw}`,
              htmlContent: `
                <h2>Nowe zamówienie</h2>
                <ul>
                  <li><strong>Klient:</strong> ${customerEmail || 'nieznany'}</li>
                  ${detailsListHtml}
                  <li><strong>Stripe session:</strong> <code>${session.id}</code></li>
                </ul>
                <p><a href="https://vps4u.xyz/admin">Otwórz panel admina →</a></p>
              `,
            });
            console.log('Admin notification email sent', { to: adminEmail });
          }
        } catch (err) {
          console.error('Admin notification email failed', { error: err.message });
        }
      },

      findProfileByStripeId: async (stripeCustomerId) => {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', stripeCustomerId)
          .maybeSingle();
        if (error) throw error;
        if (data) return data;

        // Race recovery: Stripe wysyła checkout.session.completed + invoice.payment_succeeded
        // równolegle. Jeśli invoice przyszło pierwsze, profile jeszcze nie ma stripe_customer_id.
        // Pobieramy email z Stripe i wykonujemy tę samą logikę co upsertProfileStripeId.
        try {
          const customer = await stripe.customers.retrieve(stripeCustomerId);
          const email = customer?.email;
          if (!email) {
            console.warn(`findProfileByStripeId: Stripe customer ${stripeCustomerId} bez email`);
            return null;
          }
          // Find or create profile
          const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();
          if (!existing) {
            const { error: createErr } = await supabase.auth.admin.createUser({
              email,
              email_confirm: true,
            });
            if (
              createErr &&
              !/already.*register|already.*exist|duplicate/i.test(createErr.message)
            ) {
              throw createErr;
            }
          }
          await supabase
            .from('profiles')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('email', email);
          const { data: recovered } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();
          console.log(`findProfileByStripeId: recovered profile for ${email} from Stripe customer`);
          return recovered;
        } catch (err) {
          console.error('findProfileByStripeId recovery failed', { error: err.message });
          return null;
        }
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
