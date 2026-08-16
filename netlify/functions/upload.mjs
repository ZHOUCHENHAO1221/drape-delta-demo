import { getStore } from '@netlify/blobs';
import { authEnabled, getUser, enforcementMode } from './_auth.mjs';
import { sanitiseQual, qualCounts, isEmptyQual, missingRequired, REQUIRED_FIELDS } from './_qual.mjs';
import { readIndex, updateIndex, overQuota, ownerBucket, addTombstone } from './_index.mjs';

// POST /.netlify/functions/upload  (multipart form-data, field "file")
// Stores an already-measured asset (.zfab / lab report) in Netlify Blobs.
// It does NOT analyse or derive properties — it registers the uploaded measured file.
// When Supabase is configured, the contributor must be signed in and the asset is
// tagged with their owner id (transparent provenance = a real account).
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // Auth: required when Supabase is wired; falls back to open mode + passphrase otherwise.
  const user = await getUser(req);
  if (authEnabled() && !user) return json({ error: 'sign in to contribute' }, 401);
  if (!authEnabled()) {
    const pass = process.env.DRAPE_PASS;
    if (pass && req.headers.get('x-drape-pass') !== pass) return json({ error: 'unauthorized' }, 401);
  }

  let form;
  try { form = await req.formData(); } catch { return json({ error: 'bad form data' }, 400); }
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ error: 'no file' }, 400);

  // Format allow-list, by EXTENSION. It cannot be by MIME: browsers report '' or
  // application/octet-stream for .zfab (unregistered), so a MIME allow-list would
  // reject the product's flagship format. MIME is advisory only — but the actively
  // dangerous declared types are refused outright because download echoes the file
  // back from this site's own origin, which also holds the Supabase session.
  const rawName = String(file.name || 'asset');
  const ext = (rawName.toLowerCase().match(/\.([a-z0-9]+)$/) || [, ''])[1];
  const ALLOWED = new Set(['zfab', 'csv', 'pdf', 'txt', 'json', 'xlsx']);
  if (!ALLOWED.has(ext)) {
    return json({ error: 'unsupported file type — accepted: .zfab .csv .pdf .txt .json .xlsx' }, 415);
  }
  const DANGEROUS = new Set(['text/html', 'image/svg+xml', 'application/xhtml+xml']);
  if (DANGEROUS.has(String(file.type || '').toLowerCase())) {
    return json({ error: 'unsupported file type' }, 415);
  }

  const MAX = 25 * 1024 * 1024;
  if (file.size > MAX) return json({ error: 'file too large (max 25 MB)' }, 413);

  const buf = new Uint8Array(await file.arrayBuffer());
  // Strip path separators and control characters — the stored name is echoed back in
  // the download's content-disposition header.
  const name = rawName.replace(/[\\/\r\n\t\x00-\x1f"]/g, '_').slice(0, 120);
  // Store a type derived from the extension, never the client's declared file.type,
  // so the blob store can never be made to serve active content from this origin.
  const EXT_TYPE = {
    zfab: 'application/octet-stream', csv: 'text/csv', pdf: 'application/pdf',
    txt: 'text/plain', json: 'application/json',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  const type = EXT_TYPE[ext] || 'application/octet-stream';
  // Which intake channel the contributor chose. Anything that is not an explicit
  // 'public' is stored as private: an unlabelled file must never become more visible
  // than its owner intended.
  const visibility = String(form.get('visibility') || '') === 'public' ? 'public' : 'private';

  // Never accept data under a promise this deployment cannot keep. In 'open' mode the server
  // cannot tell one visitor from another, so a file stored as "private" would be readable by
  // anyone — the label would be false the moment it was written. Refusing is the honest
  // outcome and it doubles as the loudest possible signal that the environment is misconfigured.
  if (visibility === 'private' && enforcementMode() === 'open') {
    return json({
      error: 'this deployment cannot enforce private uploads — sign-in is not configured on the server, so anything stored here is readable by anyone. Use the public channel, or set SUPABASE_URL / SUPABASE_ANON_KEY (or DRAPE_PASS) on the deployment.',
    }, 409);
  }

  // The qualification record is optional — an upload without one is still accepted, it is
  // just an unqualified candidate, and the row says so. Refusing the file would only mean
  // fewer fabrics, not better records.
  const qual = sanitiseQual(form.get('qual'));
  const counts = qual && !isEmptyQual(qual) ? qualCounts(qual) : null;
  // A record that cannot say which CLO version and which baseline preset it was measured
  // against cannot be re-checked when CLO revises its library — it just goes quietly stale.
  // Filing no record at all stays fine; filing a record that cannot age does not.
  if (counts) {
    const missing = missingRequired(qual);
    if (missing.length) {
      return json({
        error: 'a qualification record must name the CLO version and the baseline preset it was measured against, so it can be re-checked when CLO revises its generic library',
        missing,
        required: REQUIRED_FIELDS,
      }, 422);
    }
  }

  // Lineage. A contributor replacing their own earlier upload keeps the two linked rather
  // than leaving two rows that look like two fabrics. The product's own front page already
  // claims the platform 'organises, versions and hands off' measured fabric; until now
  // there was no versioning behind that sentence.
  const supersedes = String(form.get('supersedes') || '').trim();
  let version = 1;
  if (supersedes) {
    const prevRow = (await readIndex()).find((a) => a.key === supersedes);
    if (!prevRow) return json({ error: 'the upload this replaces no longer exists' }, 404);
    const yours = user ? prevRow.ownerId === user.id : !prevRow.ownerId;
    if (!yours) return json({ error: 'you can only replace your own upload' }, 403);
    if (prevRow.supersededBy) return json({ error: 'that upload has already been replaced' }, 409);
    version = (Number(prevRow.version) || 1) + 1;
  }

  const key = 'a_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  const assets = getStore('drape-assets');
  await assets.set(key, buf, { metadata: { name, size: file.size, type } });
  // Blob metadata is capped at 2 KB and THROWS (not truncates) past it, so the record goes
  // in its own store, keyed by the asset key, and never near that limit.
  if (counts) await getStore('drape-qual').setJSON(key, qual);

  const row = {
    key, name, size: file.size, type, uploadedAt: new Date().toISOString(),
    ownerId: user ? user.id : null,
    ownerEmail: user ? user.email : null,   // server-side record; never serialised by list
    ownerName: user ? (user.name || null) : null, // public attribution, if the user set one
    visibility,
    qual: counts,   // summary only {m,f}; the record itself is in the drape-qual store
    version,
    supersedes: supersedes || null,
    supersededBy: null,
  };
  const bucket = ownerBucket(row);
  const qualStore = getStore('drape-qual');

  // Written through updateIndex, which re-reads afterwards and retries: the index is one
  // shared JSON blob with no compare-and-swap available at this library version, so a
  // concurrent upload could otherwise drop this row on the floor and still report success.
  await updateIndex(
    async (idx) => {
      // Point the predecessor forward in the same write, so the two can never disagree
      // about which one is current.
      idx = [row].concat(supersedes
        ? idx.map((a) => (a.key === supersedes ? Object.assign({}, a, { supersededBy: key }) : a))
        : idx);
      // Eviction is per contributor, never global. The old "keep the newest 200" rule let
      // anyone clear the library by uploading 200 one-byte files; now the only rows a
      // contributor can displace are their own. Both stores are cleared before the row is
      // dropped, or the record — mill, batch, lab — would outlive every way of reaching it.
      const evict = overQuota(idx, bucket);
      const stranded = new Set();
      for (const d of evict) {
        try { await assets.delete(d.key); await qualStore.delete(d.key); }
        catch { stranded.add(d.key); }
      }
      const gone = new Set(evict.filter((d) => !stranded.has(d.key)).map((d) => d.key));
      // Eviction erases just as thoroughly as an explicit delete, so it needs the same
      // tombstone: without it a concurrent request holding an older snapshot could write
      // an evicted row back, pointing at a file and a record already destroyed.
      for (const k of gone) await addTombstone(k);
      return idx.filter((a) => !gone.has(a.key));
    },
    (stored) => stored.some((a) => a.key === key),
  );

  return json({ ok: true, key, name, size: file.size, visibility, qual: counts, owner: user ? user.email : null });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
