import { getStore } from '@netlify/blobs';
import { authEnabled, getUser } from './_auth.mjs';

// POST /.netlify/functions/delete  { key }  — removes an uploaded candidate.
// Only affects uploaded candidates in Blobs; the 7 seed fabrics are baked into the
// HTML and are unaffected. When Supabase is wired you can only delete your OWN uploads
// (or legacy pre-auth uploads). Open mode falls back to the DRAPE_PASS passphrase.
export default async (req) => {
  if (req.method !== 'POST' && req.method !== 'DELETE') return json({ error: 'method not allowed' }, 405);

  const user = await getUser(req);
  if (authEnabled() && !user) return json({ error: 'sign in to delete' }, 401);
  if (!authEnabled()) {
    const pass = process.env.DRAPE_PASS;
    if (pass && req.headers.get('x-drape-pass') !== pass) return json({ error: 'unauthorized' }, 401);
  }

  let key;
  try { key = (await req.json()).key; } catch { key = new URL(req.url).searchParams.get('key'); }
  if (!key) return json({ error: 'missing key' }, 400);

  const index = getStore('drape-index');
  let idx = [];
  try { const cur = await index.get('index', { type: 'json' }); if (Array.isArray(cur)) idx = cur; } catch {}
  const asset = idx.find((a) => a.key === key);

  // Ownership check (only when auth is enabled): own uploads, or legacy uploads with no owner.
  if (authEnabled() && asset && asset.ownerId && (!user || asset.ownerId !== user.id)) {
    return json({ error: 'you can only delete your own uploads' }, 403);
  }

  const assets = getStore('drape-assets');
  await assets.delete(key).catch(() => {});
  const before = idx.length;
  idx = idx.filter((a) => a.key !== key);
  await index.setJSON('index', idx);

  return json({ ok: true, key, removed: before - idx.length, remaining: idx.length });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
