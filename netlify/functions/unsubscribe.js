// POST /api/unsubscribe
//
// Two paths:
//   1. Authenticated user opts themselves out via /account UI.
//      Body: { source?: 'yepgent.com' } — defaults to all sources.
//   2. Token-based one-click unsubscribe from email footer (RFC 8058).
//      Body: { token: '<hex>', email: '<address>' }
//      Token = hex(HMAC-SHA256(UNSUB_SECRET, email.lower())).
//
// Idempotent — already-unsubscribed returns 200.

import { admin, json, handlePreflight, bearer, verifyUser, clamp } from './_shared.js';
import { createHmac, timingSafeEqual } from 'node:crypto';

const UNSUB_SECRET = process.env.UNSUB_SECRET || '';

/** Verify a token from the email footer unsubscribe link. */
function verifyUnsubToken(email, token) {
  if (!UNSUB_SECRET) return false;
  const expected = createHmac('sha256', UNSUB_SECRET)
    .update(email.toLowerCase())
    .digest('hex');
  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(token.toLowerCase(), 'hex')
    );
  } catch {
    return false; // wrong length / non-hex input
  }
}

export default async (req, _context) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });

  let body = {};
  try { body = await req.json(); } catch { /* tolerate empty body */ }

  // Path 2: token-based (email footer link → landing page → this endpoint).
  if (body.token && body.email) {
    const email = clamp((body.email || '').trim().toLowerCase(), 320);
    const token = clamp((body.token || '').trim(), 128);
    if (!email || !token) return json({ error: 'invalid_params' }, { status: 400 });
    if (!verifyUnsubToken(email, token)) return json({ error: 'invalid_token' }, { status: 401 });

    const { data, error } = await admin
      .from('email_subscribers')
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('email_lower', email)
      .eq('status', 'subscribed')
      .select('id');

    if (error) {
      console.error('[unsubscribe] token path failed:', error);
      return json({ error: 'storage_error' }, { status: 500 });
    }
    return json({ ok: true, removed: data?.length || 0 });
  }

  // Path 1: authenticated user.
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
