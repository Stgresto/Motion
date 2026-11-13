// Tar emot Stripe-händelser och uppdaterar prenumerationsstatus i Supabase.
// Stripe -> Developers -> Webhooks: URL https://motionplanner.se/api/stripe-webhook
// Händelser: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
import crypto from 'node:crypto';
import { sb, stripe } from './_lib.js';

export const config = { api: { bodyParser: false } };

const raw = req => new Promise((resolve, reject) => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => resolve(Buffer.concat(c))); req.on('error', reject); });

function verify(buf, header, secret) {
  const parts = Object.fromEntries((header || '').split(',').map(p => p.split('=')));
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const exp = crypto.createHmac('sha256', secret).update(parts.t + '.' + buf.toString('utf8')).digest('hex');
  const a = Buffer.from(exp), b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function save(sub, userId) {
  const row = {
    user_id: userId,
    status: sub.status,
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    current_period_end: (() => { const t = sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end); return t ? new Date(t * 1000).toISOString() : null; })(),
    updated_at: new Date().toISOString(),
  };
  const r = await sb('subscriptions', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(row) });
  if (!r.ok) throw new Error('Supabase ' + r.status);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(500).end();
  const buf = await raw(req);
  if (!verify(buf, req.headers['stripe-signature'], secret)) return res.status(400).json({ error: 'Bad signature' });
  const ev = JSON.parse(buf.toString('utf8'));
  try {
    const o = ev.data.object;
    if (ev.type === 'checkout.session.completed' && o.mode === 'subscription' && o.subscription) {
      const sub = await stripe('subscriptions/' + o.subscription, {}, 'GET');
      await save(sub, o.client_reference_id || (sub.metadata && sub.metadata.user_id));
    } else if (ev.type === 'customer.subscription.updated' || ev.type === 'customer.subscription.deleted') {
      const uid = o.metadata && o.metadata.user_id;
      if (uid) await save(o, uid);
    }
    res.status(200).json({ received: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
