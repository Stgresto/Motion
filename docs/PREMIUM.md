# Motion Premium (15 kr/månad)

Spärren sitter på servern. `api/chat.js` kräver inloggning, aktiv prenumeration, godkänt avtal och max 60 AI-anrop per dag. Stänger vid fel.

## Att göra en gång
1. Kör `supabase/migrations/002_premium.sql` i Supabase SQL editor.
2. Stripe: skapa produkten "Motion Premium" med priset 15 SEK per månad (återkommande). Kopiera price-id (`price_...`).
3. Stripe: Developers → Webhooks → lägg till `https://motionplanner.se/api/stripe-webhook` med händelserna `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Kopiera signeringshemligheten (`whsec_...`).
4. Stripe: Settings → Billing → Customer portal → aktivera (så att användare kan avsluta).
5. Vercel → projektet motion → Environment Variables:
   - `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`
   - `SUPABASE_SERVICE_ROLE_KEY` (hemlig, aldrig i koden)
   - `ANTHROPIC_API_KEY` och `MOTION_LAUNCHED=1` (öppnar AI-coachen)
6. Redeploy.

Avtalsversionen (`CONSENT_V` i app.html och `CONSENT_VERSION` i api/_lib.js) ska ändras om texten ändras. Då måste alla godkänna igen.
