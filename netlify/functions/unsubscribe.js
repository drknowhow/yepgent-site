// POST /api/unsubscribe
//
// Two paths:
//   1. Authenticated user opts themselves out via /account UI.
//      Body: { source?: 'yepgent.com' } — defaults to all sources.
//   2. Phase 3: token-based one-click unsubscribe from email footer.
//      Body: { token: '...' } — verified against a signed value;
//      not implemented in Phase 1.
//
// Idempotent — already-unsubscribed returns 200.

import { admin, json, handlePreflight, bearer, verifyUser, clamp } from './_shared.js';

export default async (req, _context) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });

  let body = {};
  try { body = await req.json(); } catch { /* tolerate empty body */ }

  // Phase 1: only authenticated path.
  const tok = bearer(req);
  if (!tok) return json({ error: 'unauthenticated' }, { status: 401 });
  const user = await verifyUser(tok);
  if (!user) return json({ error: 'invalid_token' }, { status: 401 });

  const source = clamp((body?.source || '').trim() || null, 64);

  let q = admin.from('email_subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('user_id', user.user_id)
    .eq('status', 'subscribed');
  if (source) q = q.eq('source', source);

  const { data, error } = await q.select('id');
  if (error) {
    console.error('[unsubscribe] failed:', error);
    return json({ error: 'storage_error' }, { status: 500 });
  }
  return json({ ok: true, removed: data?.length || 0 });
};

export const config = { path: '/api/unsubscribe' };
