(function(){
  'use strict';
  /* Text is English-only here on purpose: the site's i18n.js translates every
     inserted text node against its whole-string dictionary (MutationObserver),
     driven by the SAME drape_lang switch as the rest of the page. A second,
     module-private language check drifted from that switch — see i18n.js for the
     five dictionary entries this card relies on.
     No fetch, no iframe, no port probe: public HTTPS pages cannot silently reach
     127.0.0.1 (Chromium Local Network Access), so every action is a user click. */
  function mount(root){
    if(!root)return;
    root.innerHTML='<div class="helper-card"><div class="helper-state">Windows connector</div><div class="helper-actions"><a class="load helper-open" href="http://127.0.0.1:8734/?v=helper-2" target="_blank" rel="noopener noreferrer" style="text-decoration:none">Open garment comparison &rarr;</a><a class="helper-start" href="drapehelper://open">Not opening? Start Helper</a><a class="helper-download" href="downloads/DRAPE-Helper-Windows.zip" download>Download installer</a></div><div class="note" style="margin-top:8px">Install once. The main button opens the browser comparison page. If it cannot be reached, use Start Helper.</div></div>';
  }
  window.DrapeHelperConnector={mount};
})();
