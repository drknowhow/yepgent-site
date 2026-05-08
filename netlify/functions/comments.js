// /api/comments
//
// GET  ?post=<slug>          — list non-deleted comments for a post (public)
// POST { post_slug, content } — create comment (auth required)
// DELETE ?id=<comment_id>    — soft-delete own comment (auth required)

import { admin, json, handlePreflight, bearer, verifyUser, clamp, checkRateLimit } from './_shared.js';

export default async (req, _context) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  if (req.method === 'GET') return handleList(req);
  if (req.method === 'POST') return handleCreate(req);
  if (req.method === 'DELETE') return handleDelete(req);
  return json({ error: 'method_not_allowed' }, { status: 405 });
};

async function handleList(req) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get('post') || '').trim();
  if (!slug) return json({ error: 'missing_post' }, { status: 400 });

  const { data, error } = await admin
    .from('comments')
    .select('id, post_slug, user_id, content, created_at, updated_at, accounts(display_name, avatar_url)')
    .eq('post_slug', slug)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    console.error('[comments:list]', error);
    return json({ error: 'storage_error' }, { status: 500 });
  }

  // Shape: flatten accounts join.
  const comments = (data || []).map(c => ({
    id: c.id,
    post_slug: c.post_slug,
    user_id: c.user_id,
    content: c.content,
    created_at: c.created_at,
    updated_at: c.updated_at,
    display_name: c.accounts?.display_name || null,
    avatar_url: c.accounts?.avatar_url || null
  }));

  return json({ comments }, { headers: { 'cache-control': 'public, max-age=30, must-revalidate' } });
}

async function handleCreate(req) {
  const tok = bearer(req);
  if (!tok) return json({ error: 'unauthenticated' }, { status: 401 });
  const user = await verifyUser(tok);
  if (!user) return json({ error: 'invalid_token' }, { status: 401 });

  if (checkRateLimit(`comment:${user.user_id}`)) {
    return json({ error: 'rate_limited' }, { status: 429 });
  }

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'invalid_json' }, { status: 400 }); }

  const slug = clamp((body.post_slug || '').trim(), 200);
  const content = clamp((body.content || '').trim(), 2000);
  if (!slug) return json({ error: 'missing_post_slug' }, { status: 400 });
  if (!content || content.length < 1) return json({ error: 'missing_content' }, { status: 400 });

  const { data, error } = await admin
    .from('comments')
    .insert({ post_slug: slug, user_id: user.user_id, content })
    .select('id, post_slug, user_id, content, created_at')
    .single();

  if (error) {
    console.error('[comments:create]', error);
    return json({ error: 'storage_error' }, { status: 500 });
  }

  return json({ comment: data }, { status: 201 });
}

async function handleDelete(req) {
  const tok = bearer(req);
  if (!tok) return json({ error: 'unauthenticated' }, { status: 401 });
  const user = await verifyUser(tok);
  if (!user) return json({ error: 'invalid_token' }, { status: 401 });

  const url = new URL(req.url);
  const id = (url.searchParams.get('id') || '').trim();
  if (!id) return json({ error: 'missing_id' }, { status: 400 });

  const { error } = await admin
    .from('comments')
    .update({ is_deleted: true })
    .eq('id', id)
    .eq('user_id', user.user_id); // Only own comments

  if (error) {
    console.error('[comments:delete]', error);
    return json({ error: 'storage_error' }, { status: 500 });
  }
  return json({ ok: true });
}

export const config = { path: '/api/comments' };
