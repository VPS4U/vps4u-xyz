# Płatności — Stripe + provisioning

Model: **subskrypcje miesięczne** przez Stripe Payment Links, automatyczny provisioning VPS-a po sukcesie płatności.

## Stan obecny

- ✅ Konto Stripe założone (`acct_1TZJdQ3F9d3A69UD`), Test Mode aktywny
- ✅ Stripe MCP autoryzowany dla setupu (czytanie produktów, search docs)
- ✅ **Webhook endpoint zaimplementowany**: `api/stripe/webhook.js` (Vercel function) z weryfikacją sygnatury
- ✅ **Lokalna tabela `payments`** w Supabase z FX conversion EUR→PLN (kurs NBP)
- ❌ Produkty + Payment Links w Stripe — jeszcze nie utworzone
- ❌ Webhook endpoint zarejestrowany w Stripe Dashboard — jeszcze nie podpięty (URL: `https://vps4u.xyz/api/stripe/webhook`)
- ❌ Przyciski na `/rejestracja` mają placeholdery (`REPLACE_WITH_STRIPE_LINK_*`)

## Implementacja webhooka

**Pliki:**
- `lib/stripe-webhook.js` — czysta logika dispatch'a (dependency injection dla testowalności)
- `api/stripe/webhook.js` — Vercel handler: signature verify + raw body + dependency wiring

**Obsługiwane eventy:**
- `checkout.session.completed` — link Stripe customer ID do istniejącego profilu Supabase po email
- `invoice.payment_succeeded` / `charge.succeeded` — insert do `payments` z FX conversion

**Idempotencja:** `unique(provider, external_charge_id)` — webhook retry nie tworzy duplikatów.

**Walidacja walut:** akceptujemy tylko `eur` i `pln`. EUR przeliczane na PLN przez kurs średni NBP tabela A (lib/fx.js).

## Konfiguracja po stronie Stripe (do zrobienia)

## Plan implementacji (oryginalny — kroki pozostałe do zrobienia)

### 1. ~~Założenie konta Stripe~~ ✅ ZROBIONE
- Stripe → Sign up → wybierz **Polska** jako kraj firmy
- Weryfikacja firmy (KRS/CEIDG, IBAN, dokument tożsamości) — Stripe może to weryfikować kilka dni
- W trybie **Test mode** wszystko działa od razu, ale Payment Links produkcyjne wymagają aktywnego konta

### 2. Produkty + Payment Links (6 planów)
Każdy plan z `i18n.jsx:70–77`:

| Plan       | Cena      | Specy                     |
| ---------- | --------- | ------------------------- |
| (do uzupełnienia po stronie Stripe Dashboard)        |

W Stripe Dashboard:
- **Products → Add product** dla każdego planu (nazwa, cena, recurring monthly, EUR)
- **Payment Links → New** dla każdego produktu
  - Włącz **collect email** (potrzebujemy do utworzenia konta)
  - Włącz **collect billing address** (faktury)
  - Włącz **collect tax ID** (B2B z odwrotnym obciążeniem VAT)
  - Success URL: `https://vps4u.xyz/dziekujemy?session_id={CHECKOUT_SESSION_ID}`
  - Metadata na produkcie: `plan_code=starter` (albo cokolwiek wewnętrznego)
- Skopiuj URL Payment Linka → wklej do `i18n.jsx` w odpowiednie miejsce

### 3. Webhook handler — `/api/stripe/webhook.js`

Endpoint odbierający eventy ze Stripe.

```js
// pseudokod, pełna implementacja przy kodowaniu
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // service_role, omija RLS
);

export default async function handler(req, res) {
  // 1. weryfikacja sygnatury
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,                       // RAW body (uwaga: Vercel parsuje JSON — patrz niżej)
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook signature failed: ${err.message}`);
  }

  // 2. dispatch
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionCanceled(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
  }

  return res.status(200).json({ received: true });
}
```

**Uwaga RAW body**: Vercel domyślnie parsuje JSON. Musimy wyłączyć:

```js
export const config = {
  api: { bodyParser: false }
};
```

I czytać body jako buffer (`micro` lub własna funkcja).

### 4. Konfiguracja webhooka po stronie Stripe

Stripe Dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://vps4u.xyz/api/stripe/webhook`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Skopiuj **Signing secret** (`whsec_...`) → wrzuć do Vercela jako `STRIPE_WEBHOOK_SECRET`

### 5. Handler `checkout.session.completed` — szczegóły

```
1. wyciągnij email z session.customer_details.email
2. supabase.auth.admin.createUser({ email, email_confirm: true })
   - jeśli user istnieje, pobierz go zamiast tworzyć (idempotencja!)
3. UPDATE profiles SET stripe_customer_id = session.customer
4. INSERT INTO subscriptions (...)
5. wywołaj Contabo provisioning (POST /api/contabo/provision)
6. INSERT INTO vps_instances (status='provisioning', ...)
7. wyślij mail przez Resend z linkiem do magic-linka i info "VPS będzie gotowy za ~45s"
```

