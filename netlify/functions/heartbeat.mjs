// Scheduled hourly (see netlify.toml). Two jobs, both about surviving neglect:
//
//  1. Prove the critical read path still answers. If /list stops returning 200 the log
//     shows it within the hour instead of on the day someone tries to demo the site.
//  2. Keep the free-tier Supabase project awake. A free project is paused after roughly
//     a week idle, and a paused project means sign-in fails for everyone with no error
//     that points at the cause. Note that hitting /list alone does NOT do this: getUser
//     returns null without a token and never calls Supabase, so the project must be
//     pinged directly.
//
// It only writes to the function log. Wiring an alert destination (email/webhook) is a
// deliberate follow-up: it needs a provider choice that is the owner's to make.
export default async () => {
  const site = process.env.URL || 'https://drape-delta.netlify.app';
  const out = { at: new Date().toISOString(), checks: {} };

  async function check(name, url, opts) {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { ...(opts || {}), signal: AbortSignal.timeout(10000) });
      out.checks[name] = { ok: r.ok, status: r.status, ms: Date.now() - t0 };
    } catch (e) {
      out.checks[name] = { ok: false, error: String((e && e.message) || e).slice(0, 120), ms: Date.now() - t0 };
    }
  }

  await check('home', site + '/');
  await check('list', site + '/.netlify/functions/list');

  const su = process.env.SUPABASE_URL, ak = process.env.SUPABASE_ANON_KEY;
  if (su && ak) {
    await check('supabase', su + '/auth/v1/health', { headers: { apikey: ak } });
  } else {
    out.checks.supabase = { ok: null, note: 'not configured' };
  }

  const failed = Object.entries(out.checks).filter(([, v]) => v && v.ok === false);
  // `ok: null` means the check could not run at all. Treating that as healthy is exactly the
  // failure this monitor exists to prevent: a deployment with no Supabase configured would
  // log a green line every hour while sign-in was dead and privacy unenforceable.
  const unrun = Object.entries(out.checks).filter(([, v]) => v && v.ok === null);
  if (failed.length) console.error('[drape-heartbeat] FAIL', JSON.stringify(out));
  else if (unrun.length) console.warn('[drape-heartbeat] NOT CHECKED', JSON.stringify(out));
  else console.log('[drape-heartbeat] ok', JSON.stringify(out));

  return new Response(JSON.stringify(out), {
    status: failed.length ? 500 : 200,
    headers: { 'content-type': 'application/json' },
  });
};
