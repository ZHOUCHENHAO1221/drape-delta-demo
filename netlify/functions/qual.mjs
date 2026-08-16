import { getStore } from '@netlify/blobs';
import { authEnabled, getUser, isAdmin } from './_auth.mjs';
import { readIndex } from './_index.mjs';
import { QUAL_FIELDS, ENGINE_INPUTS } from './_qual.mjs';

// GET /.netlify/functions/qual?key=...  ->  { record, fields, inputs }
//
// The record is gated exactly like the file it describes, and for the same reason: a
// record naming a mill, a batch and a lab is commercially sensitive, so it must not be
// readable where the file is not. Public channel = the contributor published both; that
// is what the channel label promises at upload time, and this is the only privacy model —
// a second, hidden one would contradict the label they read before choosing.
//
// The record lives in its own store rather than in the index row: /list and /download read
// and rewrite the whole index on every call, and fattening every row to serve a detail
// nobody has expanded yet would tax every request to pay for one.
export default async (req) => {
  const key = new URL(req.url).searchParams.get('key');
  if (!key) return json({ error: 'missing key' }, 400);

  const idx = await readIndex();
  const row = idx.find((a) => a.key === key);
  if (!row) return json({ error: 'not found' }, 404);

  if (row.visibility !== 'public') {
    if (authEnabled()) {
      const user = await getUser(req);
      if (!user) return json({ error: 'sign in to read this record' }, 401);
      const owner = row.ownerId && row.ownerId === user.id;
      if (!owner && !isAdmin(user)) return json({ error: 'this record is private to its contributor' }, 403);
    } else {
      const pass = process.env.DRAPE_PASS;
      if (pass && req.headers.get('x-drape-pass') !== pass) return json({ error: 'unauthorized' }, 401);
    }
  }

  const qual = getStore('drape-qual');
  let record = null;
  try { record = await qual.get(key, { type: 'json' }); } catch {}

  return json({
    key,
    record,                       // null for uploads made before a record was asked for
    fields: QUAL_FIELDS,
    inputs: ENGINE_INPUTS,
  });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  });
}
