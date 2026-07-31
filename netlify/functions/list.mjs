import { getStore } from '@netlify/blobs';

// GET /.netlify/functions/list  ->  { assets: [{ key, name, size, type, uploadedAt }] }
export default async () => {
  const index = getStore('drape-index');
  let idx = [];
  try { const cur = await index.get('index', { type: 'json' }); if (Array.isArray(cur)) idx = cur; } catch {}
  return new Response(JSON.stringify({ assets: idx }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
};
