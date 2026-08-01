import { getStore } from '@netlify/blobs';
import { getUser } from './_auth.mjs';

// GET /.netlify/functions/list  ->  { assets: [{ key, name, size, type, uploadedAt, ownerEmail, mine }], me }
export default async (req) => {
  const user = await getUser(req);
  const index = getStore('drape-index');
  let idx = [];
  try { const cur = await index.get('index', { type: 'json' }); if (Array.isArray(cur)) idx = cur; } catch {}
  const assets = idx.map((a) => ({
    key: a.key, name: a.name, size: a.size, type: a.type, uploadedAt: a.uploadedAt,
    ownerEmail: a.ownerEmail || null,
    mine: !!(user && a.ownerId && a.ownerId === user.id) || (!a.ownerId), // owned, or legacy/open uploads
  }));
  return new Response(JSON.stringify({ assets, me: user ? user.email : null }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
};
