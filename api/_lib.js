// Delad hjälpkod för Premium-spärren. Filer som börjar med _ blir inte egna endpoints i Vercel.
export const CONSENT_VERSION = '2026-11-13';
export const DAILY_LIMIT = 60; // AI-anrop per premium-användare och dag (kostnadsskydd)

const SB_URL = () => process.env.SUPABASE_URL || 'https://prnwanufwqvblsklcraj.supabase.co';
const ANON = () => process.env.SUPABASE_ANON_KEY || '';
const SERVICE = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function okOrigin(origin) {
  return !origin || /^https:\/\/(www\.)?motionplanner\.se$/.test(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
}

// Verifierar användarens JWT mot Supabase Auth. Returnerar {id,email} eller null.
export async function getUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  const r = await fetch(SB_URL() + '/auth/v1/user', { headers: { Authorization: 'Bearer ' + token, apikey: ANON() || SERVICE() } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? { id: u.id, email: u.email } : null;
}

// REST-anrop med service role (kringgår RLS). Används bara på servern.
export async function sb(path, opts = {}) {
  const key = SERVICE();
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY saknas');
  return fetch(SB_URL() + '/rest/v1/' + path, {
    ...opts,
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
}

export async function getSub(userId) {
  const r = await sb(`subscriptions?user_id=eq.${userId}&select=*`);
  const rows = r.ok ? await r.json() : [];
  return rows[0] || null;
}
export function isActive(sub) {
  if (!sub) return false;
  if (!['active', 'trialing'].includes(sub.status)) return false;
  return !sub.current_period_end || new Date(sub.current_period_end) > new Date();
}
export async function hasConsent(userId) {
  const r = await sb(`premium_consent?user_id=eq.${userId}&select=version`);
  const rows = r.ok ? await r.json() : [];
  return !!rows[0] && rows[0].version === CONSENT_VERSION;
}

// Räknar upp dagens användning. Returnerar false om gränsen är nådd.
export async function bumpUsage(userId) {
  const day = new Date().toISOString().slice(0, 10);
  const r = await sb(`ai_usage?user_id=eq.${userId}&day=eq.${day}&select=n`);
  const rows = r.ok ? await r.json() : [];
  const n = rows[0] ? rows[0].n : 0;
  if (n >= DAILY_LIMIT) return false;
  await sb('ai_usage', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ user_id: userId, day, n: n + 1 }) });
  return true;
}

export async function stripe(path, params, method = 'POST') {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY saknas');
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    method,
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : new URLSearchParams(params).toString(),
  });
  const data = await r.json();
  if (!r.ok) throw new Error((data.error && data.error.message) || 'Stripe-fel');
  return data;
}
