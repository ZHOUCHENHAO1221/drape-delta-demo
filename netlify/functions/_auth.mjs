// Shared helper (leading underscore => not deployed as its own endpoint).
// Validates a Supabase access token by asking Supabase who it belongs to.
// Returns { id, email } or null. Auth is only enforced when SUPABASE_URL is set.

export function authEnabled() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
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
    return u && u.id ? { id: u.id, email: u.email || null } : null;
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
