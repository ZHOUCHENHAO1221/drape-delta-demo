// Cloud comparison workspace API. NOT YET DEPLOYED — needs schema.sql applied to the
// Supabase project, a private 'drape-inputs' bucket, and SUPABASE_SERVICE_KEY set.
// Until then dbConfigured() is false and every route answers 503 rather than pretending.
//
//   POST /jobs                      create a task (owner + mode are server-decided)
//   GET  /jobs                      list my tasks            (page refresh restores here)
//   GET  /jobs/:id                  read one of my tasks
//   POST /jobs/:id/upload-url       short-lived signed upload slot for one input
//   POST /jobs/:id/finalize         hand the inputs to server-side content verification
//   POST /jobs/:id/confirm-garment  choose the single garment group
//   POST /jobs/:id/confirm-hem      accept or reject the measurement boundary
//   POST /jobs/:id/cancel           cancel my task
//
// Every mutation goes through mutate(), i.e. read -> guard -> conditional update that
// matches AND increments the version, so an HTTP write and a worker write on the same
// row can never overwrite one another (D1.2.1 fix 1).
//
// This file DOES encode owner-facing transitions (OWNER_TRANSITIONS below). The worker
// side owns the same machine in Python; test_transition_contract.mjs asserts the two
// agree, because a comment claiming "only one implementation" was not true.

import { getUser, authEnabled } from './_auth.mjs';
import { dbConfigured, supabaseTaskDb, mutate } from './_taskdb.mjs';

const ROLES = ['garment', 'baseline', 'candidate'];
const MAX_INPUT_BYTES = 512 * 1024 * 1024;
const TERMINAL = ['complete', 'failed', 'cancelled'];

// Engines that actually drive CLO. Anything else executed nothing in CLO, whatever
// the task's planned mode says.
const CLO_ENGINES = ['clo-headless'];

