import { getStore } from '@netlify/blobs';
import { authEnabled, getUser, isAdmin } from './_auth.mjs';
import { readIndex, updateIndex, addTombstone } from './_index.mjs';

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

  const idx = await readIndex();
  const asset = idx.find((a) => a.key === key);

  // Authorization (only when auth is enabled): the owner, or an admin (moderation —
  // can remove anyone's upload). A row with NO recorded owner is admin-only: the old
  // `asset.ownerId &&` in this guard skipped the check entirely for ownerless rows,
  // which let any signed-in user delete them.
  const owned = !!(asset && asset.ownerId && user && asset.ownerId === user.id);
  if (authEnabled() && !(owned || isAdmin(user))) {
    return json({ error: 'you can only delete your own uploads' }, 403);
  }

  // The qualification record lives in its own store, so deleting the file does not remove
  // it — an orphaned record naming a mill and a lab would outlive the upload it described.
  // Both stores are cleared BEFORE the index row, and a failure aborts: dropping the row
  // first would strand the file and the record where nothing can reach or delete them,
  // while still reporting success to the contributor who asked for erasure.
  const assets = getStore('drape-assets');
  try {
    await assets.delete(key);
    await getStore('drape-qual').delete(key);
  } catch (e) {
    return json({ error: 'storage delete failed — nothing was removed, please retry' }, 502);
  }
  // Record the erasure before rewriting the index. Without this, a concurrent upload holding
  // an older snapshot would write the row back and the contributor would be told a file was
  // deleted while its listing reappeared — pointing at bytes and a record already destroyed.
  await addTombstone(key);
  const before = idx.length;
  const stored = await updateIndex(
    // Clear any lineage pointing at the row being removed, or a surviving row would claim
    // to be superseded by something that no longer exists — and would look permanently
    // out of date with no way back.
    (cur) => cur.filter((a) => a.key !== key).map((a) => (
      a.supersededBy === key ? Object.assign({}, a, { supersededBy: null })
        : a.supersedes === key ? Object.assign({}, a, { supersedes: null })
          : a
    )),
    (s) => !s.some((a) => a.key === key),
  );

  return json({ ok: true, key, removed: before - stored.length, remaining: stored.length });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
