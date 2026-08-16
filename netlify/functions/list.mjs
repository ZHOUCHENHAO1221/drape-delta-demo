import { authEnabled, getUser, isAdmin, enforcementMode } from './_auth.mjs';
import { readIndex, OWNER_CAP } from './_index.mjs';

// GET /.netlify/functions/list  ->  { assets: [{ ..., mine, canDelete }], me, admin }
export default async (req) => {
  const user = await getUser(req);
  const admin = isAdmin(user);
  // Passphrase mode is a supported deployment, and this was the one endpoint that did not
  // check it — so an anonymous curl could enumerate every private row, which is exactly what
  // the comment below says must not be possible. Every other function already checks it.
  const passphrase = process.env.DRAPE_PASS;
  const passOk = !passphrase || req.headers.get('x-drape-pass') === passphrase;
  const open = !authEnabled() && passOk; // no Supabase configured: local dev / passphrase mode
  const idx = await readIndex();
  // A private row is not merely hidden from the payload — it must not be enumerable at
  // all, because /list is what turns a key into something someone can ask for.
  const visible = idx.filter((a) => {
    if (a.visibility === 'public') return true;
    if (open) return true;                       // local dev / passphrase mode
    return admin || !!(user && a.ownerId && a.ownerId === user.id);
  });
  const assets = visible.map((a) => {
    // "mine" is ownership, nothing else. A row with no recorded owner is NOT mine —
    // treating it as mine made every ownerless row deletable by any visitor.
    const mine = !!(user && a.ownerId && a.ownerId === user.id);
    const row = {
      key: a.key, name: a.name, size: a.size, type: a.type, uploadedAt: a.uploadedAt,
      by: a.ownerName || null,          // public attribution: display name only, never the email
      visibility: a.visibility === 'public' ? 'public' : 'private',
      // Summary only: how many engine inputs were measured (m/5) and how many declared
      // fields were filled (f/10). The record's contents stay behind /qual, which gates
      // them like the file. Legacy rows have none — null, never a fabricated zero.
      qual: a.qual && typeof a.qual === 'object'
        ? { m: Number(a.qual.m) || 0, f: Number(a.qual.f) || 0 }
        : null,
      version: Number(a.version) || 1,
      supersedes: a.supersedes || null,
      supersededBy: a.supersededBy || null,
      mine,
      canDelete: mine || admin || open, // open mode keeps the passphrase workflow usable
    };
    // Contributor email is personal data: moderation only, never in the public payload.
    if (admin) row.ownerEmail = a.ownerEmail || null;
    return row;
  });
  // Tell the client what this deployment can actually enforce, so the contribution form can
  // say so BEFORE anyone picks a channel. A "private" label the server cannot honour is the
  // one failure here that a user has no way of detecting for themselves.
  const enforcement = enforcementMode();
  return new Response(JSON.stringify({
    assets, me: user ? user.email : null, admin,
    // 'shared' = passphrase mode: private means "not public", not "only you" — one
    // secret is held by everyone who has it, so the label must not say otherwise.
    privacy: enforcement === 'open' ? 'unenforced' : (enforcement === 'passphrase' ? 'shared' : 'enforced'),
    quota: OWNER_CAP,
  }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
};
