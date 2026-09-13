/* DRAPE DELTA — cloud comparison workspace (browser side).

   NOT LIVE YET. The API answers 503 until the task database is provisioned, and this
   module then renders NOTHING: the page keeps its existing local-comparison route.

   Identity: the session comes from the site's auth module, window.DRAPE_AUTH
   (init/token/user/onChange — the real public shape of auth.js). D1.2.2 auth rules:
     - the auth subscription is bound ONCE, before any network branch, so signing in
       after an initially signed-out mount opens the workspace without a reload;
     - every account change synchronously clears the previous account's DOM, open
       task and busy state BEFORE the replacement request starts;
     - every response carries the generation it was requested under; a stale
       response (older account, superseded view) is discarded, never painted.

   Uploads (D1.2.2): TUS resumable protocol against Supabase Storage, 6 MiB chunks
   via file.slice() — the file is never read whole into memory, progress is shown
   per chunk, and an interrupted upload resumes from the server's offset. Client
   SHA-256 is computed only for files up to 64 MiB (crypto.subtle cannot stream);
   larger files omit it and the SERVER-side verifier's streamed hash is the
   authoritative one either way.

   Progress: non-terminal machine states are polled with a bounded, backoff timer
   that pauses while the tab is hidden and stops on terminal states, states waiting
   for the person, and errors.

   Execution honesty: `mode` is the planned executor; only `simulatedInClo` — derived
   server-side from the stage that actually ran — means CLO simulated anything. */
