// /api/collect.js
export default async function handler(req, res) {
  try {
    // Health check for envs (GET)
    if (req.method === 'GET' && (req.query?.health === '1')) {
      return res.status(200).json({
        ok: true,
        hasEnv: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = await readJson(req);

    const headers = req.headers || {};
    const ip =
      headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      null;

    const country = headers['x-vercel-ip-country'] || null;
    const region  = headers['x-vercel-ip-country-region'] || null;
    const city    = headers['x-vercel-ip-city'] || null;
    const userAgent = headers['user-agent'] || null;

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      return res.status(500).json({ error: 'Supabase env not set' });
    }

    // crude bot filter
    const looksLikeBot = /\b(bot|crawler|spider|preview|facebookexternalhit|slurp)\b/i.test(userAgent || '');
    if (looksLikeBot && body?.event_type !== 'page_close') {
      return res.status(200).json({ ok: true, skipped: 'bot' });
    }

    const payload = {
      event_type: body?.event_type,
      session_id: body?.session_id,
      page_url: body?.page_url,
      referrer: body?.referrer,
      utm_source: body?.utm_source,
      utm_medium: body?.utm_medium,
      utm_campaign: body?.utm_campaign,
      user_agent: userAgent,
      ip, country, region, city,
      language: body?.language || null,
      screen_w: body?.screen_w || null,
      screen_h: body?.screen_h || null,
      elapsed_ms: body?.elapsed_ms || null,
      extra: body?.extra || null
    };

    if (!payload.event_type || !payload.session_id) {
      return res.status(400).json({ error: 'Missing event_type or session_id', got: payload });
    }

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(500).json({ error: 'Supabase insert failed', detail: text });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: String(e?.stack || e) });
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      try {
        if (!data) return resolve({});
        resolve(JSON.parse(data));
      } catch {
        try { resolve(JSON.parse(String(data))); }
        catch (e) { reject(new Error('Invalid JSON body')); }
      }
    });
    req.on('error', reject);
  });
}
