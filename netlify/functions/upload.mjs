import { getStore } from '@netlify/blobs';

// POST /.netlify/functions/upload  (multipart form-data, field "file")
// Stores an already-measured asset (.zfab / lab report) in Netlify Blobs.
// It does NOT analyse or derive properties — it registers the uploaded measured file.
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // Optional passphrase gate. Set env var DRAPE_PASS to lock the public endpoint.
  const pass = process.env.DRAPE_PASS;
  if (pass && req.headers.get('x-drape-pass') !== pass) return json({ error: 'unauthorized' }, 401);

  let form;
  try { form = await req.formData(); } catch { return json({ error: 'bad form data' }, 400); }
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ error: 'no file' }, 400);

  const MAX = 25 * 1024 * 1024; // 25 MB demo cap
  if (file.size > MAX) return json({ error: 'file too large (max 25 MB)' }, 413);

  const buf = new Uint8Array(await file.arrayBuffer());
  const name = (file.name || 'asset').slice(0, 120);
  const type = file.type || 'application/octet-stream';
  const key = 'a_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  const assets = getStore('drape-assets');
  await assets.set(key, buf, { metadata: { name, size: file.size, type } });

  const index = getStore('drape-index');
  let idx = [];
  try { const cur = await index.get('index', { type: 'json' }); if (Array.isArray(cur)) idx = cur; } catch {}
  idx.unshift({ key, name, size: file.size, type, uploadedAt: new Date().toISOString() });
  if (idx.length > 200) idx = idx.slice(0, 200);
  await index.setJSON('index', idx);

  return json({ ok: true, key, name, size: file.size });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
