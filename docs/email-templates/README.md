---
last_updated: 2026-05-25
---

# Email templates (Supabase Auth)

Polskie szablony do skopiowania do **Supabase Dashboard → Authentication → Email Templates**.

## Jak użyć

1. Otwórz: https://supabase.com/dashboard/project/qwnwxrsdjzyddebovims/auth/templates
2. Dla każdego template:
   - Wybierz template z listy (np. "Magic Link")
   - **Subject heading**: wklej wartość z odpowiedniego pliku (linia "Subject")
   - **Message body**: wklej zawartość HTML z odpowiedniego pliku
   - Save
3. Powtórz dla każdego pliku

## Lista templates

| Plik | Supabase template | Status w VPS4U |
|---|---|---|
| `magic-link.html` | "Magic Link" | ✅ używany przy każdym logowaniu |
| `change-email.html` | "Change Email Address" | używany gdy user zmieni email |
| `invite-user.html` | "Invite User" | używany gdy admin doda usera (np. webhook Stripe na pierwszą wpłatę) |

## Variables Supabase

W HTML użyte:
- `{{ .ConfirmationURL }}` — pełen URL z tokenem (główny link)
- `{{ .Token }}` — 6-cyfrowy kod OTP (alternatywa, nie używamy)
- `{{ .Email }}` — adres odbiorcy

## Style

Inline CSS (większość klientów email nie wspiera `<style>` ani webfontów):
- Background `#0a0a0a` (ink) dla buttona, akcent `#ef4a14` (orange)
- Sans-serif system font stack (Arial fallback w klientach)
- Max width 600px, padding luźny

Po zmianie templates daj znać + test magic-link → mail powinien przyjść z polską treścią od `VPS4U <info@vps4u.xyz>`.
