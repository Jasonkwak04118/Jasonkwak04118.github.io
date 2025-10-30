// /api/collect_v2.js
export default async function handler(req, res) {
  try {
    // Health check
    if (req.method === "GET" && req.query?.health === "1") {
      return res.status(200).json({
        ok: true,
        hasEnv:
          !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE,
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = await readJson(req);
    const headers = req.headers || {};

    const ip =
      headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      null;
    const country = headers["x-vercel-ip-country"] || null;
    const region = headers["x-vercel-ip-country-region"] || null;
    const city = headers["x-vercel-ip-city"] || null;
    const userAgent = headers["user-agent"] || null;

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      return res
        .status(500)
        .json({ error: "Supabase environment variables missing" });
    }

    const event_type = body?.event_type;
    const session_id = body?.session_id;

    if (!event_type || !session_id) {
      return res.status(400).json({
        error: "Missing event_type or session_id",
        got: body,
      });
    }

    // 공통 페이로드
    const payload = {
      event_type,
      session_id,
      page_url: body?.page_url,
      referrer: body?.referrer,
      utm_source: body?.utm_source,
      utm_medium: body?.utm_medium,
      utm_campaign: body?.utm_campaign,
      language: body?.language,
      screen_w: body?.screen_w,
      screen_h: body?.screen_h,
      user_agent: userAgent,
      ip,
      country,
      region,
      city,
      extra: body?.extra || null,
    };

    // event_type에 따라 테이블 분기
    let table = "events";
    let record = payload;

    if (event_type === "form_submit") {
      table = "reservations";
      record = {
        ...payload,
        name: body?.extra?.name || null,
        organization: body?.extra?.organization || null,
        phone: body?.extra?.phone || null,
        email: body?.extra?.email || null,
        plan_type: body?.extra?.plan_type || null,
      };
    }

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(record),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(500).json({
        error: "Supabase insert failed",
        detail: text,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "Server error", detail: String(e?.stack || e) });
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}
