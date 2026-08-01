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

  async function listAssets() {
    try { var r = await fetch(API + '/list', { headers: authHeaders() }); if (!r.ok) return []; return (await r.json()).assets || []; }
    catch (e) { return []; }
  }

  async function renderList(box) {
    var assets = await listAssets();
    if (!assets.length) {
      box.innerHTML = '<div class="uz-s" style="margin-top:10px">No measured assets uploaded to this deployment yet.</div>';
      return;
    }
    var rows = assets.map(function (a) {
      var owner = a.ownerEmail ? '<span style="opacity:.55"> · ' + esc(a.ownerEmail) + '</span>' : '';
      var del = a.mine ? '<a href="#" data-del="' + esc(a.key) + '" data-name="' + esc(a.name) + '" style="color:#c0473a;text-decoration:none;margin-left:12px">delete &times;</a>' : '';
      return '<div class="prow"><span>' + esc(a.name) + ' <span style="opacity:.6">· ' + fmtSize(a.size) + '</span>' + owner + '</span>' +
        '<b><a href="' + API + '/download?key=' + encodeURIComponent(a.key) + '" style="color:var(--green);text-decoration:none">download &darr;</a>' + del + '</b></div>';
    }).join('');
    box.innerHTML =
      '<div class="sect" style="margin-top:14px">Uploaded candidates &middot; pending review &middot; live &middot; ' + assets.length + '</div>' +
      '<div class="prov">' + rows + '</div>' +
      '<div class="uz-s" style="margin-top:7px">Really uploaded &amp; stored on this deployment (survives reload) &mdash; as candidates, not registered measured assets. No delta is shown; provenance review, a named baseline and a garment comparison are the offline steps in the flow above.</div>';
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
      if (!r.ok) { alert('Delete failed (' + r.status + ').'); return; }
      renderList(box);
    } catch (e) { alert('Delete error: ' + e.message); }
  }

  async function doUpload(file, statusEl, listBox) {
    if (authOn() && !authUser()) { statusEl.textContent = 'Please sign in above to contribute a fabric.'; return; }
    if (file.size > 25 * 1048576) { statusEl.textContent = 'File too large — max 25 MB in this demo.'; return; }
    statusEl.textContent = 'Uploading ' + file.name + ' …';
    var fd = new FormData(); fd.append('file', file);
    try {
      var r = await fetch(API + '/upload', { method: 'POST', body: fd, headers: authHeaders() });
      if (r.status === 401) {
        if (authOn()) { statusEl.textContent = 'Please sign in above to contribute.'; return; }
        var p = window.prompt('This deployment is passphrase-protected. Enter passphrase:');
        if (p) { sessionStorage.setItem('drape_pass', p); return doUpload(file, statusEl, listBox); }
        statusEl.textContent = 'Upload cancelled.'; return;
      }
      if (!r.ok) { var e = await r.json().catch(function () { return {}; }); statusEl.textContent = 'Upload failed: ' + (e.error || r.status); return; }
      var j = await r.json();
      statusEl.textContent = '✓ received & stored as a candidate: ' + j.name + ' (' + fmtSize(j.size) + ')' + (j.owner ? ' · by ' + j.owner : '') + ' — real upload, reload-safe. A named baseline + garment comparison are still required before any delta.';
      renderList(listBox);
    } catch (err) { statusEl.textContent = 'Upload error: ' + err.message; }
  }

  // sign-in bar (email magic-link + Google). Hidden entirely when accounts aren't wired.
  function renderAuthBar(bar, listBox) {
    if (!authOn()) { bar.style.display = 'none'; return; }
    bar.style.display = '';
    var u = authUser();
    if (u) {
      bar.innerHTML = '<div class="uz-s" style="text-align:center">Signed in as <b>' + esc(u.email || 'you') + '</b> &middot; <a href="#" data-signout style="color:var(--green);text-decoration:none">sign out</a></div>';
      var so = bar.querySelector('[data-signout]');
      if (so) so.onclick = function (e) { e.preventDefault(); DRAPE_AUTH.signOut(); };
    } else {
      bar.innerHTML =
        '<div class="uz-s" style="text-align:center;margin-bottom:6px">Sign in to contribute a fabric to the library</div>' +
        '<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">' +
        '<input data-email type="email" placeholder="you@email.com" style="flex:1;min-width:150px;max-width:230px;border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-family:var(--sans);font-size:12px">' +
        '<button data-magic class="uz-c" style="border:1px solid var(--green);cursor:pointer;background:none">email me a link</button>' +
        '<button data-google class="uz-c" style="border:1px solid var(--line);color:var(--ink);cursor:pointer;background:none">Continue with Google</button>' +
        '</div>';
      var em = bar.querySelector('[data-email]'), mg = bar.querySelector('[data-magic]'), gg = bar.querySelector('[data-google]');
      if (mg) mg.onclick = async function () {
        var v = (em.value || '').trim(); if (!v) { em.focus(); return; }
        mg.textContent = 'sending…';
        try { await DRAPE_AUTH.signInEmail(v); mg.textContent = 'check your email ✓'; } catch (e) { mg.textContent = 'failed — retry'; }
      };
      if (gg) gg.onclick = function () { DRAPE_AUTH.signInGoogle().catch(function () { alert('Google sign-in is not configured in Supabase yet.'); }); };
    }
  }

  function wireLive() {
    var uz = document.querySelector('.uploadz');
    if (!uz || uz._live) return;
    uz._live = true;

    var authBar = document.createElement('div');
    authBar.style.margin = '2px 0 10px';

    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.zfab,.csv,.pdf,.txt,.json,.xlsx';
    inp.style.display = 'none';

    var status = document.createElement('div');
    status.className = 'uz-s';
    status.style.marginTop = '8px';
    status.style.textAlign = 'center';

    var listBox = document.createElement('div');

    uz.parentNode.insertBefore(authBar, uz);
    uz.parentNode.insertBefore(inp, uz.nextSibling);
    uz.parentNode.insertBefore(status, inp.nextSibling);
    uz.parentNode.insertBefore(listBox, status.nextSibling);

    uz.onclick = function () { inp.click(); };
    uz.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } };
    inp.onchange = function () { if (inp.files[0]) doUpload(inp.files[0], status, listBox); };

    // Per-candidate delete (delegated). Only removes uploaded candidates; seed fabrics are baked in.
    listBox.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-del]') : null;
      if (!t) return;
      e.preventDefault();
      var name = t.getAttribute('data-name') || 'this candidate';
      if (!window.confirm('Remove "' + name + '" from the library? This cannot be undone.')) return;
      delAsset(t.getAttribute('data-del'), listBox);
    });

    // Relabel the intake copy so it reads as a live candidate-intake, not "registers an asset".
    var badge = uz.previousElementSibling;
    if (badge && badge.classList.contains('futbadge')) badge.textContent = 'Live file-intake demo · candidates pending review';
    var sub = uz.querySelector('.uz-s');
    if (sub) sub.innerHTML = 'This live demo really uploads the file and stores it as a <b>candidate</b>. It is not registered as a measured asset and produces no delta &mdash; provenance review, a named baseline and a garment comparison are still required.';
    var pill = uz.querySelector('.uz-c'); if (pill) pill.textContent = 'choose a file · live';

    if (window.DRAPE_AUTH) {
      DRAPE_AUTH.init();
      DRAPE_AUTH.onChange(function () { renderAuthBar(authBar, listBox); renderList(listBox); });
    } else {
      authBar.style.display = 'none';
      renderList(listBox);
    }
  }

  // Re-apply after the Request screen (re)renders — panel uses reqPanel(), mobile uses request().
  ['reqPanel', 'request'].forEach(function (fn) {
    if (typeof window[fn] === 'function') {
      var orig = window[fn];
      window[fn] = function () { var out = orig.apply(this, arguments); setTimeout(wireLive, 0); return out; };
    }
  });
  setTimeout(wireLive, 300);
})();
