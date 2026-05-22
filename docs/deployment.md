# Deployment

## Skrót

- **Hosting**: Vercel, plan Hobby
- **Repo**: github.com/VPS4U/vps4u-xyz
- **Branch produkcyjny**: `main`
- **Deploy**: automatyczny przy każdym push do `main`
- **Preview**: każdy PR dostaje osobny URL typu `vps4u-xyz-git-<branch>-vps4u.vercel.app`
- **Domena**: `vps4u.xyz` (apex) + `www.vps4u.xyz` (redirect do apex)
- **DNS**: Cloudflare (proxy off, tylko DNS)
- **SSL**: automatyczny od Vercela (Let's Encrypt)

## Cykl zmian

```
edycja lokalna
   │
   ▼
git push (branch)
   │
   ▼
PR na GitHubie ──── Vercel buduje preview ────► URL podglądu
   │
   ▼
Code review + test na preview URL
   │
   ▼
Merge do main ──── Vercel buduje production ──► vps4u.xyz live
```

Czas od merge do live: **~30 sekund**.

## Konfiguracja Vercela

### `vercel.json` (w repo)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [...]
}
```

- `cleanUrls: true` — `/o-mnie` zamiast `/o-mnie.html`
- `trailingSlash: false` — `vps4u.xyz/o-mnie`, nie `vps4u.xyz/o-mnie/`
- Cache: HTML `must-revalidate`, CSS/JS godzinny cache

### Build settings (Vercel UI)

- **Framework Preset**: Other
- **Build command**: (puste — nic nie budujemy)
- **Output directory**: (puste — serwujemy z roota)
- **Install command**: (puste — brak `package.json` na razie)

Jak dodamy `/api/*.js` z `package.json`, Vercel sam wykryje Node functions i zainstaluje deps.

### Środowiska

Vercel ma 3 environments:
- **Production**: tylko deploye z brancha `main`
- **Preview**: deploye z każdego innego brancha / PR
- **Development**: lokalny `vercel dev` (nie używamy obecnie)

Env vars są przypisane per środowisko (zob. [architecture.md → sekrety](architecture.md)).

## DNS — Cloudflare

Cloudflare działa tylko jako DNS provider, proxy wyłączone (szare chmurki).

| Type  | Name | Content                | Proxy   |
| ----- | ---- | ---------------------- | ------- |
| A     | `@`  | `76.76.21.21`          | DNS only|
| CNAME | `www`| `cname.vercel-dns.com` | DNS only|
| MX    | ...  | (Hostinger, poczta)    | DNS only|
| TXT   | ...  | (SPF, DKIM, DMARC)     | DNS only|

**Cloudflare SSL/TLS mode**: Full lub Full (strict). Flexible powoduje pętle przekierowań.

### Czemu proxy off
- Vercel sam wystawia certyfikat dla apex — z proxy CF widziałby IP CF, nie userów, weryfikacja by failowała
- Vercel ma własny CDN + DDoS protection, proxy CF byłoby duplikatem
- Cache CF nadpisywałby nasze nagłówki z `vercel.json`

Jak kiedyś chcielibyśmy korzyści proxy CF (firewall rules, rate limiting, analytics) — wymaga konfiguracji "Custom Hostname" w Vercelu lub przejścia na verified domain via TXT (więcej roboty).

## Custom domain — instrukcja podpięcia

Już zrobione, ale dla referencji jak kiedyś będzie trzeba przepiąć:

1. **Vercel → Project Settings → Domains → Add**
   - Wpisz `vps4u.xyz` → wybierz redirect www↔apex
   - Vercel pokaże wymagane rekordy DNS
2. **Cloudflare → DNS → Records**
   - Dodaj/edytuj `A @` i `CNAME www` według wartości z Vercela
   - **Proxy: DNS only** dla obu
3. **Cloudflare → SSL/TLS → Overview**
   - Tryb: Full lub Full (strict)
4. **Czekaj 5–15 min** — Vercel pokaże 🟢 "Valid Configuration"

## Rollback

Każdy deploy w Vercelu zostaje na zawsze (Hobby ma ograniczenie storage, ale starsze są dostępne). Rollback:

1. **Vercel → Deployments**
2. Znajdź ostatni działający deploy
3. **... → Promote to Production**
4. Done w ~5 sekund

Można też `git revert` poprzedniego commita — wtedy auto-deploy zrobi to samo.

## Limity Hobby

| Zasób                    | Limit                                  |
| ------------------------ | -------------------------------------- |
| Bandwidth                | 100 GB / mc                            |
| Build time               | 100 min / mc                           |
| Serverless invocations   | nielimitowane                          |
| Function execution       | 10s / invocation, 1024 MB RAM          |
| Function payload         | 4.5 MB request, 4.5 MB response        |
| Concurrent builds        | 1                                      |
| Deployments              | nielimitowane                          |
| Cron jobs                | 2 (✅ wystarczy nam keepalive + ew. 1 więcej) |

**Limit 10s / function** — Stripe webhook + Contabo provisioning może się zbliżać. Jak będzie ciasno, opcje:
- Webhook tylko queue'uje i zwraca 200, provisioning robi osobna funkcja (np. Edge Function albo background job via QStash)
- Upgrade do Pro ($20/mc) — limit 60s

## Sekrety (env vars)

Dodawanie:
1. Vercel → Project → Settings → Environment Variables
2. Wybierz **Environment**: Production / Preview / Development (albo wszystkie)
3. **Sensitive** = ON dla secret keys
4. Save → trigger redeploy żeby env się załadował

Lista sekretów do skonfigurowania (zob. [architecture.md](architecture.md#sekrety-i-gdzie-żyją)).

## CI/CD

Obecnie: brak GitHub Actions. Vercel sam buduje i deployuje. Nie potrzebujemy tu nic dodatkowego — testów na razie nie ma, lint nie jest wymagany.

Jak będzie potrzeba (lint, testy, security scan):
- GitHub Actions w `.github/workflows/`
- Vercel deploy poczeka na checks przed promote do production (Settings → Git → "Wait for checks")

## Monitoring

- **Vercel → Analytics**: ruch, response times (darmowe podstawowe metryki)
- **Vercel → Logs**: real-time logi z funkcji (3 dni retencji na Hobby)
- **Vercel → Deployments → konkretny deploy → Functions**: per-function stats

Do dorobienia:
- Alert na Slack/email gdy function 5xx error rate > X
- Uptime monitor (BetterStack, UptimeRobot — free tiers)
