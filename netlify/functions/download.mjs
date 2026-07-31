import { getStore } from '@netlify/blobs';

// GET /.netlify/functions/download?key=...  ->  the stored file as an attachment
export default async (req) => {
  const key = new URL(req.url).searchParams.get('key');
  if (!key) return new Response('missing key', { status: 400 });

  const assets = getStore('drape-assets');
  const res = await assets.getWithMetadata(key, { type: 'arrayBuffer' });
  if (!res || !res.data) return new Response('not found', { status: 404 });

  const meta = res.metadata || {};
  const name = String(meta.name || key).replace(/[\r\n"]/g, '_');
  return new Response(res.data, {
    headers: {
      'content-type': meta.type || 'application/octet-stream',
      'content-disposition': `attachment; filename="${name}"`,
    },
  });
};