**Idempotencja**: Stripe potrafi wysłać webhook 2x. Każda operacja musi być safe to retry:
- `auth.admin.createUser` — wcześniej sprawdź czy user istnieje
- `INSERT subscriptions` — `ON CONFLICT (stripe_subscription_id) DO NOTHING`
- Contabo provisioning — sprawdź `vps_instances` po `stripe_subscription_id` zanim zawołasz API

### 6. Provisioning Contabo (`/api/contabo/provision.js`)

Wymaga:
- Konto biznesowe Contabo z aktywnym **Cloud API** (oddzielna aktywacja w panelu Contabo)
- OAuth2 client_id + client_secret
- Wybór regionu, image, instance type na podstawie planu

Kolejność:
1. `POST /oauth/token` — pobierz access token (cache 5 min)
2. `POST /v1/compute/instances` — utwórz instancję
3. Long poll albo webhook od Contabo na status `running`
4. `GET /v1/compute/instances/{id}` — pobierz IP
5. UPDATE `vps_instances` z IP, status='running'
6. Mail z dostępami: IP, SSH user (`root`), info że klucz SSH klient wgrał wcześniej (albo my generujemy parę i wysyłamy oba klucze)

**Pytania otwarte do rozstrzygnięcia później:**
- Klucz SSH: klient wgrywa swój w panelu przed płatnością, czy generujemy parę i wysyłamy private key mailem?
  - Rekomendacja: klient wgrywa swój public key na `/panel` przed lub po płatności. Bezpieczniej, brak chowania private key w mailu.
- Co jak Contabo provisioning failuje? Refund automatyczny czy ręczny?
  - Rekomendacja: refund ręczny + alert na Slacka. Failure rate Contabo powinien być rzędu promili.

### 7. Customer Portal (Stripe-hosted)

Dla zarządzania subskrypcją (anulowanie, zmiana karty, faktury) używamy hostowanego portalu Stripe:

```js
// /api/stripe/portal.js
const session = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: 'https://vps4u.xyz/panel'
});
return res.json({ url: session.url });
```

Frontend `/panel` ma przycisk "Zarządzaj subskrypcją" → wołanie `/api/stripe/portal` → redirect na session URL.

**Konfiguracja portalu** (Stripe Dashboard → Settings → Customer Portal):
- ✅ Pozwól anulować subskrypcję
- ✅ Pozwól zmienić plan
- ✅ Faktury — wyświetl historię
- ❌ Pozwól zmienić email (nie, bo to klucz w naszej bazie)

## Testowanie

### Tryb testowy Stripe
Stripe ma dwa zestawy kluczy: **test** i **live**. Wszystko poniżej w test mode:
- Karta sukces: `4242 4242 4242 4242`, dowolna data + CVC
- Karta odrzucona: `4000 0000 0000 0002`
- Karta wymagająca 3DS: `4000 0025 0000 3155`
- Webhook test events: Stripe CLI `stripe trigger checkout.session.completed`

### Stripe CLI dla lokalnego dev
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# tunel z localhost do Stripe, pokaże webhook secret tymczasowy
```

## Zmienne środowiskowe w Vercelu

| Nazwa                    | Wartość                                  | Środowisko       |
| ------------------------ | ---------------------------------------- | ---------------- |
| `STRIPE_SECRET_KEY`      | `sk_live_...` lub `sk_test_...`          | Production/Prev. |
| `STRIPE_WEBHOOK_SECRET`  | `whsec_...` (z Stripe Dashboard)         | Production/Prev. |
| `SUPABASE_URL`           | `https://xxxxx.supabase.co`              | wszędzie         |
| `SUPABASE_SERVICE_KEY`   | `eyJ...` (service_role)                  | Production/Prev. |
| `CONTABO_CLIENT_ID`      | (z panelu Contabo)                       | Production       |
| `CONTABO_CLIENT_SECRET`  | (z panelu Contabo)                       | Production       |
| `RESEND_API_KEY`         | `re_...` (z Resend dashboard)            | Production/Prev. |

Preview deploye używają **test mode** Stripe — żeby nie pomylić się i nie obciążyć prawdziwej karty na PR-ze.

## Monitoring i alerty

- **Stripe Dashboard → Events**: historia wszystkich webhooków, ich kody odpowiedzi
- **Vercel → Logs**: błędy w `/api/stripe/webhook` zobaczysz tutaj
- **Failed webhooks**: Stripe retry automatic do 3 dni z exponential backoff. Po 3 dniach → event jest "permanently failed" i wymaga manualnej interwencji
- Do dorobienia: alert na Slack/email gdy webhook zwraca 5xx więcej niż raz pod rząd