(function () {
  'use strict';
  var API = '/.netlify/functions/jobs';
  var ROLES = ['garment', 'baseline', 'candidate'];
  var ACCEPT = { garment: '.zprj', baseline: '.zfab', candidate: '.zfab' };
  var UPLOADING = { garment: 'Uploading your CLO project…',
                    baseline: 'Uploading fabric A…', candidate: 'Uploading fabric B…' };
  var HASH_LIMIT = 64 * 1024 * 1024;   // crypto.subtle needs the whole buffer in memory

  var LABEL = {
    awaiting_inputs: 'Waiting for your files',
    verifying_inputs: 'Checking your files',
    queued_prepare: 'Waiting for the comparison machine',
    preparing: 'Reading your project',
    awaiting_garment_selection: 'Choose which garment to compare',
    queued_preview: 'Waiting for the comparison machine',
    previewing: 'Finding the hem',
    awaiting_confirmation: 'Confirm the measurement boundary',
    queued_compare: 'Waiting for the comparison machine',
    comparing: 'Simulating six times',
    complete: 'Comparison finished',
    failed: 'This comparison stopped',
    cancelled: 'Cancelled'
  };
  var NEEDS_YOU = { awaiting_inputs: 1, awaiting_garment_selection: 1, awaiting_confirmation: 1 };
  // The server can move these along without the person doing anything, so they are
  // the ONLY states worth polling. Terminal, waiting-for-you and error states stop.
  var POLLABLE = { verifying_inputs: 1, queued_prepare: 1, preparing: 1,
                   queued_preview: 1, previewing: 1, queued_compare: 1, comparing: 1 };
  var POLL_START_MS = 4000;
  var POLL_MAX_MS = 30000;
  var POLL_LIMIT = 200;                // bounded: ~1.7h worst case, then stops

  function label(task) { return LABEL[task.status] || 'Working'; }
  function notSimulated(task) { return !(task && task.simulatedInClo); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function auth() { return window.DRAPE_AUTH || null; }
  function anonKey() {
    try { return (window.DRAPE_SUPABASE || {}).anonKey || null; } catch (e) { return null; }
  }

  function request(path, options) {
    var a = auth();
    var token = a && a.token ? a.token() : null;
    var init = options || {};
    var headers = init.headers || {};
    if (token) headers.authorization = 'Bearer ' + token;
    if (init.body && typeof init.body === 'string') headers['content-type'] = 'application/json';
    init.headers = headers;
    init.cache = 'no-store';
    return (window.fetch)(API + (path || ''), init);
  }

  function post(path, body) {
    return request(path, { method: 'POST', body: JSON.stringify(body || {}) })
      .then(function (r) {
        return r.json().catch(function () { return {}; })
          .then(function (data) {
            if (!r.ok) throw new Error(data.error || ('request failed (' + r.status + ')'));
            return data;
          });
      });
  }

  /* SHA-256 for SMALL files only (see HASH_LIMIT). Returns null for larger files —
     the server-side verifier hashes the stored object anyway, and its value is the
     authoritative one in both cases. */
  function fileHash(file) {
    if (file.size > HASH_LIMIT) return Promise.resolve(null);
    return file.arrayBuffer().then(function (buffer) {
      return crypto.subtle.digest('SHA-256', buffer).then(function (digest) {
        return Array.prototype.map.call(new Uint8Array(digest), function (b) {
          return ('0' + b.toString(16)).slice(-2);
        }).join('');
      });
    });
  }

  // ── TUS resumable upload (Supabase Storage) ──────────────────────────────────
  // Creation + PATCH chunks per tus.io 1.0.0, the protocol Supabase's resumable
  // endpoint speaks. file.slice() keeps memory at one chunk. On any interruption
  // the upload URL is kept (localStorage best-effort) and resumed via HEAD.
  function b64(s) { return btoa(unescape(encodeURIComponent(s))); }

  function tusMeta(spec, file) {
    return 'bucketName ' + b64(spec.bucket) + ',objectName ' + b64(spec.objectName)
      + ',contentType ' + b64(file.type || 'application/octet-stream')
      + ',cacheControl ' + b64('3600');
  }

  function tusHeaders(extra) {
    var a = auth();
    var token = a && a.token ? a.token() : null;
    var headers = { 'tus-resumable': '1.0.0' };
    if (token) headers.authorization = 'Bearer ' + token;
    var key = anonKey();
    if (key) headers.apikey = key;
    if (extra) Object.keys(extra).forEach(function (k) { headers[k] = extra[k]; });
    return headers;
  }

  /* The stash binds a resumable URL to the FILE IDENTITY it was created for
     (name:size:lastModified). Resuming with a different file would splice that
     file's tail onto the old bytes — so any mismatch, and any legacy bare-string
     stash, discards the URL and starts a fresh upload. */
  function fileFingerprint(file) {
    return [file.name, file.size, file.lastModified || 0].join(':');
  }

  function stashKey(spec) { return 'drape_tus_' + spec.objectName; }
  function stashGet(spec) {
    try {
      var raw = localStorage.getItem(stashKey(spec));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.url !== 'string' || typeof parsed.fp !== 'string') {
        return null;                              // legacy or foreign format: unusable
      }
      return parsed;
    } catch (e) { return null; }                  // bare-string legacy stash included
  }
  function stashSet(spec, url, fp) {
    try {
      if (url) localStorage.setItem(stashKey(spec), JSON.stringify({ url: url, fp: fp }));
      else localStorage.removeItem(stashKey(spec));
    } catch (e) { /* per-viewer convenience only */ }
  }

  function tusCreate(spec, file) {
    return fetch(spec.endpoint, {
      method: 'POST',
      headers: tusHeaders({ 'upload-length': String(file.size),
                            'upload-metadata': tusMeta(spec, file),
                            'x-upsert': 'false' }),   // never overwrite an object
    }).then(function (r) {
      if (r.status !== 201) throw new Error('upload could not start (' + r.status + ')');
      var location = r.headers.get('location');
      if (!location) throw new Error('upload could not start (no location)');
      return new URL(location, spec.endpoint).href;
    });
  }

  function tusOffset(url) {
    return fetch(url, { method: 'HEAD', headers: tusHeaders() }).then(function (r) {
      if (!r.ok) return null;                      // session gone: caller starts fresh
      var offset = Number(r.headers.get('upload-offset'));
      return Number.isFinite(offset) ? offset : null;
    }, function () { return null; });
  }

  /* Retry schedule for transient failures (network reject, 429, 5xx with no server
     progress). 404/410/409 mean the upload session itself is gone or contested —
     those recreate the upload (still bounded by the same schedule). Exhausting the
     schedule throws a message saying the upload can be resumed later — the stashed
     URL survives for the next attempt. */
  var TUS_RETRY_DELAYS = [0, 1000, 3000, 8000, 20000];

  function tusUpload(spec, file, onProgress, abort) {
    var fp = fileFingerprint(file);
    var chunk = spec.chunkBytes || 6 * 1024 * 1024;
    var state = { url: null, offset: 0, retries: 0 };

    function assertAlive() {
      if (abort && abort.aborted) throw new Error('upload aborted');
    }
    function create() {
      return tusCreate(spec, file).then(function (url) {
        state.url = url; state.offset = 0;
        stashSet(spec, url, fp);
      });
    }
    function ensureUrl() {
      if (state.url) return Promise.resolve();
      var kept = stashGet(spec);
      if (kept && kept.fp === fp) {
        return tusOffset(kept.url).then(function (offset) {
          if (offset === null || offset > file.size) {   // expired, or not this file
            stashSet(spec, null);
            return create();
          }
          state.url = kept.url; state.offset = offset;
          if (onProgress) onProgress(state.offset, file.size);
        });
      }
      if (kept) stashSet(spec, null);   // different file identity: never resume it
      return create();
    }
    function backoff(reason, recreate) {
      if (state.retries >= TUS_RETRY_DELAYS.length) {
        throw new Error(reason + ' — the upload can be resumed later');
      }
      var delay = TUS_RETRY_DELAYS[state.retries];
      state.retries += 1;
      return new Promise(function (resolve) { setTimeout(resolve, delay); })
        .then(function () {
          if (recreate) { stashSet(spec, null); state.url = null; }
          return pump();
        });
    }
    function pump() {
      assertAlive();
      return ensureUrl().then(function () {
        if (state.offset >= file.size) { stashSet(spec, null); return; }
        assertAlive();
        var slice = file.slice(state.offset, Math.min(state.offset + chunk, file.size));
        return fetch(state.url, {
          method: 'PATCH',
          headers: tusHeaders({ 'upload-offset': String(state.offset),
                                'content-type': 'application/offset+octet-stream' }),
          body: slice,
        }).then(function (r) {
          if (r.status === 204) {
            var next = Number(r.headers.get('upload-offset'));
            if (!Number.isFinite(next)) next = state.offset + slice.size;
            if (next < state.offset) throw new Error('server offset went backwards');
            state.offset = next;
            state.retries = 0;                       // progress resets the schedule
            if (onProgress) onProgress(Math.min(state.offset, file.size), file.size);
            return pump();
          }
          if (r.status === 404 || r.status === 410 || r.status === 409) {
            // session expired (URLs live at most 24 h), was removed, or lost a
            // same-path race: this URL is dead, recreate under the schedule
            return backoff('upload session lost (' + r.status + ')', true);
          }
          // 429 / 5xx: ask the server how far it actually got, then retry
          return tusOffset(state.url).then(function (offset) {
            if (offset !== null && offset > state.offset) {
              if (offset > file.size) throw new Error('server offset beyond the file');
              state.offset = offset;                 // the chunk did land
              state.retries = 0;
              if (onProgress) onProgress(state.offset, file.size);
              return pump();
            }
            if (offset !== null && offset < state.offset) {
              throw new Error('server offset went backwards');
            }
            return backoff('upload interrupted (' + r.status + ')', false);
          });
        }, function () {                             // network reject
          return backoff('network error during upload', false);
        });
      });
    }
    return pump();
  }

  // ── rendering ────────────────────────────────────────────────────────────────
  function mockBadge(task) {
    if (!notSimulated(task)) return '';
    var why = task.isMock ? 'Test run &middot; not simulated in CLO'
                          : 'Not simulated in CLO yet';
    return '<div class="note" style="margin-top:6px">' + why + '</div>';
  }

  function taskRow(task) {
    var name = task.inputs && task.inputs.garment ? task.inputs.garment.name : 'Comparison';
    return '<div class="mod cloudtask" data-task="' + esc(task.taskId) + '">'
      + '<div class="t">' + esc(name) + '</div>'
      + '<div class="li">' + esc(label(task)) + '</div>'
      + (NEEDS_YOU[task.status] ? '<div class="li" style="margin-top:6px">Needs you</div>' : '')
      + mockBadge(task)
      + '<div class="mlinks" style="margin-top:8px"><div class="mlink cloudopen" '
      + 'data-task="' + esc(task.taskId) + '" style="flex:1">Open this comparison '
      + '<span class="ar">&rarr;</span></div></div>'
      + '</div>';
  }

  function renderTasks(tasks) {
    if (!tasks || !tasks.length) {
      return '<div class="mod"><div class="li">No cloud comparisons yet.</div></div>';
    }
    return tasks.map(taskRow).join('');
  }

  function newFormHTML() {
    var fields = ROLES.map(function (role, i) {
      var title = role === 'garment' ? 'Your CLO project'
        : role === 'baseline' ? 'Fabric A' : 'Fabric B';
      return '<div class="li" style="margin-top:8px">' + (i + 1) + ' &middot; ' + title
        + ' (' + ACCEPT[role] + ')</div>'
        + '<input type="file" class="cloudfile" data-role="' + role + '" accept="'
        + ACCEPT[role] + '">';
    }).join('');
    return '<div class="mod"><div class="t">Start a new comparison</div>'
      + '<div class="li">Your files are simulated on the DRAPE comparison machine. '
      + 'You do not need CLO on this device.</div>'
      + fields
      + '<div class="mlinks" style="margin-top:10px"><div class="mlink cloudstart" '
      + 'style="flex:1">Upload and start <span class="ar">&rarr;</span></div></div>'
      + '<div class="li cloudprogress" style="margin-top:6px"></div></div>';
  }

  function detailHTML(task) {
    var parts = ['<div class="mod"><div class="t">'
      + esc(task.inputs && task.inputs.garment ? task.inputs.garment.name : 'Comparison')
      + '</div><div class="li">' + esc(label(task)) + '</div>' + mockBadge(task) + '</div>'];

    if (task.status === 'awaiting_inputs') {
      // Resume path: re-pick the SAME files and continue THIS task — a failed or
      // interrupted upload must not force a brand-new task. The TUS stash resumes
      // any partly-uploaded object when the picked file's identity matches.
      var pickers = ROLES.map(function (role, i) {
        var title = role === 'garment' ? 'Your CLO project'
          : role === 'baseline' ? 'Fabric A' : 'Fabric B';
        return '<div class="li" style="margin-top:8px">' + (i + 1) + ' &middot; ' + title
          + ' (' + ACCEPT[role] + ')</div>'
          + '<input type="file" class="cloudfile" data-role="' + role + '" accept="'
          + ACCEPT[role] + '">';
      }).join('');
      parts.push('<div class="mod"><div class="t">Finish uploading your files</div>'
        + '<div class="li">Choose the same files again to resume this upload where it '
        + 'stopped. A different file starts that upload over.</div>'
        + pickers
        + '<div class="mlinks" style="margin-top:10px"><div class="mlink cloudresume" '
        + 'style="flex:1">Resume upload <span class="ar">&rarr;</span></div></div>'
        + '<div class="li cloudprogress" style="margin-top:6px"></div></div>');
    }

    if (task.status === 'awaiting_garment_selection' && task.garmentCandidates) {
      var options = task.garmentCandidates.map(function (g) {
        return '<div class="mlinks" style="margin-top:6px"><div class="mlink cloudgarment" '
          + 'data-group="' + esc(g.id) + '" style="flex:1">Compare this one'
          + '<span> &middot; </span><span>' + esc(g.patternCount || '?') + '</span>'
          + '<span> pattern pieces</span> <span class="ar">&rarr;</span></div></div>';
      }).join('');
      parts.push('<div class="mod"><div class="t">Which garment is this comparison about?</div>'
        + '<div class="li">One group at a time. Grouping follows sewing, not garment '
        + 'recognition, so please check it is one complete garment.</div>'
        + '<label class="li" style="margin-top:8px"><input type="checkbox" class="cloudsingle"> '
        + 'I checked: this group is one complete garment.</label>' + options + '</div>');
    }

    if (task.status === 'awaiting_confirmation' && task.anchor) {
      parts.push('<div class="mod"><div class="t">Is this the hem you want measured?</div>'
        + '<div class="li"><span>' + esc(task.anchor.vertices) + '</span>'
        + '<span> points on one closed boundary</span></div>'
        + '<div class="mlinks" style="margin-top:8px">'
        + '<div class="mlink cloudhem" data-accept="1" style="flex:1">Yes, compare this hem '
        + '<span class="ar">&rarr;</span></div></div>'
        + '<div class="mlinks" style="margin-top:6px">'
        + '<div class="mlink ghost cloudhem" data-accept="0" style="flex:1">'
        + 'No, stop this comparison</div></div></div>');
    }

    if (task.status === 'complete' && task.runs && task.runs.length) {
      parts.push('<div class="mod"><div class="t">Result</div>'
        + '<div class="li"><span>' + esc(task.runs.length) + '</span>'
        + '<span> runs recorded</span></div>'
        + (notSimulated(task)
            ? '<div class="note" style="margin-top:6px">Test run &middot; not simulated in CLO</div>'
            : '') + '</div>');
    }

    if (task.error) {
      parts.push('<div class="note" style="margin-top:6px">' + esc(task.error) + '</div>');
    }

    var terminal = task.status === 'complete' || task.status === 'failed'
      || task.status === 'cancelled';
    if (!terminal) {
      parts.push('<div class="mlinks" style="margin-top:8px">'
        + '<div class="mlink ghost cloudcancel" style="flex:1">Cancel this comparison</div></div>');
    }
    parts.push('<div class="mlinks" style="margin-top:6px">'
      + '<div class="mlink cloudback" style="flex:1">Back to my comparisons</div></div>');
    return parts.join('');
  }

  // ── controller ───────────────────────────────────────────────────────────────
  function Workspace(el) {
    this.el = el;
    this.openId = null;
    this.busy = false;
    // generation: bumped on every account change and every navigation; a response
    // fetched under an older generation is discarded, never painted. reqSeq orders
    // requests WITHIN a generation too: only the latest issued request may paint,
    // so two concurrent loads can never end as last-write-wins.
    this.gen = 0;
    this.reqSeq = 0;
    // one abort token per upload batch: account change, task cancel or leaving the
    // workspace flips it, and every in-flight TUS loop stops before its next fetch
    this.uploadAbort = null;
    this.pollTimer = null;
    this.pollCount = 0;
    this.pollDelay = POLL_START_MS;
    this.hidden = false;
    var self = this;
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', function () {
        self.hidden = !!document.hidden;
        if (!self.hidden) self.schedulePoll(self.lastStatuses || []);  // resume
      });
    }
  }

  /* Which statuses justify another poll. Exposed for tests. */
  Workspace.prototype.shouldPoll = function (statuses) {
    if (this.pollCount >= POLL_LIMIT) return false;
    for (var i = 0; i < statuses.length; i += 1) {
      if (POLLABLE[statuses[i]]) return true;
    }
    return false;
  };

  Workspace.prototype.stopPoll = function () {
    if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
  };

  Workspace.prototype.schedulePoll = function (statuses) {
    var self = this;
    self.stopPoll();
    self.lastStatuses = statuses;
    if (!self.shouldPoll(statuses)) return;
    var delay = self.hidden ? Math.max(self.pollDelay * 4, POLL_MAX_MS) : self.pollDelay;
    self.pollTimer = setTimeout(function () {
      self.pollTimer = null;
      if (self.hidden) { self.schedulePoll(self.lastStatuses); return; }  // wait it out
      self.pollCount += 1;
      self.pollDelay = Math.min(self.pollDelay * 1.5, POLL_MAX_MS);
      self.load().catch(function () { self.schedulePoll(self.lastStatuses); });
    }, delay);
  };

  Workspace.prototype.say = function (message) {
    var box = this.el.querySelector('.cloudprogress');
    if (box) box.textContent = message;
  };

  /* Every load is generation-stamped: a response from an older generation (previous
     account, superseded navigation) must never touch the DOM. */
  Workspace.prototype.load = function () {
    var self = this;
    var gen = self.gen;
    var seq = ++self.reqSeq;
    var current = function () { return gen === self.gen && seq === self.reqSeq; };
    if (self.openId) {
      var id = self.openId;
      return request('/' + id).then(function (r) {
        if (!current()) return;                             // stale: discard silently
        if (r.status === 404) { self.openId = null; return self.load(); }
        if (!r.ok) throw new Error('could not load this comparison');
        return r.json().then(function (data) {
          if (!current() || self.openId !== id) return;
          self.paint(null, data.task);
        });
      });
    }
    return request('').then(function (r) {
      if (!current()) return;
      if (!r.ok) throw new Error('could not load your comparisons');
      return r.json().then(function (data) {
        if (!current() || self.openId) return;
        self.paint(data.tasks || [], null);
      });
    });
  };

  Workspace.prototype.paint = function (tasks, task) {
    this.el.innerHTML = '<div class="sect" style="margin-top:16px">My cloud comparisons</div>'
      + (task ? detailHTML(task) : (newFormHTML() + renderTasks(tasks)));
    this.bind();   // i18n.js observes the DOM, so inserted text is translated for us
    this.schedulePoll(task ? [task.status]
                           : (tasks || []).map(function (t) { return t.status; }));
  };

  /* Account change: called by mount's ONE auth subscription. Synchronously wipes
     the previous account's DOM and state BEFORE any replacement request runs. */
  Workspace.prototype.abortUploads = function () {
    if (this.uploadAbort) this.uploadAbort.aborted = true;
    this.uploadAbort = null;
  };

  Workspace.prototype.resetForUser = function () {
    this.gen += 1;                 // orphan every in-flight response
    this.abortUploads();           // never PATCH an old account's URL with a new token
    this.openId = null;
    this.busy = false;
    this.pollCount = 0;
    this.pollDelay = POLL_START_MS;
    this.stopPoll();
    this.el.innerHTML = '';        // nothing of the previous account survives
  };

  Workspace.prototype.bind = function () {
    var self = this;
    var on = function (selector, handler) {
      Array.prototype.forEach.call(self.el.querySelectorAll(selector), function (node) {
        node.addEventListener('click', function (event) { handler(node, event); });
      });
    };
    on('.cloudopen', function (node) {
      self.gen += 1; self.openId = node.getAttribute('data-task');
      self.pollCount = 0; self.pollDelay = POLL_START_MS;
      self.refresh();
    });
    on('.cloudback', function () {
      self.abortUploads();         // leaving the workspace stops the transfer
      self.gen += 1; self.openId = null;
      self.pollCount = 0; self.pollDelay = POLL_START_MS;
      self.refresh();
    });
    on('.cloudstart', function () { self.start(); });
    on('.cloudresume', function () { self.resume(); });
    on('.cloudcancel', function () {
      self.abortUploads();         // a cancelled task must not keep uploading
      self.guard(post('/' + self.openId + '/cancel', {}));
    });
    on('.cloudgarment', function (node) {
      var box = self.el.querySelector('.cloudsingle');
      if (!box || !box.checked) { self.toast('Please confirm this is one complete garment.'); return; }
      self.guard(post('/' + self.openId + '/confirm-garment',
        { groupId: node.getAttribute('data-group'), confirmedSingleGarment: true }));
    });
    on('.cloudhem', function (node) {
      self.guard(post('/' + self.openId + '/confirm-hem',
        { accept: node.getAttribute('data-accept') === '1' }));
    });
  };

  Workspace.prototype.toast = function (message) {
    var box = document.createElement('div');
    box.className = 'note';
    box.style.marginTop = '6px';
    box.textContent = message;
    this.el.appendChild(box);
  };

  Workspace.prototype.guard = function (promise) {
    var self = this;
    if (self.busy) return;
    self.busy = true;
    return promise.then(function () { self.busy = false; return self.refresh(); })
      .catch(function (error) { self.busy = false; self.toast(error.message); });
  };

  Workspace.prototype.refresh = function () {
    var self = this;
    return self.load().catch(function (error) { self.toast(error.message); });
  };

  Workspace.prototype.pickedFiles = function () {
    var self = this;
    var chosen = {};
    var missing = [];
    ROLES.forEach(function (role) {
      var input = self.el.querySelector('.cloudfile[data-role="' + role + '"]');
      if (input && input.files && input.files[0]) chosen[role] = input.files[0];
      else missing.push(role);
    });
    return missing.length ? null : chosen;
  };

  /* Upload all three roles to ONE existing task via TUS, then finalize. Used by the
     fresh-start flow and by the resume flow on an awaiting_inputs task. */
  Workspace.prototype.uploadFlow = function (id, chosen, alive) {
    var self = this;
    var abort = { aborted: false };
    self.uploadAbort = abort;
    return ROLES.reduce(function (promise, role) {
      return promise.then(function () {
        if (!alive() || abort.aborted) throw new Error('cancelled');
        self.say(UPLOADING[role]);
        return post('/' + id + '/upload-url', { role: role }).then(function (spec) {
          return tusUpload(spec, chosen[role], function (done, total) {
            if (alive()) {
              self.say(UPLOADING[role] + ' ' + Math.floor(100 * done / total) + '%');
            }
          }, abort);
        });
      });
    }, Promise.resolve()).then(function () {
      if (!alive() || abort.aborted) throw new Error('cancelled');
      self.say('Checking the uploaded files…');
      return post('/' + id + '/finalize', {});
    });
  };

  /* Fresh start: hash small files -> create -> uploadFlow. */
  Workspace.prototype.start = function () {
    var self = this;
    if (self.busy) return;
    var chosen = self.pickedFiles();
    if (!chosen) { self.say('Choose all three files first.'); return; }

    self.busy = true;
    var gen = self.gen;
    var alive = function () { return gen === self.gen; };
    self.say('Checking your files…');
    var meta = {};
    var chain = ROLES.reduce(function (promise, role) {
      return promise.then(function () {
        return fileHash(chosen[role]).then(function (hash) {
          meta[role] = { name: chosen[role].name, bytes: chosen[role].size };
          if (hash) meta[role].sha256 = hash;   // large files: server hash is authoritative
        });
      });
    }, Promise.resolve());

    chain.then(function () {
      if (!alive()) throw new Error('cancelled');
      self.say('Creating the comparison…');
      var fingerprint = ROLES.map(function (r) {
        return meta[r].sha256 || (meta[r].name + ':' + meta[r].bytes);
      }).join('|');
      return post('', { inputs: meta, idempotencyKey: fingerprint.slice(0, 90) + ':' + Date.now() });
    }).then(function (data) {
      var id = data.task.taskId;
      if (alive()) self.openId = id;
      return self.uploadFlow(id, chosen, alive);
    }).then(function () {
      self.busy = false;
      if (alive()) return self.refresh();
    }).catch(function (error) {
      self.busy = false;
      if (alive() && error.message !== 'cancelled') self.say(error.message);
    });
  };

  /* Resume: same task, same roles; the TUS stash continues a matching file from its
     last server offset, and a different file starts that role's upload over. */
  Workspace.prototype.resume = function () {
    var self = this;
    if (self.busy || !self.openId) return;
    var chosen = self.pickedFiles();
    if (!chosen) { self.say('Choose all three files first.'); return; }
    self.busy = true;
    var gen = self.gen;
    var alive = function () { return gen === self.gen; };
    self.uploadFlow(self.openId, chosen, alive).then(function () {
      self.busy = false;
      if (alive()) return self.refresh();
    }).catch(function (error) {
      self.busy = false;
      if (alive() && error.message !== 'cancelled') self.say(error.message);
    });
  };

  /* Mount. The auth subscription is bound ONCE, up front, before any network
     branch — so a later sign-in re-probes on its own, and an account switch wipes
     the panel synchronously. */
  function mount(el, opts) {
    if (!el) return Promise.resolve('absent');
    var a = auth();
    var workspace = new Workspace(el);
    el.__drapeWorkspace = workspace;
    // Host pages hear EVERY availability transition (live / signed-out /
    // unavailable), not only the first probe — a late sign-in on the phone must
    // withdraw the "a phone cannot do this" guidance, and a sign-out must bring
    // it back. The callback never throws into the workspace.
    function notify(outcome) {
      if (opts && typeof opts.onAvailability === 'function') {
        try { opts.onAvailability(outcome); } catch (e) { /* host's problem */ }
      }
      return outcome;
    }

    function probe() {
      var gen = workspace.gen;
      var seq = ++workspace.reqSeq;
      var current = function () { return gen === workspace.gen && seq === workspace.reqSeq; };
      return request('').then(function (response) {
        if (!current()) return 'stale';
        if (response.status === 401) {
          el.innerHTML = '<div class="note">Sign in to use cloud comparison.</div>';
          return notify('signed-out');
        }
        if (!response.ok) { el.innerHTML = ''; return notify('unavailable'); }
        return response.json().then(function (data) {
          if (!current()) return 'stale';
          workspace.paint(data.tasks || [], null);
          return notify('live');
        });
      }).catch(function () {
        if (current()) el.innerHTML = '';
        return notify('unavailable');
      });
    }

    var lastUser;
    var first = true;
    if (a && a.onChange) {
      a.onChange(function (state) {
        var id = state && state.user ? state.user.id : null;
        if (first) { first = false; lastUser = id; return; }   // initial replay
        if (id === lastUser) return;                            // token refresh only
        lastUser = id;
        workspace.resetForUser();                               // synchronous wipe
        if (!id) {
          el.innerHTML = '<div class="note">Sign in to use cloud comparison.</div>';
          notify('signed-out');
        } else {
          probe();                                              // signed in (late or switched)
        }
      });
    }

    var ready = (a && a.init) ? Promise.resolve(a.init()).catch(function () { return null; })
                              : Promise.resolve(null);
    return ready.then(function () {
      lastUser = a && a.user && a.user() ? a.user().id : lastUser;
      return probe();
    });
  }

  window.DrapeCloudJobs = { mount: mount, renderTasks: renderTasks, detailHTML: detailHTML,
                            label: label, notSimulated: notSimulated, fileHash: fileHash,
                            tusUpload: tusUpload, Workspace: Workspace,
                            POLLABLE: POLLABLE };
})();
