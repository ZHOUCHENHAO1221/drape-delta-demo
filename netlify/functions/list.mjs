import { getStore } from '@netlify/blobs';
import { getUser, isAdmin } from './_auth.mjs';

// GET /.netlify/functions/list  ->  { assets: [{ ..., mine, canDelete }], me, admin }
export default async (req) => {
  const user = await getUser(req);
  const admin = isAdmin(user);
  const index = getStore('drape-index');
  let idx = [];
  try { const cur = await index.get('index', { type: 'json' }); if (Array.isArray(cur)) idx = cur; } catch {}
  const assets = idx.map((a) => {
    const mine = !!(user && a.ownerId && a.ownerId === user.id) || (!a.ownerId); // owned, or legacy/open uploads
    return {
      key: a.key, name: a.name, size: a.size, type: a.type, uploadedAt: a.uploadedAt,
      ownerEmail: a.ownerEmail || null,
      mine,
      canDelete: mine || admin, // an admin can remove any upload (moderation)
    };
  });
  return new Response(JSON.stringify({ assets, me: user ? user.email : null, admin }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
};
