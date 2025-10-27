// api/collect.ts
export const config = { runtime: 'edge' };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req: Request) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  // 1) Parse payload safely
  const { event, props = {} } = await req.json().catch(() => ({ event: 'unknown', props: {} }));

  // 2) Light enrichment (privacy-first)
  const ua  = req.headers.get('user-agent') || '';
  const ref = req.headers.get('referer') || '';

  // 3) (Optional) quick sanity log (works on Edge in Vercel)
  // Remove later if noisy
  console.log('collect:', { event, props, ua, ref });

  // 4) TODO: write to storage here (Postgres/Supabase/Redis/etc.)
  // await db.insert({ ts: new Date().toISOString(), event, props, ua, ref });

  return new Response('ok', { status: 200, headers: corsHeaders });
}
