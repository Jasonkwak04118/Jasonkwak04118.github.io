// /api/collect_v2.js
export default async function handler(req, res) {
  try {
    if (req.method === 'GET' && req.query?.health === '1') {
      return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = await readJson(req);
    const headers = req.headers || {};
    const userAgent = headers['user-agent'] || null;
    const ip =
      headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      null;

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE)
      return res.status(500).json({ error: 'Missing Supabase env' });

    const event_type = body?.event_type;
    const session_id = body?.session_id;

    if (!event_type || !session_id)
      return res.status(400).json({ error: 'Missing event_type or session_id' });

    const payload = {
      event_type,
      session_id,
      page_url: body?.page_url,
      referrer: body?.referrer,
      language: body?.language,
      screen_w: body?.screen_w,
      screen_h: body?.screen_h,
      user_agent: userAgent,
      ip,
      utm_source: body?.utm_source,
      utm_medium: body?.utm_medium,
      utm_campaign: body?.utm_campaign,
      extra: body?.extra,
    };

    // 이벤트 타입별 테이블 분기
    const table = event_type === 'form_submit' ? 'reservations' : 'events';

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
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
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}
