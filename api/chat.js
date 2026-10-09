// api/chat.js
// Vercel serverless function — proxies chat requests to Anthropic's API.
// Same pattern as DiaStyle: keeps the API key on the server, never in the browser.
//
// SETUP:
// 1. Put this file at /api/chat.js in your Vercel project (same project as
//    the rest of Motion UF, or a new one — either works).
// 2. In the Vercel dashboard: Project -> Settings -> Environment Variables,
//    add ANTHROPIC_API_KEY with your Anthropic API key as the value.
// 3. Deploy. The AI coach chat on your motion-ai-coach.html page will then
//    call this endpoint automatically (it already tries /api/chat first).
//
// No other setup needed — this file has no dependencies beyond what Vercel
// provides out of the box.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set on the server.' });
    return;
  }

  // Skydd mot missbruk: tillåt bara anrop från vår egen sajt
  const origin = req.headers.origin || '';
  const okOrigin = /^https:\/\/(www\.)?motionplanner\.se$/.test(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  if (origin && !okOrigin) {
    res.status(403).json({ error: 'Forbidden origin' });
    return;
  }

  const { model, max_tokens, system, messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40 || JSON.stringify(messages).length > 6000000) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: (typeof model === 'string' && /^claude-/.test(model)) ? model : 'claude-sonnet-4-6',
        max_tokens: Math.min(Number(max_tokens) || 1200, 3000),
        system: system || undefined,
        messages,
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data.error || 'Upstream error', detail: data });
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reach Anthropic API', detail: String(err) });
  }
}
