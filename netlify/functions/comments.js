// /api/comments
//
// GET  ?post_slug=<slug>        — public, list non-deleted comments for a post
// GET  ?user=me                 — auth required, list own comments across all posts
// POST (body: {post_slug, content, parent_id?}) — auth required, create comment
// DELETE ?id=<uuid>             — auth required, soft-delete own comment

import { admin, json, handlePreflight, bearer, verifyUser, clamp } from './_shared.js';

const RATE = new Map();
function rateLimit(key, max = 10, windowMs = 60_000) {
  const now = Date.now();
  const entry = RATE.get(key) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + windowMs; }
  entry.count++;
  RATE.set(key, entry);
  return entry.count > max;
}

export default async (req, context) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const url = new URL(req.url);

  if (req.method === 'GET')    return handleGet(url, req);
  if (req.method === 'POST')   return handlePost(req, context);
  if (req.method === 'DELETE') return handleDelete(req, url);

  return json({ error: 'method_not_allowed' }, { status: 405 });
};

async function handleGet(url, req) {
  const slug = url.searchParams.get('post_slug');
  const userMe = url.searchParams.get('user') === 'me';

  if (userMe) {
    // Auth required
    const tok = bearer(req);
    if (!tok) return json({ error: 'unauthenticated' }, { status: 401 });
    const user = await verifyUser(tok);
    if (!user) return json({ error: 'invalid_token' }, { status: 401 });

    const { data, error } = await admin
      .from('comments')
      .select('id, post_slug, author_display, content, parent_id, created_at')
      .eq('user_id', user.user_id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[comments:get:me]', error);
      return json({ error: 'storage_error' }, { status: 500 });
    }
    return json({ comments: data || [] });
  }

  if (!slug) return json({ error: 'missing post_slug' }, { status: 400 });

  const { data, error } = await admin
    .from('comments')
    .select('id, post_slug, user_id, author_display, content, parent_id, created_at')
    .eq('post_slug', slug)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[comments:get]', error);
    return json({ error: 'storage_error' }, { status: 500 });
  }

  // Enrich with current avatar_url + display_name from accounts.
  // Single batch lookup; PostgREST `.in()` on the unique user_id list.
  const rows = data || [];
  const uniqueIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
  let avatarById = {};
  let displayById = {};
  if (uniqueIds.length) {
    const { data: accs, error: accErr } = await admin
      .from('accounts')
      .select('user_id, avatar_url, display_name')
      .in('user_id', uniqueIds);
    if (accErr) {
      console.warn('[comments:get] accounts enrich warn:', accErr);
    } else {
      for (const a of (accs || [])) {
        if (a.avatar_url)   avatarById[a.user_id]  = a.avatar_url;
        if (a.display_name) displayById[a.user_id] = a.display_name;
      }
    }
  }
  const enriched = rows.map(r => ({
    ...r,
    avatar_url: avatarById[r.user_id] || null,
    // Prefer the live display_name when set; fall back to the snapshot
    // captured at insert time. Lets users update their handle and have
    // it reflect on past comments.
    author_display: displayById[r.user_id] || r.author_display,
  }));
  return json({ comments: enriched });
}

async function handlePost(req, _context) {
  const ip = req.headers.get('x-nf-client-connection-ip') || 'anon';
  if (rateLimit(`post:${ip}`, 10, 60_000)) {
    return json({ error: 'rate_limited' }, { status: 429 });
  }

  const tok = bearer(req);
  if (!tok) return json({ error: 'unauthenticated' }, { status: 401 });
  const user = await verifyUser(tok);
  if (!user) return json({ error: 'invalid_token' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, { status: 400 }); }

  const { post_slug, content, parent_id } = body;
  if (!post_slug || typeof post_slug !== 'string') return json({ error: 'missing post_slug' }, { status: 400 });
  const trimmed = (content || '').trim();
  if (!trimmed) return json({ error: 'missing content' }, { status: 400 });

  // Fetch display name
  const { data: account } = await admin
    .from('accounts')
    .select('display_name, email')
    .eq('user_id', user.user_id)
    .maybeSingle();

  const author_display = account?.display_name || (account?.email || '').split('@')[0] || 'anon';

  const insert = {
    post_slug: clamp(post_slug, 300),
    user_id: user.user_id,
    author_display: clamp(author_display, 80),
    content: clamp(trimmed, 5000),
    parent_id: parent_id || null,
  };

  const { data: comment, error } = await admin
    .from('comments')
    .insert(insert)
    .select('id, post_slug, user_id, author_display, content, parent_id, created_at')
    .single();

  if (error) {
    console.error('[comments:post]', error);
    return json({ error: 'storage_error' }, { status: 500 });
  }
  return json({ comment }, { status: 201 });
}

async function handleDelete(req, url) {
  const tok = bearer(req);
  if (!tok) return json({ error: 'unauthenticated' }, { status: 401 });
  const user = await verifyUser(tok);
  if (!user) return json({ error: 'invalid_token' }, { status: 401 });

  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'missing id' }, { status: 400 });

  const { data: comment } = await admin
    .from('comments')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();

  if (!comment) return json({ error: 'not_found' }, { status: 404 });
  if (comment.user_id !== user.user_id) return json({ error: 'forbidden' }, { status: 403 });

  const { error } = await admin
    .from('comments')
    .update({ is_deleted: true })
    .eq('id', id);

  if (error) {
    console.error('[comments:delete]', error);
    return json({ error: 'storage_error' }, { status: 500 });
  }
  return json({ ok: true });
}

export const config = { path: '/api/comments' };
