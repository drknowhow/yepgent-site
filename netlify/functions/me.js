// /api/me
//
// GET    — return account snapshot { account, subscriptions[], stats{} }
// PATCH  — update mutable account fields
// All variants require a valid Supabase Bearer JWT.

import { admin, json, handlePreflight, bearer, verifyUser, clamp } from './_shared.js';

const MUTABLE_FIELDS = ['display_name', 'bio', 'location', 'website_url', 'social_links', 'avatar_url', 'is_agent', 'agent_kind', 'agent_purpose', 'operator_email', 'preferences'];

export default async (req, _context) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  const tok = bearer(req);
  if (!tok) return json({ error: 'unauthenticated' }, { status: 401 });
  const user = await verifyUser(tok);
  if (!user) return json({ error: 'invalid_token' }, { status: 401 });
  if (req.method === 'GET')   return handleGet(user);
  if (req.method === 'PATCH') return handlePatch(user, req);
  return json({ error: 'method_not_allowed' }, { status: 405 });
};

async function handleGet(user) {
  let { data: account, error } = await admin
    .from('accounts')
    .select('*')
    .eq('user_id', user.user_id)
    .maybeSingle();

  if (error) {
    console.error('[me:get] account fetch failed:', error);
    return json({ error: 'storage_error' }, { status: 500 });
  }

  if (!account) {
    const insert = { user_id: user.user_id, email: user.email, signup_source: 'yepgent.com' };
    const { data: created, error: insertErr } = await admin
      .from('accounts').insert(insert).select('*').single();
    if (insertErr) {
      console.error('[me:get] account create failed:', insertErr);
      return json({ error: 'storage_error' }, { status: 500 });
    }
    account = created;
    if (user.email) {
      await admin.from('email_subscribers')
        .update({ user_id: user.user_id })
        .eq('email_lower', user.email.toLowerCase())
        .is('user_id', null);
    }
  }

  // Touch last_seen_at — best effort, don't block the response.
  admin.from('accounts')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('user_id', user.user_id)
    .then(() => {});

  // Subscription snapshot.
  const { data: subs } = await admin
    .from('email_subscribers')
    .select('id, source, status, subscribed_at, unsubscribed_at')
    .eq('user_id', user.user_id);

  // Stats: posts read (page_views on /blog/ paths) + comment count.
  const [pvResult, cmtResult] = await Promise.all([
    admin.from('page_views')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.user_id)
      .like('path', '/blog/%')
      .not('path', 'eq', '/blog/'),
    admin.from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.user_id)
      .eq('is_deleted', false)
  ]);

  // Recent reading history (last 10 distinct posts).
  const { data: recentViews } = await admin
    .from('page_views')
    .select('path, viewed_at')
    .eq('user_id', user.user_id)
    .like('path', '/blog/2%')
    .order('viewed_at', { ascending: false })
    .limit(20);

  // Deduplicate by path, keep most recent.
  const seen = new Set();
  const history = [];
  for (const v of (recentViews || [])) {
    if (!seen.has(v.path)) { seen.add(v.path); history.push(v); }
    if (history.length >= 10) break;
  }

  // Recent comments by this user.
  const { data: recentComments } = await admin
    .from('comments')
    .select('id, post_slug, content, created_at')
    .eq('user_id', user.user_id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(5);

  return json({
    account: redact(account),
    subscriptions: subs || [],
    api_keys: [],
    stats: {
      posts_read: pvResult.count || 0,
      comments_written: cmtResult.count || 0,
      member_since: account.created_at
    },
    history,
    recent_comments: recentComments || []
  });
}

async function handlePatch(user, req) {
  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'invalid_json' }, { status: 400 }); }

  const patch = {};
  for (const k of MUTABLE_FIELDS) {
    if (!(k in body)) continue;
    let v = body[k];
    if (k === 'is_agent') {
      v = !!v;
    } else if (k === 'preferences') {
      if (typeof v !== 'object' || v === null) continue;
    } else if (k === 'social_links') {
      if (typeof v !== 'object' || v === null || Array.isArray(v)) continue;
      const allowed = {};
      for (const sk of ['twitter','github','linkedin','mastodon','bluesky','other']) {
        if (typeof v[sk] === 'string') allowed[sk] = clamp(v[sk], 200) || null;
      }
      v = allowed;
    } else if (k === 'website_url') {
      v = clamp((v ?? '').toString(), 2000) || null;
    } else if (k === 'avatar_url') {
      // Must point at our own Supabase Storage public-objects path so
      // we can't be turned into a redirector to arbitrary URLs.
      const s = clamp((v ?? '').toString(), 2000) || null;
      if (s !== null) {
        const supaUrl = process.env.SUPABASE_URL || '';
        const expectedPrefix = `${supaUrl.replace(/\/+$/,'')}/storage/v1/object/public/avatars/`;
        if (!supaUrl || !s.startsWith(expectedPrefix)) {
          return json({ error: 'invalid_avatar_url' }, { status: 400 });
        }
      }
      v = s;
    } else {
      v = clamp((v ?? '').toString(), 1000) || null;
    }
    patch[k] = v;
  }
  if (Object.keys(patch).length === 0) return json({ error: 'no_fields' }, { status: 400 });

  const { data: updated, error } = await admin
    .from('accounts').update(patch).eq('user_id', user.user_id).select('*').single();
  if (error) {
    console.error('[me:patch] update failed:', error);
    return json({ error: 'storage_error' }, { status: 500 });
  }
  return json({ account: redact(updated) });
}

function redact(account) {
  if (!account) return account;
  const { metadata: _m, ...rest } = account;
  return rest;
}

export const config = { path: '/api/me' };
