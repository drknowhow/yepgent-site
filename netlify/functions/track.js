// POST /api/track
//
// Privacy-first page-view beacon. Receives one row per pageview from
// the static client (js/track.js) using navigator.sendBeacon when
// available, plain fetch otherwise.
//
// Body: { path, session_id?, referrer?, duration_ms?, metadata? }
//
// What we DO record: path, referrer (query-stripped), opaque session_id,
// duration, country (edge), UA family/class.
// What we DON'T record: IP address, fingerprints, full user agent
// strings beyond family extraction, lat/long, anything that survives
// across sessions besides what the client itself chose to persist.
//
// Auth: optional. If a Bearer JWT is present, the row is linked via
// user_id so we can show "your activity" on /account. Anonymous
// otherwise.

import {
  admin, json, handlePreflight, bearer, verifyUser, clamp,
  classifyUA, uaFamily, cleanReferrer, countryFromHeaders
} from './_shared.js';

export default async (req, _context) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });

  let body;
  try {
    // sendBeacon sets content-type to text/plain by default — be tolerant.
    const txt = await req.text();
    body = txt ? JSON.parse(txt) : {};
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 });
  }

  const path = clamp((body?.path || '').toString(), 1024);
  if (!path || !path.startsWith('/')) {
    return json({ error: 'invalid_path' }, { status: 400 });
  }
  const session_id = clamp((body?.session_id || '').toString() || null, 64);
  const referrer = cleanReferrer(body?.referrer);
  const duration_ms = (() => {
    const n = Number(body?.duration_ms);
    return Number.isFinite(n) && n >= 0 && n < 60 * 60 * 1000 ? Math.floor(n) : null;
  })();

  const ua = req.headers.get('user-agent') || '';
  const agentIdentity = req.headers.get('x-agent-identity') || null;

  let user = null;
  const tok = bearer(req);
  if (tok) user = await verifyUser(tok);

  const metadata = body?.metadata && typeof body.metadata === 'object'
    ? sanitizeMetadata(body.metadata)
    : {};
  if (agentIdentity) metadata.agent_identity = clamp(agentIdentity, 256);

  const row = {
    path,
    session_id,
    user_id: user?.user_id || null,
    referrer,
    ua_class: classifyUA(ua, agentIdentity),
    ua_family: uaFamily(ua),
    country: countryFromHeaders(req),
    duration_ms,
    metadata
  };

  const { error: insertErr } = await admin.from('page_views').insert(row);
  if (insertErr) {
    // Tracking failure is never fatal for the page; log + 200 so the
    // beacon doesn't generate console errors in the user's browser.
    console.error('[track] insert failed:', insertErr);
    return json({ ok: false, soft: true });
  }

  // 204 minimizes response bytes for sendBeacon.
  return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*' } });
};

/** Whitelist client-supplied metadata to known-safe keys, clamp values. */
function sanitizeMetadata(obj) {
  const allowed = new Set([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'agent_kind', 'viewport_class', 'page_kind', 'event'
  ]);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!allowed.has(k)) continue;
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    out[k] = typeof v === 'string' ? v.slice(0, 256) : v;
  }
  return out;
}

export const config = { path: '/api/track' };
