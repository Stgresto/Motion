// Öppnar Stripes kundportal där användaren kan avsluta eller ändra sin prenumeration.
import { getUser, getSub, okOrigin, stripe } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const origin = req.headers.origin || '';
  if (!origin || !okOrigin(origin)) return res.status(403).json({ error: 'Forbidden origin' });
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Logga in först.' });
    const sub = await getSub(user.id);
    if (!sub || !sub.stripe_customer_id) return res.status(404).json({ error: 'Ingen prenumeration hittades.' });
    const s = await stripe('billing_portal/sessions', { customer: sub.stripe_customer_id, return_url: origin + '/app.html#premium' });
    res.status(200).json({ url: s.url });
  } catch (e) {
    res.status(500).json({ error: 'Kunde inte öppna portalen.', detail: String(e.message || e) });
  }
}
