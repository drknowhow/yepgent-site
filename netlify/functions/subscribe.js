// POST /api/subscribe
//
// Hybrid signup endpoint. Works for:
//   - anonymous humans typing their email into the form on the homepage
//   - authenticated users (linked to their account)
//   - agents posting from a script (with or without auth)
//
// Body: { "email": "you@example.com", "source"?: "yepgent.com" }
//
// Auth: optional. If a Bearer JWT is present and valid, the resulting
// row is linked via user_id. Otherwise the signup is anonymous.
//
// Idempotent: all success paths return { ok: true } without leaking
// whether the email was already in the list (prevents enumeration).

import { admin, json, handlePreflight, bearer, verifyUser, clamp, classifyUA, clientIP, checkRateLimit } from './_shared.js';

export default async (req, _context) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });

  // Rate limit: 5 requests / 60s per IP (best-effort, in-memory).
  const ip = clientIP(req);
  if (checkRateLimit(`subscribe:${ip}`)) {
    return json({ error: 'rate_limited' }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 });
  }

  // Honeypot: real users can't see the bot_field input; bots that
  // auto-fill every input populate it. Reply with a 200 success
  // shape so the bot doesn't retry or learn — but never write a row.
  const botField = (body?.bot_field || '').trim();
  if (botField) {
    console.warn('[subscribe] honeypot tripped, dropping submission');
    return json({ ok: true });
  }

  const email = clamp((body?.email || '').trim(), 320);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'invalid_email' }, { status: 400 });
  }
  const source = clamp((body?.source || 'yepgent.com').trim(), 64);
  const name = clamp((body?.name || '').trim() || null, 200);

  // Optional auth — link to account if present.
  let user = null;
  const tok = bearer(req);
  if (tok) user = await verifyUser(tok);

  const ua = req.headers.get('user-agent') || '';
  const agentIdentity = req.headers.get('x-agent-identity') || null;
  const ua_class = classifyUA(ua, agentIdentity);

  const metadata = {
    user_agent: clamp(ua, 512),
    ua_class,
    submitted_via: 'api',
    ...(agentIdentity ? { agent_identity: clamp(agentIdentity, 256) } : {})
  };

  // Look up existing row by email_lower (case-insensitive) — covers both
  // active and unsubscribed states. We pick the most recent by
  // updated_at to avoid surprises if multiple historical rows exist.
  const { data: existing, error: lookupErr } = await admin
    .from('email_subscribers')
    .select('id, status, user_id, source')
    .eq('email_lower', email.toLowerCase())
    .order('updated_at', { ascending: false })
    .limit(1);

  if (lookupErr) {
    console.error('[subscribe] lookup failed:', lookupErr);
    return json({ error: 'storage_error' }, { status: 500 });
  }

  // Existing row branch.
  if (existing && existing.length) {
    const row = existing[0];
    if (row.status === 'subscribed') {
      // Optionally backfill user_id if we now know it.
      if (user && !row.user_id) {
        await admin.from('email_subscribers')
          .update({ user_id: user.user_id })
          .eq('id', row.id);
      }
      // Return plain ok — don't leak that this email is already in the list.
      return json({ ok: true });
    }
    // Revive an unsubscribed/bounced row.
    const patch = {
      status: 'subscribed',
      unsubscribed_at: null,
      subscribed_at: new Date().toISOString(),
      source,
      metadata,
      ...(user ? { user_id: user.user_id } : {})
    };
    const { error: reviveErr } = await admin
      .from('email_subscribers')
      .update(patch)
      .eq('id', row.id);
    if (reviveErr) {
      console.error('[subscribe] revive failed:', reviveErr);
      return json({ error: 'storage_error' }, { status: 500 });
    }
    return json({ ok: true });
  }

  // Brand-new row.
  const insert = {
    email,
    source,
    name,
    status: 'subscribed',
    metadata,
    ...(user ? { user_id: user.user_id } : {})
  };
  const { error: insertErr } = await admin
    .from('email_subscribers')
    .insert(insert);
  if (insertErr) {
    // Race: someone else inserted the same email between lookup and insert.
    if (insertErr.code === '23505') {
      return json({ ok: true });
    }
    console.error('[subscribe] insert failed:', insertErr);
    return json({ error: 'storage_error' }, { status: 500 });
  }

  return json({ ok: true });
};

export const config = { path: '/api/subscribe' };
