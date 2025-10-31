// /api/collect.js (debugging why reservations isn't inserting)

const KNOWN_FIELDS = new Set([
  'event_type','event','session_id','page_url','referrer',
  'utm_source','utm_medium','utm_campaign',
  'language','screen_w','screen_h','elapsed_ms','extra'
]);

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'GET' && (req.query?.health === '1')) {
    return res.status(200).json({
      ok: true,
      hasEnv: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE
    });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = await readJson(req);

    const event_type = body?.event_type || body?.event;
    if (!event_type) return res.status(400).json({ error: 'Missing event_type', got: body });

    const h = req.headers || {};
    const ip =
      h['x-forwarded-for']?.split(',')[0]?.trim() ||
      h['x-real-ip'] ||
      req.socket?.remoteAddress ||
      null;
    const user_agent = h['user-agent'] || null;
    const country = h['x-vercel-ip-country'] || null;
    const region  = h['x-vercel-ip-country-region'] || null;
    const city    = h['x-vercel-ip-city'] || null;

    const {
      session_id, page_url, referrer,
      utm_source, utm_medium, utm_campaign,
      language, screen_w, screen_h, elapsed_ms
    } = body || {};

    const extra = { ...(body?.extra || {}) };
    for (const [k, v] of Object.entries(body || {})) {
      if (!KNOWN_FIELDS.has(k)) extra[k] = v;
    }

    const ua = (user_agent || '').toLowerCase();
    const looksLikeBot = /(bot|crawler|spider|preview|curl|statuscake|uptime|monitor)/.test(ua);
    if (looksLikeBot && event_type !== 'page_close') {
      return res.status(200).json({ ok: true, skipped: 'bot' });
    }

    const baseRow = {
      event_type,
      session_id: session_id || null,
      page_url: page_url || null,
      referrer: referrer || null,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      language: language || null,
      screen_w: numberOrNull(screen_w),
      screen_h: numberOrNull(screen_h),
      elapsed_ms: numberOrNull(elapsed_ms),
      user_agent,
      ip,
      country,
      region,
      city,
      extra: Object.keys(extra).length ? extra : null
    };

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({ error: 'Supabase environment variables missing' });
    }

    const isForm = event_type === 'form_submit' || event_type === 'preorder_submitted';

    if (isForm) {
      const reservationsRow = {
        ...baseRow,
        name: extra.name ?? body?.name ?? null,
        organization: extra.organization ?? body?.organization ?? null,
        phone: extra.phone ?? body?.phone ?? null,
        email: extra.email ?? body?.email ?? null,
        plan_type: extra.plan_type ?? extra.plan ?? extra.type ?? body?.plan ?? body?.type ?? null
      };

      const r = await postRow(SUPABASE_URL, SERVICE_ROLE, 'reservations', reservationsRow);
      if (r.ok) return res.status(200).json({ ok: true, table: 'reservations' });

      // Fallback with debug info
      const fallbackRow = { ...baseRow, event_type: 'form_submit', extra: { form: reservationsRow } };
      const r2 = await postRow(SUPABASE_URL, SERVICE_ROLE, 'events', fallbackRow);

      if (!r2.ok) {
        return res.status(500).json({
          error: 'Supabase insert failed',
          detail: r2.detail,
          tried: ['reservations','events'],
          reservations_error: r.detail
        });
      }
      return res.status(200).json({
        ok: true,
        table: 'events_fallback',
        reservations_error: r.detail
      });
    }

    const e = await postRow(SUPABASE_URL, SERVICE_ROLE, 'events', baseRow);
    if (!e.ok) return res.status(500).json({ error: 'Supabase insert failed', detail: e.detail });

    return res.status(200).json({ ok: true, table: 'events' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: String(err?.stack || err) });
  }
}

function numberOrNull(v) {
  if (typeof v === 'number') return v;
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch { try { resolve(JSON.parse(String(data))); } catch (e) { reject(new Error('Invalid JSON')); } }
    });
    req.on('error', reject);
  });
}

async function postRow(url, key, table, row) {
  try {
    const resp = await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify([row])
    });
    if (!resp.ok) {
      return { ok: false, status: resp.status, detail: await resp.text().catch(()=> '') };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, status: 0, detail: String(e) };
  }
}
