// Shared helper (leading underscore => not deployed as its own endpoint).
// Validates a Supabase access token by asking Supabase who it belongs to.
// Returns { id, email } or null. Auth is only enforced when SUPABASE_URL is set.

export function authEnabled() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

// How strongly this deployment can actually enforce "private".
//
//   'auth'       Supabase is configured server-side: ownership is verifiable per request.
//   'passphrase' no Supabase, but DRAPE_PASS is set: one shared secret gates everything.
//   'open'       neither: the server cannot tell one visitor from another.
//
// This matters because the browser's Supabase credentials live in the committed
// supabase-config.js while every function reads its own from process.env. If the two ever
// disagree — a new site, a deploy preview, a branch context where the vars are not scoped —
// the UI still signs people in and still shows the words "private channel", while the server
// silently drops to 'open' and cannot keep that promise. The product must not accept data
// under a guarantee it is not in a position to honour, so upload.mjs refuses private uploads
// in 'open' mode and /list reports the mode so the interface can say so before anyone types.
export function enforcementMode() {
  if (authEnabled()) return 'auth';
  if (process.env.DRAPE_PASS) return 'passphrase';
  return 'open';
}

export async function getUser(req) {
  if (!authEnabled()) return null;
  const h = req.headers.get('authorization') || '';
  const token = h.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: 'Bearer ' + token },
    });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u || !u.id) return null;
    // Display name (if the contributor set one) is the only identity safe to show
    // publicly — the email must never leave this module except for admin moderation.
    const md = u.user_metadata || {};
    const name = md.display_name || md.full_name || md.name || null;
    return { id: u.id, email: u.email || null, name };
  } catch { return null; }
}

// Admin allowlist (emails) for moderation: delete any upload.
// Admins are read ONLY from the DRAPE_ADMINS env var (comma-separated) — no email lives in
// the repo. Set it in Netlify → Environment variables, e.g. DRAPE_ADMINS = you@example.com
// Sign in with that same email (e.g. via Continue with Google) to get admin rights.
// This is an allowlist, not a secret. If the var is unset, no one is an admin.
export function isAdmin(user) {
  if (!user || !user.email) return false;
  const set = (process.env.DRAPE_ADMINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return set.includes(user.email.toLowerCase());
}
