// Shared comments module — embed in any blog post.
// Usage:
//   <section class="comments-section" aria-label="Comments">
//     <h2>Discussion<span class="dot">.</span></h2>
//     <div id="comments-root" data-post-slug="SLUG">
//       <div class="comments-list"></div>
//       <p class="comment-signin muted small" hidden></p>
//       <form class="comment-form" hidden>
//         <p class="comment-status muted small"></p>
//         <textarea class="comment-text" rows="4" maxlength="5000" placeholder="Share a thought…" required></textarea>
//         <button type="submit" class="comment-submit cta primary">Post comment</button>
//       </form>
//     </div>
//   </section>
//   <script src="/js/config.js"></script>
//   <script type="module">
//     import { initComments } from '/js/comments.js';
//     initComments(document.getElementById('comments-root'));
//   </script>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4?bundle';

export async function initComments(root) {
  if (!root) return;
  const slug = root.dataset.postSlug;
  if (!slug) return;

  const cfg = window.YEPGENT_CONFIG;
  let sb = null;
  if (cfg?.supabaseUrl && cfg.supabaseAnonKey && cfg.supabaseAnonKey !== 'REPLACE_AT_DEPLOY_TIME') {
    sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { detectSessionInUrl: false, persistSession: true, autoRefreshToken: true, flowType: 'implicit' }
    });
  }

  let session = null;
  if (sb) {
    const { data } = await sb.auth.getSession();
    session = data?.session || null;
    sb.auth.onAuthStateChange((_e, s) => {
      session = s;
      updateFormVisibility(root, session);
    });
  }

  await renderComments(root, slug, session);
  updateFormVisibility(root, session);
  setupForm(root, slug, sb, () => renderComments(root, slug, session));
}

async function renderComments(root, slug, session) {
  const list = root.querySelector('.comments-list');
  if (!list) return;
  list.innerHTML = '<p class="muted small">Loading…</p>';

  try {
    const res = await fetch(`/api/comments?post_slug=${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { comments } = await res.json();

    if (!comments?.length) {
      list.innerHTML = '<p class="muted small">No comments yet. Be the first.</p>';
      return;
    }

    const myId = session?.user?.id || null;
    const top = comments.filter(c => !c.parent_id);
    const byParent = {};
    for (const c of comments) {
      if (c.parent_id) (byParent[c.parent_id] ||= []).push(c);
    }

    list.innerHTML = '';
    for (const c of top) {
      list.appendChild(buildComment(c, byParent[c.id] || [], myId, session?.access_token));
    }
  } catch {
    list.innerHTML = '<p class="muted small">Couldn\'t load comments.</p>';
  }
}

function buildComment(c, replies, myId, token) {
  const art = document.createElement('article');
  art.className = 'comment';
  art.dataset.id = c.id;

  const when = timeAgo(new Date(c.created_at));
  const isOwn = myId && c.user_id === myId;

  art.innerHTML = `
    <header class="comment-header">
      <span class="comment-author">${esc(c.author_display || 'anon')}</span>
      <time class="comment-time" datetime="${esc(c.created_at)}">${esc(when)}</time>
      ${isOwn ? '<button class="comment-delete ghost small" type="button" title="Delete">&times;</button>' : ''}
    </header>
    <div class="comment-body">${esc(c.content)}</div>
    ${replies.length ? '<div class="comment-replies"></div>' : ''}
  `;

  if (isOwn) {
    art.querySelector('.comment-delete').addEventListener('click', async () => {
      if (!confirm('Delete this comment?')) return;
      const r = await fetch(`/api/comments?id=${encodeURIComponent(c.id)}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` }
      });
      if (r.ok) art.remove();
    });
  }

  const repliesEl = art.querySelector('.comment-replies');
  if (repliesEl) {
    for (const r of replies) repliesEl.appendChild(buildComment(r, [], myId, token));
  }

  return art;
}

function updateFormVisibility(root, session) {
  const signin = root.querySelector('.comment-signin');
  const form   = root.querySelector('.comment-form');
  if (!signin || !form) return;
  if (session) {
    signin.hidden = true;
    form.hidden = false;
  } else {
    signin.hidden = false;
    form.hidden = true;
  }
}

function setupForm(root, slug, sb, onPosted) {
  const form   = root.querySelector('.comment-form');
  const status = root.querySelector('.comment-status');
  const text   = root.querySelector('.comment-text');
  const submit = root.querySelector('.comment-submit');
  if (!form || !sb) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const content = text.value.trim();
    if (!content) return;
    submit.disabled = true;
    if (status) status.textContent = 'Posting…';

    const { data: sess } = await sb.auth.getSession();
    if (!sess?.session) {
      if (status) status.textContent = 'Please sign in first.';
      submit.disabled = false;
      return;
    }

    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${sess.session.access_token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ post_slug: slug, content })
    });

    if (res.ok) {
      text.value = '';
      if (status) status.textContent = '';
      await onPosted();
    } else {
      const err = await res.json().catch(() => ({}));
      if (status) status.textContent = `Couldn't post: ${err.error || res.status}`;
    }
    submit.disabled = false;
  });
}

function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(d) {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60)      return 'just now';
  if (s < 3600)    return `${Math.floor(s/60)}m ago`;
  if (s < 86400)   return `${Math.floor(s/3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s/86400)}d ago`;
  return d.toLocaleDateString();
}
