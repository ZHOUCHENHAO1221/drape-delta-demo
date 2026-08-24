/* DRAPE DELTA — live layer.
   Turns the "Already measured elsewhere?" dropzone into a REAL uploader backed by
   Netlify Functions + Blobs, with optional Supabase accounts (email magic-link + Google).
   Integrity unchanged: it uploads an already-measured file and stores it as a candidate —
   it does NOT derive properties or produce a delta. When accounts are wired, each upload
   is owned by a real signed-in contributor and only its owner can delete it. */
(function () {
  var API = '/.netlify/functions';

  // Deployed in a real browser — drop the desktop "window mock" chrome, fill the viewport.
  try { document.body.classList.add('live'); } catch (e) {}

  function fmtSize(n) {
    if (n == null) return '';
    return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
  }
  function esc(s) { return String(s).replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]; }); }
  function pass() { return sessionStorage.getItem('drape_pass') || ''; }

  // --- qualification record -------------------------------------------------------
  // The library stores files; this stores why a file can be trusted. It is what lets the
  // library grow past its author: without it, a stranger's fabric is a filename.
  // Mirrors netlify/functions/_qual.mjs - keep the two field lists in step.
  var QF = [
    ['supplier', 'Supplier / mill', ''],
    ['batch', 'Batch / roll', ''],
    ['composition', 'Composition', 'e.g. 100% cotton'],
    ['construction', 'Construction', 'woven / knit'],
    ['weight', 'Weight (g/m²)', ''],
    ['testMethod', 'Test method(s)', 'e.g. ISO 3801 · ISO 5084 · ISO 13934-1'],
    ['testDate', 'Test date', 'YYYY-MM-DD'],
    ['lab', 'Lab / operator', ''],
    ['cloVersion', 'CLO version', 'e.g. CLO3D 2026.0.374', 1],
    ['basePreset', 'Baseline preset', 'e.g. V2_Woven_Poplin_1', 1],
  ];
  // The five inputs a cloth simulator consumes. Which were physically measured rather than
  // left at the engine default is the fact that decides whether a record can drive a
  // simulation at all, so it is a checklist, not a free-text claim.
  var QINPUTS = ['weight', 'thickness', 'bending', 'stretch', 'shear'];
  // Mirrors REQUIRED_FIELDS in netlify/functions/_qual.mjs. Without these two a record
  // cannot be re-checked after CLO revises its generic library, so the server refuses it
  // — say so on the form rather than letting someone lose a filled-in record to a 422.
  var QREQ = ['cloVersion', 'basePreset'];
  // The contributor's own current uploads, for the 'replaces' picker. Filled by /list.
  var MYASSETS = [];

  // Module scope on purpose: the contribution panel is rebuilt by innerHTML whenever the
  // user changes tab, and the 401 passphrase path re-enters doUpload. A draft held in the
  // DOM would be lost by both.
  var QDRAFT = { measured: [] };

  // Count exactly the way the server will, or the panel promises a record the server then
  // refuses to keep: _qual.mjs trims every value and voids a test date that is not YYYY-MM-DD.
  function qValue(k) {
    var v = String(QDRAFT[k] == null ? '' : QDRAFT[k]).replace(/[\r\n\t]/g, ' ').trim();
    if (k === 'testDate' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
    return v;
  }
  function qCounts() {
    var f = 0;
    for (var i = 0; i < QF.length; i++) if (qValue(QF[i][0])) f++;
    return { m: QDRAFT.measured.length, f: f };
  }
  function qEmpty() { var c = qCounts(); return c.m === 0 && c.f === 0; }
  function qMissingRequired() { return qEmpty() ? [] : QREQ.filter(function (k) { return !qValue(k); }); }
  // A record belongs to the file it was filed with. Carrying it forward would silently
  // re-attach one fabric's supplier, batch and lab to the next upload — and if that next
  // upload goes out on the public channel, publish them.
  function qReset() { QDRAFT = { measured: [] }; }


  // --- auth glue (no-op until supabase-config.js holds real values) ---
  function authOn() { return !!(window.DRAPE_AUTH && DRAPE_AUTH.configured()); }
  function authUser() { return (window.DRAPE_AUTH && DRAPE_AUTH.user && DRAPE_AUTH.user()) || null; }
  function authHeaders(base) {
    base = base || {};
    var t = (window.DRAPE_AUTH && DRAPE_AUTH.token && DRAPE_AUTH.token()) || '';
    if (t) base['authorization'] = 'Bearer ' + t;
    else if (pass()) base['x-drape-pass'] = pass();
    return base;
  }

  // Whether the SERVER can actually enforce the private channel. Assume it can until /list
  // says otherwise, so a slow network never flashes a false alarm; the server refuses private
  // uploads in that state anyway, so the UI is a courtesy, not the guard.
  var PRIVACY = 'enforced';

  async function listAssets() {
    try {
      var r = await fetch(API + '/list', { headers: authHeaders() });
      if (!r.ok) return [];
      var j = await r.json();
      if (j && j.privacy) { PRIVACY = j.privacy; paintPrivacy(); }
      // Only your own CURRENT uploads can be replaced: superseded ones are already history.
      MYASSETS = (j.assets || []).filter(function (a) { return a.mine && !a.supersededBy; });
      paintSupersede();
      return j.assets || [];
    } catch (e) { return []; }
  }

  // Say it on the control itself, before anyone chooses. A private label the server cannot
  // honour is the one failure a contributor has no way of noticing for themselves.
  function paintPrivacy() {
    var pv = document.querySelector('input[name="drapevis"][value="private"]');
    if (!pv) return;
    var lab = pv.closest ? pv.closest('label') : null;
    var warn = document.querySelector('.qprivwarn');
    if (PRIVACY === 'shared') {
      // One shared secret: private still means not-public, but not "only you".
      if (warn) {
        warn.textContent = 'This deployment is passphrase-protected: a private file is hidden from the public listing, but anyone holding the passphrase can open it.';
        warn.hidden = false;
      }
      pv.disabled = false;
      if (lab) lab.style.opacity = '';
      return;
    }
    if (PRIVACY === 'unenforced') {
      pv.disabled = true;
      pv.checked = false;
      var pub = document.querySelector('input[name="drapevis"][value="public"]');
      if (pub) pub.checked = true;
      if (lab) lab.style.opacity = '.45';
      if (warn) {
        warn.textContent = 'Private uploads are unavailable on this deployment: sign-in is not configured on the server, so it cannot keep anything private. Public channel only.';
        warn.hidden = false;
      }
    } else {
      pv.disabled = false;
      if (lab) lab.style.opacity = '';
      if (warn) warn.hidden = true;
    }
  }

  function paintSupersede() {
    var sel = document.querySelector('[data-qsup]');
    if (!sel) return;
    var keep = sel.value;
    sel.innerHTML = '<option value="">\u2014 nothing; this is a new fabric</option>' +
      MYASSETS.map(function (a) {
        return '<option value="' + esc(a.key) + '">' + esc(a.name) + ' (v' + (a.version || 1) + ')</option>';
      }).join('');
    if (keep) sel.value = keep;
  }

  async function renderList(box) {
    var assets = await listAssets();
    if (!assets.length) {
      box.innerHTML = '<div class="uz-s" style="margin-top:10px">No measured assets uploaded to this deployment yet.</div>';
      return;
    }
    var rows = assets.map(function (a) {
      // Public attribution is a display name if the contributor set one — never an email.
      var owner = a.by ? '<span style="opacity:.55"> · ' + esc(a.by) + '</span>' : '';
      // A superseded row is not deleted — it is history, and saying so is the point of
      // keeping it. Silence would leave two rows looking like two different fabrics.
      var ver = (a.version && a.version > 1) ? '<span style="opacity:.55"> \u00b7 v' + a.version + '</span>' : '';
      var sup = a.supersededBy ? '<span style="opacity:.55"> \u00b7 superseded</span>' : '';
      var chan = a.visibility === 'public'
        ? '<span style="opacity:.55"> · public</span>'
        : '<span style="opacity:.55"> · private</span>';
      // An unqualified candidate says so. Silence would read as "fine", and the whole
      // point of the record is that a reader can tell the difference.
      // Both counts, because a record that is only the five engine-input ticks is the most
      // useful one there is — and showing it as "0/10" would rank it last.
      var q = a.qual
        ? '<a href="#" data-q="' + esc(a.key) + '" style="color:var(--ink2);text-decoration:none;margin-left:10px">record ' +
          a.qual.f + '/' + QF.length + ' &middot; ' + a.qual.m + '/' + QINPUTS.length + ' inputs &#9662;</a>'
        : '<span style="opacity:.45;margin-left:10px">no record filed</span>';
      var del = a.canDelete ? '<a href="#" data-del="' + esc(a.key) + '" data-name="' + esc(a.name) + '" style="color:#c0473a;text-decoration:none;margin-left:12px">delete &times;</a>' : '';
      return '<div class="prow"><span>' + esc(a.name) + ' <span style="opacity:.6">· ' + fmtSize(a.size) + '</span>' + ver + owner + chan + sup + '</span>' +
        '<b>' + q + '<a href="#" data-dl="' + esc(a.key) + '" data-dlname="' + esc(a.name) + '" style="color:var(--green);text-decoration:none;margin-left:10px">download &darr;</a>' + del + '</b></div>' +
        '<div class="qdet" data-qfor="' + esc(a.key) + '" hidden></div>';
    }).join('');
    box.innerHTML =
      '<div class="sect" style="margin-top:14px">Uploaded candidates &middot; pending review &middot; live &middot; ' + assets.length + '</div>' +
      '<div class="prov">' + rows + '</div>' +
      '<div class="uz-s" style="margin-top:7px">Really uploaded &amp; stored on this deployment (survives reload) &mdash; as candidates, not registered measured assets. Public-channel files are listed here for everyone; private-channel files appear only for the contributor who uploaded them and for the library moderator. No delta is shown; provenance review, a named baseline and a garment comparison are the offline steps in the flow above.</div>';
  }


  // Private files need the bearer token, which only a fetch can send; public files go
  // down the same path so there is a single implementation to reason about.
  async function dlAsset(key, name, link) {
    var was = link ? link.textContent : '';
    if (link) link.textContent = 'preparing…';
    try {
      var r = await fetch(API + '/download?key=' + encodeURIComponent(key), { headers: authHeaders() });
      // Every failure path used to leave the message parked in the link, so the row lost its
      // download control until the whole list re-rendered. Say it, then give the control back.
      var fail = function (msg) { if (link) { link.textContent = msg; setTimeout(function () { if (link.isConnected) link.textContent = was; }, 4000); } };
      if (r.status === 401) { fail('sign in to download'); return; }
      if (r.status === 403) { fail('private to its contributor'); return; }
      if (!r.ok) { fail('download failed (' + r.status + ')'); return; }
      var blob = await r.blob();
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = name || 'asset';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      if (link) link.textContent = was;
    } catch (e) {
      if (link) link.textContent = 'download error';
      if (window.DRAPE_REPORT) window.DRAPE_REPORT('download failed', String(e && e.message));
    }
  }

  // Fetched on expand, not with the list: the record is gated like the file it describes,
  // so it travels with a token and only when someone actually asks for it.
  async function showQual(key, box, link) {
    var host = box.querySelector('[data-qfor="' + key + '"]');
    if (!host) return;
    if (!host.hidden) { host.hidden = true; link.innerHTML = link.innerHTML.replace('▴', '▾'); return; }
    host.hidden = false;
    link.innerHTML = link.innerHTML.replace('▾', '▴');
    if (host.dataset.loaded) return;
    host.innerHTML = '<div class="uz-s">loading record...</div>';
    try {
      var r = await fetch(API + '/qual?key=' + encodeURIComponent(key), { headers: authHeaders() });
      // renderList may have replaced the whole list while this was in flight (another upload,
      // a delete, a sign-in). Writing into the old node would silently collapse the record.
      host = box.querySelector('[data-qfor="' + key + '"]');
      if (!host || !host.isConnected) return;
      if (!r.ok) { host.innerHTML = '<div class="uz-s">record unavailable (' + r.status + ')</div>'; return; }
      var j = await r.json();
      if (!j.record) { host.innerHTML = '<div class="uz-s">No record was filed with this upload.</div>'; return; }
      var qr = j.fields.map(function (f) {
        var v = j.record[f[0]];
        return '<div class="prow"><span>' + esc(f[1]) + '</span><b>' + (v ? esc(v) : '&mdash;') + '</b></div>';
      }).join('');
      var meas = j.inputs.map(function (k) {
        var on = (j.record.measured || []).indexOf(k) >= 0;
        return '<span style="opacity:' + (on ? '1' : '.4') + '">' + (on ? '✓ ' : '· ') + k + '</span>';
      }).join('&nbsp;&nbsp;');
      host.innerHTML = qr +
        '<div class="prow w"><span>Engine inputs measured</span><b>' + meas + '</b></div>' +
        '<div class="uz-s" style="margin-top:6px">Declared by the contributor, shown as filed &mdash; not verified by this deployment.</div>';
      host.dataset.loaded = '1';
    } catch (e) {
      host.innerHTML = '<div class="uz-s">record error</div>';
    }
  }

  async function delAsset(key, box) {
    try {
      var r = await fetch(API + '/delete', { method: 'POST', headers: authHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ key: key }) });
      if (r.status === 401) {
        if (authOn()) { alert('Please sign in to delete.'); return; }
        var p = window.prompt('Passphrase required to delete:');
        if (p) { sessionStorage.setItem('drape_pass', p); return delAsset(key, box); }
        return;
      }
      if (r.status === 403) { alert('You can only delete your own uploads.'); return; }
      if (!r.ok) {
        alert('Delete failed (' + r.status + ').');
        if (window.DRAPE_REPORT) window.DRAPE_REPORT('delete failed', String(r.status));
        return;
      }
      renderList(box);
    } catch (e) {
      alert('Delete error: ' + e.message);
      if (window.DRAPE_REPORT) window.DRAPE_REPORT('delete error', String(e && e.message));
    }
  }

  async function doUpload(file, statusEl, listBox) {
    if (authOn() && !authUser()) { statusEl.textContent = 'Please sign in to contribute a fabric (account menu, top of panel).'; return; }
    if (file.size > 25 * 1048576) { statusEl.textContent = 'File too large — max 25 MB in this demo.'; return; }
    statusEl.textContent = 'Uploading ' + file.name + ' …';
    var picked = document.querySelector('input[name="drapevis"]:checked');
    var visibility = picked ? picked.value : 'private';
    var fd = new FormData(); fd.append('file', file); fd.append('visibility', visibility);
    // QDRAFT is module-scoped, so the 401 passphrase retry below re-sends the same record
    // rather than silently dropping it.
    var miss = qMissingRequired();
    if (miss.length) {
      statusEl.textContent = 'Add the ' + miss.map(function (k) {
        for (var i = 0; i < QF.length; i++) if (QF[i][0] === k) return QF[i][1];
        return k;
      }).join(' and the ') + ' before uploading \u2014 a record without them cannot be re-checked when CLO revises its library.';
      return;
    }
    if (!qEmpty()) fd.append('qual', JSON.stringify(QDRAFT));
    var supEl = document.querySelector('[data-qsup]');
    if (supEl && supEl.value) fd.append('supersedes', supEl.value);
    try {
      var r = await fetch(API + '/upload', { method: 'POST', body: fd, headers: authHeaders() });
      if (r.status === 401) {
        if (authOn()) { statusEl.textContent = 'Please sign in to contribute.'; return; }
        var p = window.prompt('This deployment is passphrase-protected. Enter passphrase:');
        if (p) { sessionStorage.setItem('drape_pass', p); return doUpload(file, statusEl, listBox); }
        statusEl.textContent = 'Upload cancelled.'; return;
      }
      if (!r.ok) {
        var e = await r.json().catch(function () { return {}; });
        statusEl.textContent = 'Upload failed: ' + (e.error || r.status);
        if (window.DRAPE_REPORT) window.DRAPE_REPORT('upload failed', r.status + ' ' + (e.error || ''));
        return;
      }
      var j = await r.json();
      statusEl.textContent = '✓ received & stored as a candidate: ' + j.name + ' (' + fmtSize(j.size) + ')' +
        (j.owner ? ' · by ' + j.owner : '') +
        (j.visibility === 'public' ? ' · PUBLIC — listed for everyone' : ' · PRIVATE — you and the moderator') +
        (j.qual ? ' · record ' + j.qual.f + '/' + QF.length + ' fields, ' + j.qual.m + '/' + QINPUTS.length + ' inputs declared measured (not verified)'
                : ' · no record filed') +
        '. Real upload, reload-safe. A named baseline + garment comparison are still required before any delta.';
      // The record travels with its file and stops there.
      qReset();
      if (window.DRAPE_QRESET) window.DRAPE_QRESET();
      renderList(listBox);
    } catch (err) {
      statusEl.textContent = 'Upload error: ' + err.message;
      if (window.DRAPE_REPORT) window.DRAPE_REPORT('upload error', String(err && err.message));
    }
  }

  function wireLive() {
    var uz = document.querySelector('.uploadz');
    if (!uz || uz._live) return;
    uz._live = true;

    // Sign-in now happens on the launch gate + persistent identity chip, so no sign-in bar here.
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.zfab,.csv,.pdf,.txt,.json,.xlsx';
    inp.style.display = 'none';

    var status = document.createElement('div');
    status.className = 'uz-s';
    status.style.marginTop = '8px';
    status.style.textAlign = 'center';

    var listBox = document.createElement('div');

    // Grab the badge BEFORE anything is inserted in front of the dropzone — the relabel
    // below reads previousElementSibling, and the channel chooser now sits in that slot.
    var badge = uz.previousElementSibling;

    // Two intake channels. The choice is the contributor's and it is made BEFORE the
    // file picker opens, so nobody discovers the read policy after the fact.
    var vis = document.createElement('div');
    vis.className = 'uz-s';
    vis.style.cssText = 'margin:10px 0 2px;text-align:left;display:flex;flex-direction:column;gap:6px';
    vis.innerHTML =
      '<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer">' +
      '<input type="radio" name="drapevis" value="public" style="margin-top:3px">' +
      '<span><b>Public channel</b> — listed in the shared library; anyone can browse it, download it and read its record.</span></label>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer">' +
      '<input type="radio" name="drapevis" value="private" checked style="margin-top:3px">' +
      '<span><b>Private channel</b> — not listed publicly; visible to you and to the library moderator.</span></label>' +
      '<div class="qprivwarn" style="color:#c0473a;line-height:1.45" hidden></div>';
    injectQualCss();

    // One innerHTML write, not incremental appends: i18n.js observes every node added
    // under body and re-runs its language-pill placement, so churn here is expensive.
    var qw = document.createElement('div');
    qw.className = 'qwrap';
    var qrows = QF.map(function (f) {
      return '<label class="qf"><span>' + f[1] + (f[3] ? ' <b style="color:var(--green)">*</b>' : '') + '</span>' +
        '<input class="qin" type="text" data-qk="' + f[0] + '" placeholder="' + f[2] + '" value="' + esc(QDRAFT[f[0]] || '') + '"></label>';
    }).join('');
    var qboxes = QINPUTS.map(function (k) {
      return '<label class="qchk"><input type="checkbox" data-qi="' + k + '"' +
        (QDRAFT.measured.indexOf(k) >= 0 ? ' checked' : '') + '><span>' + k + '</span></label>';
    }).join('');
    qw.innerHTML =
      '<div class="qhead"><b>Qualification record</b>' +
      '<a href="#" class="qtog" data-qtog="1">add record &#9662;</a></div>' +
      '<div class="qsum"></div>' +
      '<div class="qbody" hidden>' +
      '<div class="qgrid">' + qrows + '</div>' +
      '<label class="qf" style="margin-top:9px"><span>Replaces an earlier upload of yours (optional)</span>' +
      '<select class="qin" data-qsup><option value="">\u2014 nothing; this is a new fabric</option></select></label>' +
      '<div class="qlab">Engine inputs physically measured &mdash; leave unticked whatever stayed at the engine default</div>' +
      '<div class="qboxes">' + qboxes + '</div>' +
      '<div class="qnote"><b style="color:var(--green)">*</b> required once you start a record: without the CLO version and the baseline preset, '
      + 'the record cannot be re-checked when CLO revises its generic library. ' +
      'Optional. A file without a record is still accepted and is listed as an unqualified candidate. ' +
      'A record states what was measured and by whom &mdash; it is not a claim that the fabric is accurate.</div>' +
      '</div>';
    uz.parentNode.insertBefore(vis, uz);
    uz.parentNode.insertBefore(qw, uz);
    // The panel is rebuilt on every tab change, so re-apply whatever the last /list reported
    // rather than waiting for the next one.
    paintPrivacy();
    paintSupersede();

    var qsum = qw.querySelector('.qsum');
    function qPaint() {
      var c = qCounts();
      // Re-text an existing node rather than re-rendering: see the i18n note above.
      // Numbers are interpolated, so this line can never be a whole-string dictionary key —
      // it has to pick its own language the way the auth strings do.
      qsum.textContent = isZh()
        ? c.f + '/' + QF.length + ' 项已填 · ' + c.m + '/' + QINPUTS.length + ' 项引擎输入实测'
        : c.f + '/' + QF.length + ' fields · ' + c.m + '/' + QINPUTS.length + ' engine inputs measured';
    }
    qPaint();

    // doUpload clears the model after a successful upload; the visible fields must follow,
    // otherwise the form still shows a record that is no longer attached to anything.
    window.DRAPE_QRESET = function () {
      [].forEach.call(qw.querySelectorAll('[data-qk]'), function (el) { el.value = ''; });
      [].forEach.call(qw.querySelectorAll('[data-qi]'), function (el) { el.checked = false; });
      qPaint();
    };

    // One delegated listener for the whole form.
    qw.addEventListener('input', function (e) {
      var t = e.target;
      if (t.dataset && t.dataset.qk) { QDRAFT[t.dataset.qk] = t.value; qPaint(); }
    });
    qw.addEventListener('change', function (e) {
      var t = e.target;
      if (!t.dataset || !t.dataset.qi) return;
      var k = t.dataset.qi, at = QDRAFT.measured.indexOf(k);
      if (t.checked && at < 0) QDRAFT.measured.push(k);
      if (!t.checked && at >= 0) QDRAFT.measured.splice(at, 1);
      qPaint();
    });
    qw.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-qtog]') : null;
      if (!t) return;
      e.preventDefault();
      var qb = qw.querySelector('.qbody');
      qb.hidden = !qb.hidden;
      t.innerHTML = qb.hidden ? 'add record &#9662;' : 'hide &#9652;';
    });

    uz.parentNode.insertBefore(inp, uz.nextSibling);
    uz.parentNode.insertBefore(status, inp.nextSibling);
    uz.parentNode.insertBefore(listBox, status.nextSibling);

    function pickOk() {
      if (authOn() && !authUser()) {
        status.textContent = 'Sign in first \u2014 a contributed fabric is stored against your account (account menu, top of the panel).';
        return false;
      }
      return true;
    }
    uz.onclick = function () { if (pickOk()) inp.click(); };
    uz.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (pickOk()) inp.click(); } };
    inp.onchange = function () { if (inp.files[0]) doUpload(inp.files[0], status, listBox); };

    // Per-candidate delete (delegated). Only removes uploaded candidates; seed fabrics are baked in.
    listBox.addEventListener('click', function (e) {
      var dl = e.target.closest ? e.target.closest('[data-dl]') : null;
      if (dl) { e.preventDefault(); dlAsset(dl.getAttribute('data-dl'), dl.getAttribute('data-dlname'), dl); return; }
      var qq = e.target.closest ? e.target.closest('[data-q]') : null;
      if (qq) { e.preventDefault(); showQual(qq.getAttribute('data-q'), listBox, qq); return; }
      var t = e.target.closest ? e.target.closest('[data-del]') : null;
      if (!t) return;
      e.preventDefault();
      var name = t.getAttribute('data-name') || 'this candidate';
      if (!window.confirm('Remove "' + name + '" from the library? This cannot be undone.')) return;
      delAsset(t.getAttribute('data-del'), listBox);
    });

    // Relabel the intake copy so it reads as a live candidate-intake, not "registers an asset".
    if (badge && badge.classList.contains('futbadge')) badge.textContent = 'Live file-intake demo · candidates pending review';
    var sub = uz.querySelector('.uz-s');
    if (sub) sub.innerHTML = 'Accepted: .zfab · .csv · .pdf · .txt · .json · .xlsx. The .zfab is the fabric; the rest are stored alongside it as declared evidence — they are filed, not parsed into properties. This live demo really uploads the file and stores it as a <b>candidate</b>. It is not registered as a measured asset and produces no delta &mdash; provenance review, a named baseline and a garment comparison are still required.';
    var pill = uz.querySelector('.uz-c'); if (pill) pill.textContent = 'choose a file · live';

    if (window.DRAPE_AUTH) {
      DRAPE_AUTH.init();
      DRAPE_AUTH.onChange(function () { renderIdentity(); renderList(listBox); });
    } else {
      renderList(listBox);
    }
  }

  // ---------------- sign-in gate on the launch screen (panel) + persistent identity chip ----------------
  // Real accounts via Supabase: Google + email magic-link, plus a browse-only guest lane.
  // Honesty: guests can read the whole library but cannot contribute (upload stays account-gated).
  function guestOn() { try { return sessionStorage.getItem('drape_guest') === '1'; } catch (e) { return false; } }
  function setGuest(v) { try { if (v) sessionStorage.setItem('drape_guest', '1'); else sessionStorage.removeItem('drape_guest'); } catch (e) {} }
  function guestName() { try { return sessionStorage.getItem('drape_guest_name') || ''; } catch (e) { return ''; } }
  function setGuestName(n) { try { if (n) sessionStorage.setItem('drape_guest_name', n); } catch (e) {} }

  var GICON = '<svg class="gic" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.3 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.7-9.9 6.7-17.4z"/><path fill="#FBBC05" d="M10.3 28.4c-.5-1.5-.8-3.1-.8-4.9s.3-3.4.8-4.9l-7.8-6.1C.9 15.8 0 19.6 0 23.5s.9 7.7 2.5 11l7.8-6.1z"/><path fill="#34A853" d="M24 47c6.1 0 11.3-2 15-5.5l-7.3-5.7c-2 1.4-4.7 2.3-7.7 2.3-6.4 0-11.8-3.8-13.7-9.1l-7.8 6.1C6.4 42.6 14.6 47 24 47z"/></svg>';

  // The auth gate's .an/.abtn are styled for the dark launch overlay; the record form sits
  // in the light panel, so it borrows the panel's own vocabulary (--line, --ink2, --green)
  // rather than reusing them.
  function injectQualCss() {
    if (document.getElementById('drape-qual-css')) return;
    var s = document.createElement('style'); s.id = 'drape-qual-css';
    s.textContent = [
      '.qwrap{margin:12px 0 2px;text-align:left}',
      '.qhead{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:12px;color:var(--ink)}',
      '.qsum{font-family:var(--mono);font-size:10.5px;color:var(--ink2);margin-top:3px}',
      '.qtog{font-family:var(--mono);font-size:10.5px;color:var(--green);text-decoration:none;flex:0 0 auto}',
      '.qbody{margin-top:9px}',
      '.qgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 10px}',
      '@media(max-width:520px){.qgrid{grid-template-columns:1fr}}',
      '.qf{display:flex;flex-direction:column;gap:3px;min-width:0}',
      '.qf>span{font-size:10px;color:var(--ink2)}',
      '.qin{font-family:var(--sans);font-size:11.5px;padding:7px 9px;border:1px solid var(--line);',
      'border-radius:7px;background:var(--card);color:var(--ink);outline:none;min-width:0;width:100%;box-sizing:border-box}',
      '.qin:focus{border-color:var(--green)}',
      '.qlab{font-size:10px;color:var(--ink2);margin:11px 0 5px}',
      '.qboxes{display:flex;flex-wrap:wrap;gap:6px 14px}',
      '.qchk{display:flex;align-items:center;gap:5px;font-family:var(--mono);font-size:10.5px;color:var(--ink);cursor:pointer}',
      '.qnote{font-size:10px;color:var(--ink2);line-height:1.45;margin-top:9px}',
      '.qdet{padding:2px 0 8px}',
      '.qdet .prow{font-size:10.5px}',
      // Each list row is now followed by its (usually hidden) .qdet slot, so no .prow is
      // :last-child of .prov any more and the shipped rule that removes the final hairline
      // stopped matching.
      '.prov > .prow:nth-last-child(2){border-bottom:0}',
    ].join('');
    document.head.appendChild(s);
  }

  function injectAuthCss() {
    if (document.getElementById('drape-auth-css')) return;
    var s = document.createElement('style'); s.id = 'drape-auth-css';
    s.textContent = [
      // Mobile mounts the identity chip on the Materials screen; injectQualCss only runs
      // on the contribution screen, so these rules have to live with the chip's own CSS.
      '.midid{position:relative;display:flex;justify-content:flex-end;margin:-6px 0 2px;min-height:34px}' +
      '.midid .idchip{position:static}' +
      '.midid .idmenu{right:0;left:auto}' +
      // The gate lives on the desktop's dark launch overlay AND on mobile's #intro, which
      // uses the light page surface — the same white-on-translucent-white styling is
      // unreadable there. Re-point the mobile instance at the theme tokens, which also
      // makes it correct when the phone is switched to Dark.
      '#intro .agate .an{border-color:var(--line);background:var(--card);color:var(--ink)}' +
      '#intro .agate .an::placeholder{color:var(--ink2)}' +
      '#intro .abtn.guest{color:var(--ink);border-color:var(--line)}' +
      '#intro .aor,#intro .ahint,#intro .sterms{color:var(--ink2)}' +
      '.agate{display:flex;flex-direction:column;gap:9px;width:308px;max-width:84vw;margin-top:26px;opacity:0;animation:lup .8s .8s forwards}',
      '.agate .an{font-family:var(--sans);font-size:13px;padding:12px 14px;border-radius:11px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#e9edf1;outline:none}',
      '.agate .an::placeholder{color:#8b929a}',
      '.agate .an:focus{border-color:#7fd6a0}',
      '.abtn{font-family:var(--sans);font-weight:600;font-size:14px;border-radius:12px;padding:13px 16px;cursor:pointer;border:1px solid transparent;display:flex;align-items:center;justify-content:center;gap:9px;transition:transform .16s,box-shadow .16s}',
      '.abtn:hover{transform:translateY(-1px)}',
      '.abtn.g{background:#fff;color:#1b1f24;box-shadow:0 12px 30px -14px rgba(0,0,0,.55)}',
      '.abtn.mail{background:var(--green);color:#fff;box-shadow:0 12px 30px -12px rgba(22,163,74,.6)}',
      '.abtn.guest{background:transparent;color:#aeb4bb;border:1px solid rgba(255,255,255,.16)}',
      '.abtn.guest:hover{color:#fff;border-color:rgba(255,255,255,.34)}',
      '.arow{display:flex;gap:8px}.arow .an{flex:1;min-width:0}.arow .abtn{flex:0 0 auto;padding:12px 15px}',
      '.aor{font-family:var(--mono);font-size:9.5px;color:#59616b;text-align:center;letter-spacing:.16em;margin:2px 0}',
      '.ahint{font-family:var(--mono);font-size:10px;color:#6b7580;line-height:1.55;text-align:center;margin-top:5px}',
      '.gic{width:16px;height:16px;flex:0 0 auto}',
      '.idchip{margin-left:auto;align-self:center;position:relative;font-family:var(--mono)}',
      '.idbtn{display:flex;align-items:center;gap:7px;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:5px 10px 5px 6px;cursor:pointer;color:var(--ink);font-family:var(--mono);font-size:11px;line-height:1}',
      '.idbtn:hover{border-color:var(--green)}',
      '.iddot{width:17px;height:17px;border-radius:50%;background:var(--green);color:#fff;font-weight:700;font-size:9px;display:flex;align-items:center;justify-content:center;font-family:var(--sans)}',
      '.iddot.gs{background:var(--ink2)}',
      '.idcar{color:var(--ink2);font-size:9px}',
      // var(--card) so the menu follows the theme. It was hard-coded #fff while its text
      // uses var(--ink); mobile Dark sets --ink:#f3f4f6, so mounting the chip on mobile
      // made the sign-out menu white-on-white. Desktop has no dark variant, so this is a
      // no-op there.
      '.idmenu{position:absolute;right:0;top:calc(100% + 6px);background:var(--card,#fff);border:1px solid var(--line);border-radius:12px;box-shadow:0 20px 50px -16px rgba(13,16,20,.28);padding:6px;min-width:198px;z-index:80;display:none}',
      '.idmenu.open{display:block}',
      '.idmenu .em{font-family:var(--mono);font-size:10px;color:var(--ink2);padding:7px 9px 8px;border-bottom:1px solid var(--line);overflow-wrap:anywhere;margin-bottom:4px}',
      '.idmenu button{display:block;width:100%;text-align:left;background:none;border:0;padding:8px 9px;border-radius:8px;font-family:var(--sans);font-size:12.5px;color:var(--ink);cursor:pointer}',
      '.idmenu button:hover{background:var(--panel)}',
      '.idmenu button.out{color:#c0473a}'
    ].join('');
    document.head.appendChild(s);
  }

  function idInitial(n) { n = (n || '').trim(); return n ? n.charAt(0).toUpperCase() : '?'; }

  function renderIdentity() {
    // Desktop mounts it in the panel header; mobile has no .phead, so it mounts on the
    // Materials screen. Without this the phone had no way to see who was signed in and
    // no way to sign out.
    var head = document.querySelector('.phead') || document.querySelector('.midid');
    if (!head) return;
    injectAuthCss();
    var chip = head.querySelector('.idchip');
    if (!chip) { chip = document.createElement('div'); chip.className = 'idchip'; head.appendChild(chip); }
    var u = authUser();
    if (u) {
      chip.innerHTML =
        '<button class="idbtn" data-idtoggle><span class="iddot">' + esc(idInitial(u.name)) + '</span>' + esc(u.name) + ' <span class="idcar">&#9662;</span></button>' +
        '<div class="idmenu"><div class="em">' + esc(u.email || '') + '</div>' +
        '<button data-setname>Set display name</button>' +
        '<button class="out" data-signout>Sign out</button></div>';
    } else if (guestOn()) {
      chip.innerHTML =
        '<button class="idbtn" data-idtoggle><span class="iddot gs">G</span>' + esc(guestName() || 'Guest') + ' <span class="idcar">&#9662;</span></button>' +
        '<div class="idmenu"><div class="em">Browsing as guest &middot; not signed in</div>' +
        '<button data-signin>Sign in to contribute</button></div>';
    } else {
      chip.innerHTML = '<button class="idbtn" data-signin><span class="iddot gs">&#8901;</span>Sign in</button>';
    }
    var menu = chip.querySelector('.idmenu'), tog = chip.querySelector('[data-idtoggle]');
    if (tog && menu) tog.onclick = function (e) { e.stopPropagation(); menu.classList.toggle('open'); };
    var so = chip.querySelector('[data-signout]');
    if (so) so.onclick = function (e) {
      // Without the catch, a failed network call left the promise rejected and the page
      // never reloaded - the button looked dead. Reload either way: the local session is
      // already cleared, so the user is signed out of this device regardless.
      e.stopPropagation(); setGuest(false);
      if (window.DRAPE_AUTH) DRAPE_AUTH.signOut().catch(function () {}).then(function () { location.reload(); });
      else location.reload();
    };
    var sn = chip.querySelector('[data-setname]');
    if (sn) sn.onclick = function () { var v = window.prompt('Display name:', (authUser() && authUser().name) || ''); if (v && v.trim()) DRAPE_AUTH.setName(v.trim()).then(renderIdentity); };
    var si = chip.querySelector('[data-signin]');
    if (si) si.onclick = function () { setGuest(false); reopenGate(); };
  }

  if (!window.__drapeIdClose) { window.__drapeIdClose = true; document.addEventListener('click', function () { var m = document.querySelector('.idmenu.open'); if (m) m.classList.remove('open'); }); }

  // ---------------- shared sign-in behaviour (both gates) ----------------
  function isZh() {
    try {
      return ((new URLSearchParams(location.search).get('lang')) ||
        (window.localStorage && localStorage.getItem('drape_lang'))) === 'zh';
    } catch (e) { return false; }
  }

  function authStrings() {
    return isZh() ? {
      sending: '发送中…', sent: '已发送 ✓', retry: '重试', resend: '重新发送',
      resendIn: '{s} 秒后可重发',
      errEmpty: '请输入邮箱地址。', errFormat: '这不像是一个邮箱地址。',
      errGeneric: '链接发送失败,请重试。',
      okMsg: '登录链接已发送至 {v},请在本设备打开完成登录。',
      gerr: 'Google 登录失败,请重试或改用邮箱链接。',
    } : {
      sending: 'sending…', sent: 'link sent ✓', retry: 'retry', resend: 'resend link',
      resendIn: 'resend in {s}s',
      errEmpty: 'Enter your email address.', errFormat: 'That does not look like an email address.',
      errGeneric: 'Could not send the link. Please try again.',
      okMsg: 'Sign-in link sent to {v} — open it on THIS device to finish.',
      gerr: 'Google sign-in failed. Try again, or use an email link instead.',
    };
  }

  // One status line per gate, created ONCE and only ever re-texted. It is never
  // inserted/removed per attempt: i18n.js observes every node added under body and
  // re-runs its language-pill placement, so churn there is expensive. It is also a
  // dedicated element rather than the guidance copy (.ahint / .sterms), because
  // overwriting those destroys a dictionary key and cannot be undone.
  function makeStatusLine(parent) {
    var el = document.createElement('div');
    el.className = 'ahint';
    el.setAttribute('data-authstatus', '');
    el.style.cssText = 'margin-top:6px;min-height:0;display:none;text-align:center';
    parent.appendChild(el);
    return el;
  }

  // Corrected email sign-in, used by BOTH gates. Fixes three things at once:
  // format validation before submit; a real failure path (auth.js now throws on the
  // {data,error} envelope, so .catch is no longer dead code); and a usable resend.
  function wireEmailSend(o) {
    var T = o.T, cooling = 0, timer = null;
    function status(msg, isErr) {
      if (!o.statusEl) return;
      o.statusEl.textContent = msg || '';
      o.statusEl.style.display = msg ? 'block' : 'none';
      o.statusEl.style.color = isErr ? '#e0674f' : '';
    }
    function tick() {
      cooling--;
      if (cooling <= 0) {
        clearInterval(timer); timer = null;
        o.btn.disabled = false; o.btn.style.opacity = '';
        o.btn.textContent = T.resend;
      } else o.btn.textContent = T.resendIn.replace('{s}', cooling);
    }
    o.btn.onclick = function () {
      if (o.btn.disabled) return;
      var v = (o.input.value || '').trim();
      status('');
      if (!v) { status(T.errEmpty, true); o.input.focus(); return; }
      // The input is type=email but sits outside a form, so native constraint
      // validation never fires on its own — it has to be asked explicitly.
      if (o.input.checkValidity && !o.input.checkValidity()) {
        status(T.errFormat, true); o.input.focus(); return;
      }
      var n = o.nameInput ? (o.nameInput.value || '').trim() : '';
      if (n) try { localStorage.setItem('drape_pending_name', n); } catch (e) {}
      o.btn.disabled = true; o.btn.style.opacity = '.6';
      o.btn.textContent = T.sending;
      DRAPE_AUTH.signInEmail(v).then(function () {
        o.btn.textContent = T.sent;
        status(T.okMsg.replace('{v}', v), false);
        cooling = 60;
        o.btn.textContent = T.resendIn.replace('{s}', cooling);
        timer = setInterval(tick, 1000);
      }).catch(function (e) {
        o.btn.disabled = false; o.btn.style.opacity = '';
        o.btn.textContent = T.retry;
        // Supabase's own message is shown verbatim: it is the honest source and it
        // carries the useful rate-limit text ("you can only request this after Ns").
        status((e && e.message) ? e.message : T.errGeneric, true);
      });
    };
  }

  function wireGoogle(btn, nameInput, statusEl, T) {
    btn.onclick = function () {
      var n = nameInput ? (nameInput.value || '').trim() : '';
      if (n) try { localStorage.setItem('drape_pending_name', n); } catch (e) {}
      // Google had the identical resolve-with-error bug as email: this .catch was
      // unreachable until auth.js started unwrapping the envelope.
      DRAPE_AUTH.signInGoogle().catch(function (e) {
        if (statusEl) {
          statusEl.textContent = (e && e.message) ? e.message : T.gerr;
          statusEl.style.display = 'block'; statusEl.style.color = '#e0674f';
        } else alert(T.gerr);
      });
    };
  }

  function buildGateControls(launch) {
    injectAuthCss();
    var card = launch.querySelector('.lcard'); if (!card) return;
    var lbtn = card.querySelector('.lbtn'); if (lbtn) lbtn.style.display = 'none';
    var old = card.querySelector('.agate'); if (old) old.remove();
    var g = document.createElement('div'); g.className = 'agate';
    g.innerHTML =
      '<input class="an" data-gname type="text" autocomplete="name" aria-label="Your name (optional)" placeholder="Your name (optional)">' +
      '<button class="abtn g" data-ggoogle>' + GICON + 'Continue with Google</button>' +
      '<button class="abtn guest" data-gguest>Explore as guest &rarr;</button>' +
      '<a href="#" data-gemailtoggle class="aor" style="cursor:pointer;text-decoration:none">or sign in with email</a>' +
      '<div class="arow" data-gemailrow style="display:none"><input class="an" data-gemail type="email" autocomplete="email" aria-label="Your email address" placeholder="you@email.com"><button class="abtn mail" data-gmail>Email me a link</button></div>' +
      '<div class="ahint">Guests can browse everything. Uploading a fabric needs sign-in.</div>';
    // Anchor on the button the gate REPLACES, not on '.lfoot'. The card carries several
    // .lfoot lines and more get added over time; querySelector returns the first one, so
    // anchoring there silently moves the gate whenever a new footnote is written above it.
    var anchor = card.querySelector('.lbtn') || card.querySelector('.lfoot');
    if (anchor) card.insertBefore(g, anchor); else card.appendChild(g);
    var nm = g.querySelector('[data-gname]');
    var etgl = g.querySelector('[data-gemailtoggle]'), erow = g.querySelector('[data-gemailrow]');
    if (etgl) etgl.onclick = function (e) { e.preventDefault(); var show = erow.style.display === 'none'; erow.style.display = show ? 'flex' : 'none'; if (show) { var ei = erow.querySelector('[data-gemail]'); if (ei) ei.focus(); } };
    var T = authStrings();
    var statusEl = makeStatusLine(g);
    wireGoogle(g.querySelector('[data-ggoogle]'), nm, statusEl, T);
    wireEmailSend({
      btn: g.querySelector('[data-gmail]'),
      input: g.querySelector('[data-gemail]'),
      nameInput: nm, statusEl: statusEl, T: T,
    });
    g.querySelector('[data-gguest]').onclick = function () {
      var n = (nm.value || '').trim(); setGuest(true); if (n) setGuestName(n); renderIdentity();
      if (window.enterWS) window.enterWS();
    };
  }

  function reopenGate() {
    var launch = document.getElementById('launch'); if (!launch) return;
    launch.style.display = ''; launch.classList.remove('gone');
    buildGateControls(launch);
  }

  function applyPendingName(u) {
    var p = ''; try { p = localStorage.getItem('drape_pending_name') || ''; } catch (e) {}
    if (p && u && !u.named) DRAPE_AUTH.setName(p).then(renderIdentity);
    try { localStorage.removeItem('drape_pending_name'); } catch (e) {}
  }

  function wireLaunchGate() {
    var launch = document.getElementById('launch'); if (!launch || launch._gate) return; // panel only
    launch._gate = true;
    if (!authOn()) return; // no accounts configured -> keep the original Enter workspace button
    var deeplinked = (launch.style.display === 'none');
    var card = launch.querySelector('.lcard'), lbtn = launch.querySelector('.lbtn'), chk = null;
    if (!deeplinked) {
      if (lbtn) lbtn.style.display = 'none';
      if (card) { chk = document.createElement('div'); chk.className = 'ahint'; chk.style.marginTop = '28px'; chk.textContent = 'Checking session…'; card.appendChild(chk); }
    }
    function launchLive() { return launch.style.display !== 'none' && !launch.classList.contains('gone'); }
    function resolved() {
      if (chk) { chk.remove(); chk = null; }
      var u = authUser();
      if (u) { setGuest(false); applyPendingName(u); renderIdentity(); if (launchLive()) window.enterWS && window.enterWS(); }
      else if (guestOn()) { renderIdentity(); if (launchLive()) window.enterWS && window.enterWS(); }
      else { if (!deeplinked) buildGateControls(launch); renderIdentity(); }
    }
    if (window.DRAPE_AUTH) {
      DRAPE_AUTH.init().then(resolved).catch(resolved);
      DRAPE_AUTH.onChange(function () { renderIdentity(); var u = authUser(); if (u && launchLive()) { setGuest(false); applyPendingName(u); window.enterWS && window.enterWS(); } });
    } else { resolved(); }
  }

  // Re-apply after the Request screen (re)renders — panel uses reqPanel(), mobile uses request().
  ['reqPanel', 'request'].forEach(function (fn) {
    if (typeof window[fn] === 'function') {
      var orig = window[fn];
      window[fn] = function () { var out = orig.apply(this, arguments); setTimeout(wireLive, 0); return out; };
    }
  });
  // The mobile home screen is rebuilt by innerHTML on every navigation back to it, which
  // destroys the chip along with everything else.
  if (typeof window.materials === 'function') {
    var origMaterials = window.materials;
    window.materials = function () {
      var out = origMaterials.apply(this, arguments);
      setTimeout(renderIdentity, 0);
      return out;
    };
  }
  // ---------------- mobile sign-in gate (mobile.html #intro flow; mirrors wireLaunchGate) ----------------
  function buildMobileGate(signin) {
    if (!signin || signin._mg) return;
    signin._mg = true;
    injectAuthCss();
    var zh = false;
    try { zh = ((new URLSearchParams(location.search).get('lang')) || (window.localStorage && localStorage.getItem('drape_lang'))) === 'zh'; } catch (e) {}
    var T = zh
      ? { name: '你的名字(可选)', google: '用 Google 继续', guest: '以访客浏览 →', email: '或用邮箱登录', em: '你的邮箱', link: '发送', terms: '真实账号 —— Google,或在本设备打开邮箱链接。访客可浏览;上传面料需登录。', sending: '发送中…', sent: '已发送 ✓', retry: '重试', sentMsg: function (v) { return '登录链接已发送至 ' + v + ',请在本设备打开完成登录。'; }, gerr: 'Google 登录暂不可用。' }
      : { name: 'Your name (optional)', google: 'Continue with Google', guest: 'Explore as guest &rarr;', email: 'or sign in with email', em: 'you@email.com', link: 'Link', terms: 'Real accounts — Google, or an email link opened on this device. Guests can browse; uploading a fabric needs sign-in.', sending: 'sending…', sent: 'link sent ✓', retry: 'retry', sentMsg: function (v) { return 'Sign-in link sent to ' + v + '. Open it on THIS device to finish.'; }, gerr: 'Google sign-in is unavailable.' };
    var terms = signin.querySelector('.sterms');
    [].forEach.call(signin.querySelectorAll('.sbtn,.sdiv'), function (x) { x.remove(); });
    var g = document.createElement('div'); g.className = 'agate';
    g.style.cssText = 'margin-top:18px;opacity:1;animation:none;width:auto';
    g.innerHTML =
      '<input class="an" data-mgname type="text" autocomplete="name" aria-label="Your name (optional)" placeholder="' + T.name + '">' +
      '<button class="abtn g" data-mgoogle>' + GICON + T.google + '</button>' +
      '<button class="abtn guest" data-mguest>' + T.guest + '</button>' +
      '<a href="#" data-mgetgl class="aor" style="cursor:pointer;text-decoration:none">' + T.email + '</a>' +
      '<div class="arow" data-mgerow style="display:none"><input class="an" data-mgemail type="email" autocomplete="email" aria-label="Your email address" placeholder="' + T.em + '"><button class="abtn mail" data-mgmail>' + T.link + '</button></div>';
    if (terms) { signin.insertBefore(g, terms); terms.textContent = T.terms; }
    else signin.appendChild(g);
    var nm = g.querySelector('[data-mgname]');
    var TA = authStrings();
    var statusEl = makeStatusLine(g);
    wireGoogle(g.querySelector('[data-mgoogle]'), nm, statusEl, TA);
    g.querySelector('[data-mguest]').onclick = function () {
      var n = (nm.value || '').trim(); setGuest(true); if (n) setGuestName(n); if (window.introEnter) window.introEnter();
    };
    var etgl = g.querySelector('[data-mgetgl]'), erow = g.querySelector('[data-mgerow]');
    etgl.onclick = function (e) { e.preventDefault(); var show = erow.style.display === 'none'; erow.style.display = show ? 'flex' : 'none'; if (show) { var ei = erow.querySelector('[data-mgemail]'); if (ei) ei.focus(); } };
    wireEmailSend({
      btn: g.querySelector('[data-mgmail]'),
      input: g.querySelector('[data-mgemail]'),
      nameInput: nm, statusEl: statusEl, T: TA,
    });
  }

  function wireMobileGate() {
    if (window.__mgate) return;
    var intro = document.getElementById('intro');
    if (!intro || document.getElementById('launch')) return; // mobile.html only
    window.__mgate = true;
    if (!authOn()) return; // no accounts configured -> mobile.html's own demo buttons handle it
    // .signin appears asynchronously (swapTo injects innerHTML after a 240ms fade),
    // so observe #intro instead of wrapping introShow/swapTo (which missed the delayed inject).
    var mo = new MutationObserver(function () { var s = intro.querySelector('.signin'); if (s) buildMobileGate(s); });
    mo.observe(intro, { childList: true, subtree: true });
    var s0 = intro.querySelector('.signin'); if (s0) buildMobileGate(s0);
    function enter() { if (window.introEnter && !document.body.classList.contains('entered')) window.introEnter(); }
    // Desktop already short-circuits for a returning guest; mobile did not, so a guest
    // replayed splash -> welcome -> sign-in on every single visit.
    if (guestOn()) { renderIdentity(); enter(); }
    DRAPE_AUTH.init().then(function () { var u = authUser(); if (u) { setGuest(false); applyPendingName(u); enter(); } }).catch(function () {});
    DRAPE_AUTH.onChange(function () { var u = authUser(); if (u) { setGuest(false); applyPendingName(u); enter(); } });
  }

  setTimeout(wireLive, 300);
  wireLaunchGate();
  wireMobileGate();
})();
