// Private input storage for cloud comparison tasks. NOT YET DEPLOYED — needs a
// Supabase Storage bucket 'drape-inputs' created with public = false, plus the
// storage RLS policies at the end of _delta_cloud_worker/schema.sql.
//
// Upload route (D1.2.2): TUS resumable upload, per Supabase's own guidance that
// files above 6 MB should use the resumable protocol. ZPRJ inputs run to 512 MB, so
// the earlier one-shot signed PUT (whole file in one request, no resume, and an
// expiry figure this module invented) is gone. The browser talks TUS directly to
//   {SUPABASE_URL}/storage/v1/upload/resumable
// authenticated with the USER'S OWN session JWT; the storage RLS policies restrict
// each user to inserting under inputs/<their-uid>/… and grant no UPDATE, so an
// existing object cannot be overwritten by a client. This function only validates
// task state and hands back the endpoint descriptor — no service credential ever
// reaches the browser.
//
//   docs: https://supabase.com/docs/guides/storage/uploads/resumable-uploads
//         https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl
//
// What this module does NOT do: verify file contents. statObject() returns the size
// the storage service reports plus untrusted client metadata; the authoritative
// SHA-256 is computed by the worker-side verifier (input_verifier.py) streaming the
// stored object before the task is frozen and queued.
//
// NOT VERIFIED AGAINST THE LIVE API: endpoint paths, response fields and the
// no-overwrite behaviour are written from Supabase's documentation and have never
// been exercised against a real project. D1.2.3 (throwaway project) does that; a
// memory:// double proves none of it.

const BUCKET = 'drape-inputs';

function headers() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return { apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json' };
}

export const supabaseStorage = {
  // Descriptor for a browser-side TUS upload of ONE input object. The caller has
  // already checked token, ownership and task state.
  async uploadSpec(storageKey) {
    // Official guidance: large uploads should hit the project's DIRECT storage
    // hostname (<ref>.storage.supabase.co), not the general API hostname. Derived
    // from SUPABASE_URL; real reachability is a D1.2.3 item.
    const direct = (process.env.SUPABASE_URL || '')
      .replace(/^https:\/\/([^.]+)\.supabase\.co/, 'https://$1.storage.supabase.co');
    return {
      protocol: 'tus',
      endpoint: direct + '/storage/v1/upload/resumable',
      bucket: BUCKET,
      objectName: storageKey,
      chunkBytes: 6 * 1024 * 1024,   // Supabase resumable uploads require 6 MiB chunks
      // the browser authenticates with its own session JWT + the public anon key;
      // nothing secret travels in this response
    };
  },

  // Size of what actually landed, plus untrusted client metadata. NOT a checksum
  // the caller may rely on — see the note at the top of this file.
  async statObject(storageKey) {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/info/${BUCKET}/${storageKey}`,
      { headers: headers() });
    if (!response.ok) return null;
    const info = await response.json();
    return { bytes: Number(info.size),
             declaredSha256: info.metadata?.sha256 || null,   // untrusted
             version: info.version || info.id || null };
  },

  async signDownload(storageKey, seconds = 300) {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${storageKey}`,
      { method: 'POST', headers: headers(), body: JSON.stringify({ expiresIn: seconds }) });
    if (!response.ok) throw new Error('sign download failed: ' + response.status);
    const data = await response.json();
    return process.env.SUPABASE_URL + '/storage/v1' + data.signedURL;
  },
};

// Test double: records what was "uploaded" so finalize and the verifier tests can
// work against real bytes rather than a declared value.
export function makeMemoryStorage(objects = {}) {
  const store = new Map(Object.entries(objects));
  return {
    _objects: store,
    async uploadSpec(storageKey) {
      return { protocol: 'tus', endpoint: 'memory://tus', bucket: BUCKET,
               objectName: storageKey, chunkBytes: 6 * 1024 * 1024 };
    },
    async statObject(storageKey) {
      return store.get(storageKey) || null;
    },
    async readObject(storageKey) {
      const entry = store.get(storageKey);
      return entry && entry.body !== undefined ? entry.body : null;
    },
    async signDownload(storageKey) { return 'memory://' + storageKey; },
    put(storageKey, bytes, declaredSha256, body) {
      store.set(storageKey, { bytes, declaredSha256, body });
    },
  };
}
