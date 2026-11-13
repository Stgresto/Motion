// Startar Stripe Checkout för Motion Premium (15 kr/månad). Kräver inloggning och godkända villkor.
import { getUser, hasConsent, okOrigin, stripe, getSub, isActive } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const origin = req.headers.origin || '';
  if (!origin || !okOrigin(origin)) return res.status(403).json({ error: 'Forbidden origin' });
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Logga in först.', code: 'login' });
    if (!(await hasConsent(user.id))) return res.status(402).json({ error: 'Godkänn villkoren först.', code: 'consent' });
    if (isActive(await getSub(user.id))) return res.status(409).json({ error: 'Du har redan Premium.' });
    if (!process.env.STRIPE_PRICE_ID) throw new Error('STRIPE_PRICE_ID saknas');
    const s = await stripe('checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': process.env.STRIPE_PRICE_ID,
      'line_items[0][quantity]': '1',
      client_reference_id: user.id,
      customer_email: user.email || '',
      'subscription_data[metadata][user_id]': user.id,
      success_url: origin + '/app.html#premium/ok',
      cancel_url: origin + '/app.html#premium',
      locale: 'sv',
      allow_promotion_codes: 'true',
    });
    res.status(200).json({ url: s.url });
  } catch (e) {
    res.status(500).json({ error: 'Kunde inte starta betalningen.', detail: String(e.message || e) });
  }
}
