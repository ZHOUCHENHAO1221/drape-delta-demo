/* DRAPE DELTA — live layer.
   Turns the "Already measured elsewhere?" dropzone into a REAL uploader backed by
   Netlify Functions + Blobs, and lists the persisted assets with working downloads.
   Integrity unchanged: it uploads an already-measured file (.zfab / lab report) and
   stores it — it does NOT derive properties from anything. No delta is invented for
   uploads; the delta is the offline comparison step described in the 5-step flow. */
(function () {
  var API = '/.netlify/functions';

  function fmtSize(n) {
    if (n == null) return '';
    return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
  }
  function pass() { return sessionStorage.getItem('drape_pass') || ''; }

  async function listAssets() {
    try { var r = await fetch(API + '/list'); if (!r.ok) return []; return (await r.json()).assets || []; }
    catch (e) { return []; }
  }

  async function renderList(box) {
    var assets = await listAssets();
    if (!assets.length) {
      box.innerHTML = '<div class="uz-s" style="margin-top:10px">No measured assets uploaded to this deployment yet.</div>';
      return;
    }
    var rows = assets.map(function (a) {
      return '<div class="prow"><span>' + esc(a.name) + ' <span style="opacity:.6">· ' + fmtSize(a.size) + '</span></span>' +
        '<b><a href="' + API + '/download?key=' + encodeURIComponent(a.key) + '" style="color:var(--green);text-decoration:none">download &darr;</a></b></div>';
    }).join('');
    box.innerHTML =
      '<div class="sect" style="margin-top:14px">Uploaded candidates &middot; pending review &middot; live &middot; ' + assets.length + '</div>' +
      '<div class="prov">' + rows + '</div>' +
      '<div class="uz-s" style="margin-top:7px">Really uploaded &amp; stored on this deployment (survives reload) &mdash; as candidates, not registered measured assets. No delta is shown; provenance review, a named baseline and a garment comparison are the offline steps in the flow above.</div>';
  }
  function esc(s) { return String(s).replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]; }); }

  async function doUpload(file, statusEl, listBox) {
    if (file.size > 25 * 1048576) { statusEl.textContent = 'File too large — max 25 MB in this demo.'; return; }
    statusEl.textContent = 'Uploading ' + file.name + ' …';
    var fd = new FormData(); fd.append('file', file);
    var headers = {}; if (pass()) headers['x-drape-pass'] = pass();
    try {
      var r = await fetch(API + '/upload', { method: 'POST', body: fd, headers: headers });
      if (r.status === 401) {
        var p = window.prompt('This deployment is passphrase-protected. Enter passphrase:');
        if (p) { sessionStorage.setItem('drape_pass', p); return doUpload(file, statusEl, listBox); }
        statusEl.textContent = 'Upload cancelled.'; return;
      }
      if (!r.ok) { var e = await r.json().catch(function () { return {}; }); statusEl.textContent = 'Upload failed: ' + (e.error || r.status); return; }
      var j = await r.json();
      statusEl.textContent = '✓ received & stored as a candidate: ' + j.name + ' (' + fmtSize(j.size) + ') — real upload, reload-safe. A named baseline + garment comparison are still required before any delta.';
      renderList(listBox);
    } catch (err) { statusEl.textContent = 'Upload error: ' + err.message; }
  }

  function wireLive() {
    var uz = document.querySelector('.uploadz');
    if (!uz || uz._live) return;
    uz._live = true;

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

    // On the live deployment, relabel the "not available in v1" badge (this file-intake
    // path really works here) and the copy so it reads as a candidate-intake demo, not
    // "registers a measured asset".
    var badge = uz.previousElementSibling;
    if (badge && badge.classList.contains('futbadge')) badge.textContent = 'Live file-intake demo · candidates pending review';
    var sub = uz.querySelector('.uz-s');
    if (sub) sub.innerHTML = 'This live demo really uploads the file and stores it as a <b>candidate</b>. It is not registered as a measured asset and produces no delta &mdash; provenance review, a named baseline and a garment comparison are still required.';
    var pill = uz.querySelector('.uz-c'); if (pill) pill.textContent = 'choose a file · live';
    renderList(listBox);
  }

  // Re-apply after the Request screen (re)renders — panel uses reqPanel(), mobile uses request().
  ['reqPanel', 'request'].forEach(function (fn) {
    if (typeof window[fn] === 'function') {
      var orig = window[fn];
      window[fn] = function () { var out = orig.apply(this, arguments); setTimeout(wireLive, 0); return out; };
    }
  });
  // In case a request screen is already on-screen at load.
  setTimeout(wireLive, 300);
})();
