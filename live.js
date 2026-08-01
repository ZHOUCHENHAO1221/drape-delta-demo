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
      var del = a.canDelete ? '<a href="#" data-del="' + esc(a.key) + '" data-name="' + esc(a.name) + '" style="color:#c0473a;text-decoration:none;margin-left:12px">delete &times;</a>' : '';
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
    if (authOn() && !authUser()) { statusEl.textContent = 'Please sign in to contribute a fabric (account menu, top of panel).'; return; }
    if (file.size > 25 * 1048576) { statusEl.textContent = 'File too large — max 25 MB in this demo.'; return; }
    statusEl.textContent = 'Uploading ' + file.name + ' …';
    var fd = new FormData(); fd.append('file', file);
    try {
      var r = await fetch(API + '/upload', { method: 'POST', body: fd, headers: authHeaders() });
      if (r.status === 401) {
        if (authOn()) { statusEl.textContent = 'Please sign in to contribute.'; return; }
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

  function injectAuthCss() {
    if (document.getElementById('drape-auth-css')) return;
    var s = document.createElement('style'); s.id = 'drape-auth-css';
    s.textContent = [
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
      '.idmenu{position:absolute;right:0;top:calc(100% + 6px);background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 20px 50px -16px rgba(13,16,20,.28);padding:6px;min-width:198px;z-index:80;display:none}',
      '.idmenu.open{display:block}',
      '.idmenu .em{font-family:var(--mono);font-size:10px;color:var(--ink2);padding:7px 9px 8px;border-bottom:1px solid var(--line);word-break:break-all;margin-bottom:4px}',
      '.idmenu button{display:block;width:100%;text-align:left;background:none;border:0;padding:8px 9px;border-radius:8px;font-family:var(--sans);font-size:12.5px;color:var(--ink);cursor:pointer}',
      '.idmenu button:hover{background:var(--panel)}',
      '.idmenu button.out{color:#c0473a}'
    ].join('');
    document.head.appendChild(s);
  }

  function idInitial(n) { n = (n || '').trim(); return n ? n.charAt(0).toUpperCase() : '?'; }

  function renderIdentity() {
    var head = document.querySelector('.phead'); if (!head) return; // panel only
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
    if (so) so.onclick = function () { setGuest(false); if (window.DRAPE_AUTH) DRAPE_AUTH.signOut().then(function () { location.reload(); }); else location.reload(); };
    var sn = chip.querySelector('[data-setname]');
    if (sn) sn.onclick = function () { var v = window.prompt('Display name:', (authUser() && authUser().name) || ''); if (v && v.trim()) DRAPE_AUTH.setName(v.trim()).then(renderIdentity); };
    var si = chip.querySelector('[data-signin]');
    if (si) si.onclick = function () { setGuest(false); reopenGate(); };
  }

  if (!window.__drapeIdClose) { window.__drapeIdClose = true; document.addEventListener('click', function () { var m = document.querySelector('.idmenu.open'); if (m) m.classList.remove('open'); }); }

  function buildGateControls(launch) {
    injectAuthCss();
    var card = launch.querySelector('.lcard'); if (!card) return;
    var lbtn = card.querySelector('.lbtn'); if (lbtn) lbtn.style.display = 'none';
    var old = card.querySelector('.agate'); if (old) old.remove();
    var g = document.createElement('div'); g.className = 'agate';
    g.innerHTML =
      '<input class="an" data-gname type="text" placeholder="Your name (optional)">' +
      '<button class="abtn g" data-ggoogle>' + GICON + 'Continue with Google</button>' +
      '<button class="abtn guest" data-gguest>Explore as guest &rarr;</button>' +
      '<a href="#" data-gemailtoggle class="aor" style="cursor:pointer;text-decoration:none">or sign in with email</a>' +
      '<div class="arow" data-gemailrow style="display:none"><input class="an" data-gemail type="email" placeholder="you@email.com"><button class="abtn mail" data-gmail>Email a code</button></div>' +
      '<div class="arow" data-gcoderow style="display:none"><input class="an" data-gcode type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="6-digit code"><button class="abtn mail" data-gverify>Verify</button></div>' +
      '<div class="ahint">Google is the fastest sign-in. Guests can browse the whole library; contributing a fabric needs an account.</div>';
    var foot = card.querySelector('.lfoot');
    if (foot) card.insertBefore(g, foot); else card.appendChild(g);
    var nm = g.querySelector('[data-gname]');
    var sentEmail = '';
    var etgl = g.querySelector('[data-gemailtoggle]'), erow = g.querySelector('[data-gemailrow]');
    if (etgl) etgl.onclick = function (e) { e.preventDefault(); var show = erow.style.display === 'none'; erow.style.display = show ? 'flex' : 'none'; if (show) { var ei = erow.querySelector('[data-gemail]'); if (ei) ei.focus(); } };
    g.querySelector('[data-ggoogle]').onclick = function () {
      var n = (nm.value || '').trim(); if (n) try { localStorage.setItem('drape_pending_name', n); } catch (e) {}
      DRAPE_AUTH.signInGoogle().catch(function () { alert('Google sign-in is not configured in Supabase yet.'); });
    };
    g.querySelector('[data-gmail]').onclick = function () {
      var em = g.querySelector('[data-gemail]'), v = (em.value || '').trim(); if (!v) { em.focus(); return; }
      var n = (nm.value || '').trim(); if (n) try { localStorage.setItem('drape_pending_name', n); } catch (e) {}
      sentEmail = v;
      var b = this; b.textContent = 'sending…';
      DRAPE_AUTH.signInEmail(v).then(function () {
        b.textContent = 'code sent ✓';
        var cr = g.querySelector('[data-gcoderow]'); if (cr) { cr.style.display = 'flex'; var ci = cr.querySelector('[data-gcode]'); if (ci) ci.focus(); }
        var h = g.querySelector('.ahint'); if (h) h.textContent = 'We emailed a 6-digit code to ' + v + '. Type it here — works even if you read the email on your phone.';
      }).catch(function () { b.textContent = 'retry'; });
    };
    g.querySelector('[data-gverify]').onclick = function () {
      var ci = g.querySelector('[data-gcode]'), code = (ci.value || '').replace(/\s+/g, ''); if (!code) { ci.focus(); return; }
      var b = this; b.textContent = 'verifying…';
      DRAPE_AUTH.verifyEmailCode(sentEmail, code).then(function () {
        b.textContent = 'signed in ✓';
        if (window.enterWS) window.enterWS();
      }).catch(function () { b.textContent = 'wrong code — retry'; });
    };
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
  setTimeout(wireLive, 300);
  wireLaunchGate();
})();
