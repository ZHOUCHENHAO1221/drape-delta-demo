// POST /.netlify/functions/clientlog  { kind, msg, at, page, ua, vw, vh, extra }
// Receives a client-side error report and writes it to the Netlify function log.
// Intentionally minimal: no storage, no third party, no personal data, no cookies.
// It exists so that a silent breakage becomes a visible line somewhere.
// Deliberately open (a broken page cannot authenticate), so the only defences are cheap ones:
// same-origin, and a per-instance token bucket. Neither stops a determined flood — that needs
// a real store — but both stop the log becoming a free write target for a passing scanner.
let bucket = 60, refilled = 0;

export default async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const site = process.env.URL || '';
  const origin = req.headers.get('origin') || '';
  if (site && origin && !origin.startsWith(site)) {
    return new Response('cross-origin', { status: 403 });
  }

  const now = Date.now();
  if (now - refilled > 60000) { bucket = 60; refilled = now; }
  if (bucket <= 0) return new Response('slow down', { status: 429 });
  bucket--;

  let b = {};
  try {
    const raw = await req.text();
    if (raw.length > 4000) return new Response('too large', { status: 413 });
    b = JSON.parse(raw);
  } catch { return new Response('bad json', { status: 400 }); }

  const clip = (v, n) => (v === undefined || v === null ? '' : String(v).replace(/[\r\n]+/g, ' ').slice(0, n));
  // Reported to the log only — never stored, never echoed back to any client.
  console.error('[drape-client]', JSON.stringify({
    kind: clip(b.kind, 20),
    msg: clip(b.msg, 400),
    page: clip(b.page, 120),
    at: clip(b.at, 40),
    ua: clip(b.ua, 160),
    vp: `${Number(b.vw) || 0}x${Number(b.vh) || 0}`,
    extra: clip(b.extra, 300),
  }));

  return new Response(null, { status: 204 });
};
