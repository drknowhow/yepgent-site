// yepgent.com — page-view beacon.
// ~1 KB, no dependencies, no cookies.
//
// What gets sent: { path, session_id, referrer, duration_ms }
// What is NOT sent: any cookies, any IP correlation, any fingerprint
// beyond what the User-Agent header naturally carries.
//
// Honors the Do-Not-Track header (DNT=1) and any future
// `localStorage.yep_track_optout = '1'` flag.

(function () {
  try {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('yep_track_optout') === '1') return;

    var SESSION_KEY = 'yep_sid';
    var ENDPOINT = '/api/track';

    function sid() {
      try {
        var s = localStorage.getItem(SESSION_KEY);
        if (!s) {
          s = (crypto.randomUUID && crypto.randomUUID()) ||
              (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
          localStorage.setItem(SESSION_KEY, s);
        }
        return s;
      } catch (_e) {
        return null;
      }
    }

    var startedAt = performance.now ? performance.now() : Date.now();
    var sentInitial = false;

    function payload(extra) {
      return JSON.stringify(Object.assign({
        path: location.pathname + (location.search || ''),
        session_id: sid(),
        referrer: document.referrer || null,
        duration_ms: Math.max(0, Math.round((performance.now ? performance.now() : Date.now()) - startedAt))
      }, extra || {}));
    }

    function send(extra) {
      var body = payload(extra);
      try {
        if (navigator.sendBeacon) {
          var blob = new Blob([body], { type: 'application/json' });
          if (navigator.sendBeacon(ENDPOINT, blob)) return;
        }
      } catch (_e) { /* fall through */ }
      try {
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: body,
          keepalive: true
        }).catch(function () {});
      } catch (_e) { /* swallow */ }
    }

    // Initial pageview — fire when the page is at least minimally
    // interactive, so durations make sense.
    function fireInitial() {
      if (sentInitial) return;
      sentInitial = true;
      send({ metadata: { event: 'pageview' } });
    }

    if (document.readyState === 'complete') fireInitial();
    else window.addEventListener('load', fireInitial, { once: true });

    // Final beacon on visibility change / unload — captures duration.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') send({ metadata: { event: 'leave' } });
    });
    window.addEventListener('pagehide', function () { send({ metadata: { event: 'leave' } }); }, { once: true });
  } catch (_e) {
    // Tracking failure must never break the page.
  }
})();
