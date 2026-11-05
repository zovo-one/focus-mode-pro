/* whats-new.js, Focus Mode Pro. External file because the extension CSP blocks
   inline scripts. Handles the dismiss and upgrade-intent signals only. The
   one-shot open flag is set by the background service worker, not here. */
(function () {
  'use strict';

  var hasStore = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  function record(obj) {
    if (!hasStore) { return; }
    try { chrome.storage.local.set(obj); } catch (e) { /* best effort */ }
  }

  var later = document.getElementById('laterBtn');
  if (later) {
    later.addEventListener('click', function (e) {
      e.preventDefault();
      record({ upgradeDeclinedAt: Date.now() });
      try { window.close(); } catch (e2) { /* tab may not be closable */ }
    });
  }

  var pro = document.getElementById('getProBtn');
  if (pro) {
    pro.addEventListener('click', function () {
      record({ upgradeIntentAt: Date.now(), upgradeSource: 'whatsnew_pro' });
    });
  }

  var lifetime = document.getElementById('lifetimeBtn');
  if (lifetime) {
    lifetime.addEventListener('click', function () {
      record({ upgradeIntentAt: Date.now(), upgradeSource: 'whatsnew_lifetime' });
    });
  }
})();
