// Task-row access for the cloud comparison workspace. NOT YET DEPLOYED:
// requires schema.sql applied to the Supabase project and SUPABASE_SERVICE_KEY set.
//
// ── The version contract (D1.2.1 fix 1) ─────────────────────────────────────────
// Every writer of drape_tasks — this file and the Python worker — takes part in ONE
// version sequence. A mutation is legal only as:
//
//     UPDATE ... SET <fields>, version = seen + 1
//      WHERE task_id = ? AND owner = ? AND version = seen AND <guards>
//
// matching the version it read AND incrementing it. The previous revision PATCHed
// without touching version, which let this interleaving destroy a cancellation:
//
//     worker reads v=7 -> HTTP cancel writes status=cancelled, still v=7
//     -> worker's `WHERE version=7` still matches -> cancel overwritten.
//
// Because every path now bumps the version, the worker's own CAS write fails after
// any HTTP write, and vice versa. test_cross_writer_interleaving.py proves it on one
// shared database with the real handler and the real worker.
//
// The state machine lives in _delta_cloud_worker/task_service.py; the guards below
// are the same transitions expressed as filters. They are kept honest by
// test_transition_contract.mjs, which compares them against that module — a comment
// is not a defence against drift.
//
// Identity: `owner` always comes from a verified Supabase token (see _auth.mjs
// getUser). It is never read from a request body — no endpoint accepts it.

const TABLE = 'drape_tasks';
const MAX_CAS_RETRIES = 8;

export function dbConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

function rest(path, { method = 'GET', body, prefer } = {}) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  const headers = { apikey: key, authorization: 'Bearer ' + key,
                    'content-type': 'application/json' };
  if (prefer) headers.prefer = prefer;
  return fetch(process.env.SUPABASE_URL + '/rest/v1/' + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// PostgREST reports failures as a JSON body carrying `code` (the SQLSTATE). Losing it
// turned a unique-violation into a 500 (D1.2.1 fix 5), so the code is preserved on the
// thrown error and callers branch on it.
async function rows(response) {
  const text = await response.text();
  if (!response.ok) {
    let payload = null;
    try { payload = JSON.parse(text); } catch { /* not JSON: keep the text */ }
    const error = new Error('db ' + response.status + ' ' + (payload?.message || text));
    if (payload?.code) error.code = payload.code;
    error.status = response.status;
    error.details = payload?.details ?? null;
    throw error;
  }
  return text ? JSON.parse(text) : [];
}

const REPRESENT = 'return=representation';

export const supabaseTaskDb = {
  async insert(task) {
    const got = await rows(await rest(TABLE, { method: 'POST', body: task, prefer: REPRESENT }));
    return got[0] || null;
  },

  async listByOwner(owner) {
    return rows(await rest(
      `${TABLE}?owner=eq.${encodeURIComponent(owner)}&order=created_at.desc`));
  },

  async getOwned(taskId, owner) {
    const got = await rows(await rest(
      `${TABLE}?task_id=eq.${encodeURIComponent(taskId)}&owner=eq.${encodeURIComponent(owner)}`));
    return got[0] || null;
  },

  // Precise lookup — never a full-table scan that pagination could truncate (fix 5).
  async findByIdempotencyKey(owner, key) {
    const got = await rows(await rest(
      `${TABLE}?owner=eq.${encodeURIComponent(owner)}`
      + `&idempotency_key=eq.${encodeURIComponent(key)}&limit=1`));
    return got[0] || null;
  },

  // One conditional update carrying the version it read, and incrementing it.
  async updateGuarded(taskId, owner, seenVersion, guard, patch) {
    const filters = [`task_id=eq.${encodeURIComponent(taskId)}`,
                     `owner=eq.${encodeURIComponent(owner)}`,
                     `version=eq.${seenVersion}`]
      .concat(Object.entries(guard).map(([k, v]) => `${k}=${v}`))
      .join('&');
    const got = await rows(await rest(`${TABLE}?${filters}`, {
      method: 'PATCH', body: { ...patch, version: seenVersion + 1 }, prefer: REPRESENT,
    }));
    return got[0] || null;   // null => version moved, guard failed, or not yours
  },
};

// Read-guard-write with the version sequence, retrying when another writer got there
// first. `plan(row)` returns {guard, patch} or a string reason to refuse.
export async function mutate(db, taskId, owner, plan) {
  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt += 1) {
    const row = await db.getOwned(taskId, owner);
    if (!row) return { row: null, reason: 'not_found' };
    const planned = plan(row);
    if (typeof planned === 'string') return { row, reason: planned };
    const updated = await db.updateGuarded(taskId, owner, row.version,
                                           planned.guard || {}, planned.patch);
    if (updated) return { row: updated, reason: null };
    // 0 rows changed: re-read and decide again on the current state.
  }
  return { row: null, reason: 'contended' };
}

// In-memory double for the HTTP permission tests. It enforces the SAME rules the
// PostgREST filters express, INCLUDING the version match — the previous double bumped
// the version unconditionally, which is precisely why the CAS gap went unnoticed.
// It is not a database: no transactions, single-threaded.
export function makeMemoryTaskDb(seed = []) {
  const store = new Map(seed.map((t) => [t.task_id, structuredClone(t)]));
  const matches = (row, key, expression) => {
    const cut = expression.indexOf('.');
    const [op, value] = [expression.slice(0, cut), expression.slice(cut + 1)];
    const actual = row[key];
    if (op === 'eq') return String(actual) === value;
    if (op === 'is') return value === 'false' ? actual === false
      : value === 'true' ? actual === true : actual === null;
    if (op === 'not') {
      const list = value.slice(value.indexOf('(') + 1, -1).split(',');
      return !list.includes(String(actual));
    }
    if (op === 'in') {
      const list = value.slice(value.indexOf('(') + 1, -1).split(',');
      return list.includes(String(actual));
    }
    throw new Error('unsupported filter ' + expression);
  };
  return {
    _rows: store,
    async insert(task) {
      if (task.idempotency_key && [...store.values()].some(
        (r) => r.owner === task.owner && r.idempotency_key === task.idempotency_key)) {
        const error = new Error('duplicate key value violates unique constraint');
        error.code = '23505';                    // same shape the real adapter now throws
        throw error;
      }
      store.set(task.task_id, structuredClone(task));
      return structuredClone(task);
    },
    async listByOwner(owner) {
      return [...store.values()].filter((r) => r.owner === owner)
        .map((r) => structuredClone(r));
    },
    async getOwned(taskId, owner) {
      const row = store.get(taskId);
      return row && row.owner === owner ? structuredClone(row) : null;
    },
    async findByIdempotencyKey(owner, key) {
      const row = [...store.values()].find(
        (r) => r.owner === owner && r.idempotency_key === key);
      return row ? structuredClone(row) : null;
    },
    async updateGuarded(taskId, owner, seenVersion, guard, patch) {
      const row = store.get(taskId);
      if (!row || row.owner !== owner) return null;
      if (Number(row.version) !== Number(seenVersion)) return null;   // the CAS
      for (const [key, expression] of Object.entries(guard)) {
        if (!matches(row, key, expression)) return null;
      }
      Object.assign(row, structuredClone(patch), { version: seenVersion + 1 });
      return structuredClone(row);
    },
  };
}
