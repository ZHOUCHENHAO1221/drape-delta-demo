import { getStore } from '@netlify/blobs';

// Shared access to the asset index.
//
// The index is one JSON blob that every endpoint reads and that upload/delete rewrite whole.
// @netlify/blobs 8.2.0 has no conditional write (SetOptions carries only `metadata` — no
// onlyIfMatch/onlyIfNew), so a true compare-and-swap is not available, and list() returns
// {etag, key} without metadata, so splitting the index into one blob per asset would cost one
// round trip per row on every /list. Both real fixes are therefore closed off at this version.
//
// What is left is to make the race's HARMFUL outcome impossible rather than merely unlikely:
//   * a lost write is recoverable  — verify after writing and retry;
//   * a resurrected deletion is not — a row that comes back points at a file and a record that
//     were already erased, so it is a permanent tombstone in the library and, worse, an
//     erasure the contributor was told had happened. A deleted key is therefore recorded and
//     filtered out of EVERY subsequent index write, whichever request wins the race.

const IDX = 'index';
const TOMB = 'tombstones';
const TOMB_MAX = 500;

const store = () => getStore('drape-index');

export async function readIndex() {
  try {
    const cur = await store().get(IDX, { type: 'json' });
    return Array.isArray(cur) ? cur : [];
  } catch { return []; }
}

async function readTombstones() {
  try {
    const t = await store().get(TOMB, { type: 'json' });
    return Array.isArray(t) ? t : [];
  } catch { return []; }
}

export async function addTombstone(key) {
  const t = await readTombstones();
  if (!t.includes(key)) t.unshift(key);
  await store().setJSON(TOMB, t.slice(0, TOMB_MAX));
}

/**
 * Read the index, apply `mutate`, write it back, then read it back to confirm the change
 * survived. Retries on a lost write. Returns the array that is actually stored.
 *
 * `mutate(idx)` must return the new array, and may be called more than once — it has to be
 * free of side effects outside the array it is handed.
 * `check(stored)` returns true when this request's own change is present.
 */
export async function updateIndex(mutate, check, tries = 3) {
  const s = store();
  let last = [];
  for (let attempt = 0; attempt < tries; attempt++) {
    const dead = new Set(await readTombstones());
    const cur = await readIndex();
    // A deleted key never comes back, no matter whose snapshot this request started from.
    const next = (await mutate(cur.filter((a) => !dead.has(a.key)))).filter((a) => !dead.has(a.key));
    await s.setJSON(IDX, next);
    last = await readIndex();
    if (!check || check(last)) return last;
  }
  return last;
}

/**
 * Cap how many rows one contributor may hold, and evict only from that contributor.
 *
 * The previous global "keep the newest 200" rule meant anyone could push everybody else out
 * of the library by uploading 200 small files. Under a per-owner cap the only rows a
 * contributor can ever displace are their own.
 *
 * Rows with no recorded owner (open-mode / legacy uploads) share one bucket, which is the
 * conservative reading: they cannot be attributed, so they cannot be given individual room.
 */
export const OWNER_CAP = 20;

export function ownerBucket(row) {
  return row && row.ownerId ? 'u:' + row.ownerId : 'anon';
}

export function overQuota(idx, bucket, cap = OWNER_CAP) {
  const mine = idx.filter((a) => ownerBucket(a) === bucket);
  return mine.length > cap ? mine.slice(cap) : [];
}
