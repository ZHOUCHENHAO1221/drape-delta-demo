/* DRAPE — client error reporting.
   Every failure in this app used to be silent: a bad email showed "link sent", a failed
   upload showed one line of grey text, and a broken runtime dependency showed nothing at
   all. With real contributors arriving, the dangerous state is not "it broke" — it is
   "it broke three weeks ago and nobody knew".

   Deliberately small and self-hosted: no third-party SDK, no account, no cookies, no
   personal data. It posts to this site's own function, which writes to the Netlify
   function log. Same-origin, so it needs nothing added to the CSP. */
(function () {
  var ENDPOINT = '/.netlify/functions/clientlog';
  var MAX = 5;          // per page load — an error loop must not become a POST loop
  var sent = 0;
  var seen = {};
  var busy = false;

  function report(kind, msg, extra) {
    try {
      if (sent >= MAX || busy) return;
      msg = String(msg || '').slice(0, 400);
      if (!msg || seen[msg]) return;          // dedupe: one report per distinct message
      seen[msg] = 1; sent++;
      busy = true;
      var body = JSON.stringify({
        kind: kind, msg: msg, at: new Date().toISOString(),
        page: location.pathname + location.hash.slice(0, 80),
        ua: (navigator.userAgent || '').slice(0, 160),
        vw: window.innerWidth, vh: window.innerHeight,
        extra: extra ? String(extra).slice(0, 300) : undefined
      });
      // keepalive so a report survives the navigation that may have caused it
      fetch(ENDPOINT, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: body, keepalive: true
      }).catch(function () {}).then(function () { busy = false; }, function () { busy = false; });
    } catch (e) { busy = false; }
  }

  window.addEventListener('error', function (e) {
    if (!e) return;
    var where = e.filename ? (e.filename.split('/').pop() + ':' + e.lineno) : '';
    report('error', (e.message || 'script error'), where);
  });

  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    report('rejection', (r && (r.message || r)) || 'unhandled rejection');
  });

  // Explicit hook so the app can record a failed user action, not just a thrown error.
  window.DRAPE_REPORT = function (what, detail) { report('action', what, detail); };
})();
