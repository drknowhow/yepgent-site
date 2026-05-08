// js/comments.js — shared comment section for blog posts.
// Usage: <div id="comments" data-post-slug="2026-05-08-always-on"></div>
// Requires: /js/config.js loaded before this module.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4?bundle';

const cfg = window.YEPGENT_CONFIG;
if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey || cfg.supabaseAnonKey === 'REPLACE_AT_DEPLOY_TIME') {
  // Silently skip — config not injected (dev mode).
} else {
  initComments();
}

function initComments() {
  const container = document.getElementById('comments');
  if (!container) return;
  const slug = container.dataset.postSlug;
  if (!slug) return;

  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, flowType: 'implicit' }
  });

  // Build comment section HTML structure
  container.innerHTML = `
    <hr class="comments-rule" />
    <section class="comments-section">
      <h2 class="comments-heading">Comments</h2>
      <div id="comments-list" class="comments-list"><p class="muted comments-loading">Loading…</p></div>
      <div id="comment-auth-gate">
        <p class="muted" id="comment-signin-prompt">
          <a href="/account/" class="comment-signin-link">Sign in</a> to leave a comment.
        </p>
        <form id="comment-form" hidden class="comment-form" novalidate>
          <label class="vh" for="comment-input">Your comment</label>
          <textarea id="comment-input" name="content" rows="3" maxlength="2000"
            placeholder="Write a comment… (max 2000 characters)" required></textarea>
          <div class="comment-form-footer">
            <span id="comment-char-count" class="comment-char-count muted">0 / 2000</span>
            <button type="submit" class="cta primary comment-submit">Post comment</button>
          </div>
          <p id="comment-status" class="status" data-kind=""></p>
        </form>
      </div>
    </section>
  `;

  const $list = document.getElementById('comments-list');
  const $form = document.getElementById('comment-form');
  const $signinPrompt = document.getElementById('comment-signin-prompt');
  const $input = document.getElementById('comment-input');
  const $charCount = document.getElementById('comment-char-count');
  const $status = document.getElementById('comment-status');

  // Character counter
  $input.addEventListener('input', () => {
    $charCount.textContent = `${$input.value.length} / 2000`;
  });

  let currentSession = null;

  function authHeader() {
    return currentSession ? { authorization: `Bearer ${currentSession.access_token}` } : {};
  }

  async function loadComments() {
    const res = await fetch(`/api/comments?post=${encodeURIComponent(slug)}`);
    if (!res.ok) { $list.innerHTML = '<p class="muted">Could not load comments.</p>'; return; }
    const { comments } = await res.json();
    renderComments(comments || []);
  }

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function renderComments(comments) {
    if (!comments.length) {
      $list.innerHTML = '<p class="muted comments-empty">No comments yet. Be the first.</p>';
      return;
    }
    $list.innerHTML = comments.map(c => {
      const name = escHtml(c.display_name || 'Anonymous');
      const avatar = c.avatar_url
        ? `<img class="comment-avatar" src="${escHtml(c.avatar_url)}" alt="" aria-hidden="true" />`
        : `<span class="comment-avatar-placeholder" aria-hidden="true">${name[0].toUpperCase()}</span>`;
      const canDelete = currentSession && currentSession.user.id === c.user_id;
      const deleteBtn = canDelete
        ? `<button class="comment-delete ghost" data-id="${escHtml(c.id)}" title="Delete comment">×</button>`
        : '';
      return `
        <div class="comment-item" data-id="${escHtml(c.id)}">
          <div class="comment-meta">
            ${avatar}
            <span class="comment-author">${name}</span>
            <time class="comment-time muted" datetime="${escHtml(c.created_at)}">${timeAgo(c.created_at)}</time>
            ${deleteBtn}
          </div>
          <p class="comment-content">${escHtml(c.content)}</p>
        </div>`;
    }).join('');

    // Wire delete buttons
    $list.querySelectorAll('.comment-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this comment?')) return;
        const id = btn.dataset.id;
        const res = await fetch(`/api/comments?id=${encodeURIComponent(id)}`, {
          method: 'DELETE', headers: authHeader()
        });
        if (res.ok) loadComments();
      });
    });
  }

  $form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSession) return;
    const content = $input.value.trim();
    if (!content) return;
    $status.textContent = 'Posting…'; $status.dataset.kind = 'pending';
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      body: JSON.stringify({ post_slug: slug, content })
    });
    if (!res.ok) {
      $status.textContent = 'Failed to post. Try again.'; $status.dataset.kind = 'error';
      return;
    }
    $input.value = '';
    $charCount.textContent = '0 / 2000';
    $status.textContent = 'Posted.'; $status.dataset.kind = 'ok';
    setTimeout(() => { $status.textContent = ''; $status.dataset.kind = ''; }, 2000);
    loadComments();
  });

  function updateAuthUI(session) {
    currentSession = session;
    if (session) {
      $signinPrompt.hidden = true;
      $form.hidden = false;
    } else {
      $signinPrompt.hidden = false;
      $form.hidden = true;
    }
  }

  (async () => {
    loadComments();
    const { data: { session } } = await sb.auth.getSession();
    updateAuthUI(session);
    sb.auth.onAuthStateChange((_e, s) => updateAuthUI(s));
  })();
}