// The owner-facing half of the state machine, as data so it can be contract-tested
// against _delta_cloud_worker/task_service.py.
export const OWNER_TRANSITIONS = {
  finalize: { from: 'awaiting_inputs', to: 'verifying_inputs' },
  'confirm-garment': { from: 'awaiting_garment_selection', to: 'queued_preview' },
  'confirm-hem-accept': { from: 'awaiting_confirmation', to: 'queued_compare' },
  'confirm-hem-reject': { from: 'awaiting_confirmation', to: 'cancelled' },
  cancel: { fromNot: TERMINAL, to: 'cancelled' },
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

// What the browser is allowed to see.
//
// D1.2.1 fix 4: `mode` is the executor a task is PLANNED for, never evidence that
// anything ran. Execution evidence is stage_engines, written only when a stage really
// finished. A freshly created real task therefore reports simulatedInClo=false and an
// empty `executed` — it has simulated nothing yet.
function view(row) {
  const executed = row.stage_engines || {};
  return {
    taskId: row.task_id, status: row.status,
    mode: row.mode, isMock: row.mode === 'mock',
    executed,
    simulatedInClo: CLO_ENGINES.includes(executed.comparing),
    previewedInClo: CLO_ENGINES.includes(executed.previewing),
    createdAt: row.created_at, inputs: row.inputs, inputsFrozen: row.inputs_frozen,
    garmentCandidates: row.garment_candidates, garmentScope: row.garment_scope,
    anchor: row.anchor ? { vertices: (row.anchor.vertexIds || []).length,
                           confirmed: !!row.anchor.confirmed } : null,
    runs: row.runs || [], summary: row.summary, error: row.error,
  };
}

function validateInputs(meta) {
  if (!meta || typeof meta !== 'object') return 'inputs required';
  for (const role of ROLES) {
    const item = meta[role];
    if (!item || typeof item !== 'object') return 'missing input: ' + role;
    if (typeof item.name !== 'string' || !item.name) return 'missing name: ' + role;
    // sha256 is OPTIONAL: browsers cannot stream-digest a 512 MB file, so large
    // uploads omit it and the server-side verifier's own hash becomes authoritative.
    if (item.sha256 != null && !/^[0-9a-f]{64}$/.test(String(item.sha256))) {
      return 'bad sha256: ' + role;
    }
    const bytes = Number(item.bytes);
    if (!Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_INPUT_BYTES) {
      return 'bad size: ' + role;
    }
  }
  return null;
}

const REFUSAL = {
  not_found: [404, 'not found'],
  contended: [409, 'this task is being updated; try again'],
};

function refuse(reason, fallback) {
  const known = REFUSAL[reason];
  if (known) return json({ error: known[1] }, known[0]);
  return json({ error: fallback[1] }, fallback[0]);
}

export async function handleJobs(req, deps) {
  const { getUser: auth, db, storage, now = () => Date.now() / 1000,
          allowMock = process.env.DRAPE_ALLOW_MOCK === '1' } = deps;

  const user = await auth(req);
  if (!user) return json({ error: 'sign in to use cloud comparison' }, 401);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/functions\/jobs/, '').replace(/\/+$/, '');
  const [, taskId, action] = path.split('/');
  let body = {};
  if (req.method === 'POST') {
    try { body = await req.json(); } catch { body = {}; }
  }

  // ── collection ────────────────────────────────────────────────────────────────
  if (!taskId) {
    if (req.method === 'GET') {
      return json({ tasks: (await db.listByOwner(user.id)).map(view) });
    }
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    const bad = validateInputs(body.inputs);
    if (bad) return json({ error: bad }, 400);
    const mode = (allowMock && body.mode === 'mock') ? 'mock' : 'real';
    const idempotencyKey = typeof body.idempotencyKey === 'string'
      ? body.idempotencyKey.slice(0, 100) : null;
    const id = crypto.randomUUID();
    const inputs = {};
    for (const role of ROLES) {
      inputs[role] = {
        name: String(body.inputs[role].name).slice(0, 120),
        bytes: Number(body.inputs[role].bytes),
        sha256: body.inputs[role].sha256 ?? null,
        uploaded: false, verified: false,
        storageKey: `inputs/${user.id}/${id}/${role}`,
      };
    }
    try {
      const row = await db.insert({
        task_id: id, owner: user.id, mode, status: 'awaiting_inputs', version: 1,
        idempotency_key: idempotencyKey,
        created_at: now(), inputs, inputs_frozen: false, attempt: 0,
        stage_engines: {}, runs: [], events: [],
      });
      return json({ task: view(row) }, 201);
    } catch (error) {
      // Unique violation on (owner, idempotency_key): the structured SQLSTATE now
      // survives the adapter, and the existing row is fetched by exact key.
      if (error && error.code === '23505' && idempotencyKey) {
        const existing = await db.findByIdempotencyKey(user.id, idempotencyKey);
        if (existing) {
          // Same key, different inputs is a client bug, not a retry: say so instead of
          // handing back a task whose files are not the ones just described.
          const same = ROLES.every((r) =>
            existing.inputs?.[r]?.sha256 === inputs[r].sha256
            && existing.inputs?.[r]?.bytes === inputs[r].bytes
            && existing.inputs?.[r]?.name === inputs[r].name);
          return same ? json({ task: view(existing) }, 200)
                      : json({ error: 'this idempotency key was used for different files' }, 409);
        }
      }
      return json({ error: 'could not create task' }, 500);
    }
  }

  // ── one task (always scoped to this owner) ────────────────────────────────────
  if (!/^[0-9a-f-]{36}$/.test(taskId)) return json({ error: 'not found' }, 404);

  if (req.method === 'GET' && !action) {
    const row = await db.getOwned(taskId, user.id);
    // Another account's task is "not found", never "forbidden": existence stays private.
    return row ? json({ task: view(row) }) : json({ error: 'not found' }, 404);
  }
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  if (action === 'upload-url') {
    const role = body.role;
    if (!ROLES.includes(role)) return json({ error: 'unknown role' }, 400);
    const row = await db.getOwned(taskId, user.id);
    if (!row) return json({ error: 'not found' }, 404);
    if (row.inputs_frozen || row.status !== 'awaiting_inputs') {
      return json({ error: 'inputs are frozen for this task' }, 409);
    }
    // TUS descriptor: the browser uploads with its own session JWT under storage
    // RLS; nothing signed or secret is issued here (see _taskstorage.mjs).
    const spec = await storage.uploadSpec(row.inputs[role].storageKey);
    return json({ role, ...spec });
  }

  if (action === 'finalize') {
    // The function checks only what it can cheaply and safely check: that an object
    // exists for every role and its SIZE matches. It deliberately does NOT claim to
    // have verified content — hashing a 512 MB upload does not belong in a serverless
    // request. The task moves to verifying_inputs and the worker streams each object,
    // computes SHA-256, and only then freezes and queues it (D1.2.1 fix 3).
    const result = await mutate(db, taskId, user.id, (row) => {
      if (row.inputs_frozen || row.status !== OWNER_TRANSITIONS.finalize.from) return 'frozen';
      return { guard: { status: 'eq.' + OWNER_TRANSITIONS.finalize.from,
                        inputs_frozen: 'is.false' },
               patch: { status: OWNER_TRANSITIONS.finalize.to } };
    });
    if (result.reason === 'frozen') {
      return json({ error: 'inputs are already finalized for this task' }, 409);
    }
    if (result.reason) return refuse(result.reason, [409, 'could not finalize']);

    // presence + declared size, before handing over to content verification
    const missing = [];
    for (const role of ROLES) {
      const declared = result.row.inputs[role];
      const info = await storage.statObject(declared.storageKey);
      if (!info) missing.push(role + ': not uploaded');
      else if (Number(info.bytes) !== Number(declared.bytes)) {
        missing.push(role + ': size does not match');
      }
    }
    if (missing.length) {
      // put it back so the person can finish uploading
      await mutate(db, taskId, user.id, (row) =>
        (row.status === 'verifying_inputs'
          ? { guard: { status: 'eq.verifying_inputs' },
              patch: { status: 'awaiting_inputs' } }
          : 'gone'));
      return json({ error: missing.join('; '), stage: 'upload' }, 409);
    }
    return json({ task: view(result.row),
                  note: 'content verification runs server-side before the task is queued' });
  }

  if (action === 'confirm-garment') {
    if (body.confirmedSingleGarment !== true) {
      return json({ error: 'single-garment confirmation is required' }, 400);
    }
    const step = OWNER_TRANSITIONS['confirm-garment'];
    const result = await mutate(db, taskId, user.id, (row) => {
      if (row.status !== step.from) return 'wrong_state';
      if (!(row.garment_candidates || []).some((g) => g.id === body.groupId)) {
        return 'unknown_group';
      }
      return { guard: { status: 'eq.' + step.from },
               patch: { garment_scope: { groupId: body.groupId,
                                         confirmedSingleGarment: true, confirmedAt: now() },
                        status: step.to } };
    });
    if (result.reason === 'unknown_group') return json({ error: 'unknown group' }, 400);
    if (result.reason) {
      return refuse(result.reason, [409, 'task is not waiting for a garment']);
    }
    return json({ task: view(result.row) });
  }

  if (action === 'confirm-hem') {
    const accept = body.accept === true;
    const step = OWNER_TRANSITIONS[accept ? 'confirm-hem-accept' : 'confirm-hem-reject'];
    const result = await mutate(db, taskId, user.id, (row) => {
      if (row.status !== step.from) return 'wrong_state';
      return { guard: { status: 'eq.' + step.from },
               patch: accept
                 ? { anchor: { ...(row.anchor || {}), confirmed: true }, status: step.to }
                 : { status: step.to } };
    });
    if (result.reason) {
      return refuse(result.reason, [409, 'task is not waiting for hem confirmation']);
    }
    return json({ task: view(result.row) });
  }

  if (action === 'cancel') {
    const result = await mutate(db, taskId, user.id, (row) => {
      if (TERMINAL.includes(row.status)) return 'finished';
      return { guard: { status: `not.in.(${TERMINAL.join(',')})` },
               patch: { status: 'cancelled', lease: null } };
    });
    if (result.reason === 'finished') return json({ error: 'task already finished' }, 409);
    if (result.reason) return refuse(result.reason, [409, 'could not cancel']);
    return json({ task: view(result.row) });
  }

  return json({ error: 'not found' }, 404);
}

export default async (req) => {
  if (!authEnabled()) {
    return json({ error: 'cloud comparison needs accounts; this deployment has none' }, 503);
  }
  if (!dbConfigured()) {
    return json({ error: 'cloud comparison is not deployed yet (no task database)' }, 503);
  }
  const { supabaseStorage } = await import('./_taskstorage.mjs');
  return handleJobs(req, { getUser, db: supabaseTaskDb, storage: supabaseStorage });
};
