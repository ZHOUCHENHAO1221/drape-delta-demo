import { getStore } from '@netlify/blobs';
import { authEnabled, getUser, isAdmin } from './_auth.mjs';
import { readIndex } from './_index.mjs';

// GET /.netlify/functions/download?key=...  ->  the stored file as an attachment
//
// Two intake channels, two read policies (owner's choice at upload time):
//   visibility 'public'  — anyone may read. This is the shared library.
//   visibility 'private' — only the contributor (or an admin) may read.
// Legacy rows carry no visibility flag; they are treated as private, because the safe
// direction for an unlabelled file is "less visible", never "more".
//
// Auth has to travel in a header: the Supabase session lives in localStorage, not a
// cookie, so a plain <a href> navigation cannot authenticate. The client therefore
// fetches and builds a blob (see live.js) rather than linking directly.
export default async (req) => {
  const key = new URL(req.url).searchParams.get('key');
  if (!key) return new Response('missing key', { status: 400 });

  const idx = await readIndex();
  const row = idx.find((a) => a.key === key);
  if (!row) return new Response('not found', { status: 404 });

  if (row.visibility !== 'public') {
    // Open mode (no Supabase configured) keeps the passphrase workflow; it must not
    // hard-fail local development, which has no way to sign anyone in.
    if (authEnabled()) {
      const user = await getUser(req);
      if (!user) return new Response('sign in to download this file', { status: 401 });
      const owner = row.ownerId && row.ownerId === user.id;
      if (!owner && !isAdmin(user)) {
        return new Response('this file is private to its contributor', { status: 403 });
      }
    } else {
      const pass = process.env.DRAPE_PASS;
      if (pass && req.headers.get('x-drape-pass') !== pass) {
        return new Response('unauthorized', { status: 401 });
      }
    }
  }

  const assets = getStore('drape-assets');
  const res = await assets.getWithMetadata(key, { type: 'arrayBuffer' });
  if (!res || !res.data) return new Response('not found', { status: 404 });

  const meta = res.metadata || {};
  const name = String(meta.name || key).replace(/[\r\n"]/g, '_');
  // Always an inert attachment. Netlify's _headers file does NOT apply to function
  // responses, so nosniff is set here; and the stored type is never echoed as-is, so
  // nothing can be served as active content from this origin.
  return new Response(res.data, {
    headers: {
      'content-type': 'application/octet-stream',
      'content-disposition': `attachment; filename="${name}"`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    },
  });
};
