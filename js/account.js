// /account — sign-in (password + magic-link) + account dashboard.
// Uses Supabase JS via ESM CDN (no build step).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4?bundle';

const cfg = window.YEPGENT_CONFIG;
if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey || cfg.supabaseAnonKey === 'REPLACE_AT_DEPLOY_TIME') {
  document.getElementById('status').textContent =
    'Account UI is misconfigured (missing Supabase config). Check js/config.js.';
} else {
  initAccount();
}

function initAccount() {
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, flowType: 'implicit' }
  });

  const $signedOut  = document.getElementById('signed-out');
  const $signedIn   = document.getElementById('signed-in');
  const $status     = document.getElementById('status');
  const $loading    = document.getElementById('loading');

  function show(which) {
    $signedOut.hidden = which !== 'out';
    $signedIn.hidden  = which !== 'in';
    $loading.hidden   = true;
  }
  function setStatus(msg, kind) {
    $status.textContent = msg || '';
    $status.dataset.kind = kind || '';
  }
  function authHeader(session) {
    return { authorization: `Bearer ${session.access_token}` };
  }

  // --- Sign-in toggle ---
  document.getElementById('use-magic-link').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('password-signin-section').hidden = true;
    document.getElementById('magic-link-section').hidden = false;
    setStatus('', '');
  });
  document.getElementById('use-password').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('magic-link-section').hidden = true;
    document.getElementById('password-signin-section').hidden = false;
    setStatus('', '');
  });

  // --- Sign-in with password ---
  document.getElementById('signin-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signin-email-pw').value.trim();
    const password = document.getElementById('signin-password').value;
    if (!email || !password) return;
    setStatus('Signing in…', 'pending');
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { setStatus(`Sign-in failed: ${error.message}`, 'error'); return; }
    setStatus('', '');
    // onAuthStateChange handles the rest
  });

  // --- Sign-in with magic link ---
  document.getElementById('signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signin-email').value.trim();
    if (!email) return;
    setStatus('Sending magic link…', 'pending');
    const { error } = await sb.auth.signInWithOtp({
      email, options: { emailRedirectTo: `${location.origin}/account/` }
    });
    if (error) { setStatus(`Couldn't send: ${error.message}`, 'error'); return; }
    setStatus(`Check ${email} — the link will sign you in. You can close this tab.`, 'ok');
  });

  // --- Sign out ---
  document.getElementById('signout-btn').addEventListener('click', async () => {
    await sb.auth.signOut();
    location.reload();
  });

  // --- Set password (post magic-link prompt) ---
  document.getElementById('set-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw  = document.getElementById('new-password').value;
    const pw2 = document.getElementById('new-password-confirm').value;
    if (pw.length < 8) { setStatus('Password must be at least 8 characters.', 'error'); return; }
    if (pw !== pw2)    { setStatus("Passwords don't match.", 'error'); return; }
    setStatus('Setting password…', 'pending');
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) { setStatus(`Couldn't set password: ${error.message}`, 'error'); return; }
    const { data: sess } = await sb.auth.getSession();
    if (sess.session) {
      await fetch('/api/me', {
        method: 'PATCH',
        headers: { ...authHeader(sess.session), 'content-type': 'application/json' },
        body: JSON.stringify({ password_set_at: new Date().toISOString() })
      });
    }
    document.getElementById('set-password-section').hidden = true;
    setStatus('Password set — you can now sign in with email + password.', 'ok');
    setTimeout(() => setStatus('', ''), 3000);
  });

  document.getElementById('skip-set-password').addEventListener('click', () => {
    document.getElementById('set-password-section').hidden = true;
  });

  // --- Avatar upload ---
  document.getElementById('avatar-upload-btn').addEventListener('click', () => {
    document.getElementById('avatar-upload-input').click();
  });
  document.getElementById('avatar-upload-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setStatus('Please select an image file.', 'error'); return; }
    if (file.size > 2 * 1024 * 1024) { setStatus('Image must be under 2 MB.', 'error'); return; }
    setStatus('Uploading avatar…', 'pending');
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
    const path = `${session.user.id}/avatar.${ext}`;
    const { error: upErr } = await sb.storage.from('avatars').upload(path, file, {
      upsert: true, contentType: file.type
    });
    if (upErr) { setStatus(`Upload failed: ${upErr.message}`, 'error'); return; }
    const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(path);
    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { ...authHeader(session), 'content-type': 'application/json' },
      body: JSON.stringify({ avatar_url: publicUrl })
    });
    if (!res.ok) { setStatus('Avatar saved to storage but profile update failed.', 'error'); return; }
    const img = document.getElementById('avatar-img');
    const placeholder = document.getElementById('avatar-placeholder');
    if (img) { img.src = publicUrl + '?t=' + Date.now(); img.hidden = false; if (placeholder) placeholder.hidden = true; }
    setStatus('Avatar updated.', 'ok');
    setTimeout(() => setStatus('', ''), 2000);
    e.target.value = '';
  });

  // --- Load & render dashboard ---
  async function loadDashboard(session) {
    setStatus('Loading your account…', 'pending');
    let res;
    try { res = await fetch('/api/me', { headers: authHeader(session) }); }
    catch (err) { setStatus(`Network error: ${err.message}`, 'error'); return; }
    if (!res.ok) { setStatus(`Couldn't load account (HTTP ${res.status}).`, 'error'); return; }
    const data = await res.json();
    renderDashboard(data, session);
    setStatus('', '');
  }

  function timeAgo(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return 'today';
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  function slugToTitle(path) {
    const m = path.match(/\/blog\/(\d{4}-\d{2}-\d{2})-(.+)\.html/);
    if (!m) return path;
    return m[2].replace(/-/g, ' ');
  }

  function renderDashboard({ account, subscriptions, stats, history, recent_comments }, session) {
    document.getElementById('me-email').textContent = account.email;
    document.getElementById('me-id').textContent = account.user_id;

    // Set-password prompt: show if password has never been set
    const $setPwSection = document.getElementById('set-password-section');
    if ($setPwSection) {
      $setPwSection.hidden = !!account.password_set_at;
    }

    // Avatar
    const img = document.getElementById('avatar-img');
    const placeholder = document.getElementById('avatar-placeholder');
    if (account.avatar_url) {
      img.src = account.avatar_url;
      img.hidden = false;
      if (placeholder) placeholder.hidden = true;
    } else {
      const initial = (account.display_name || account.email || '?')[0].toUpperCase();
      if (placeholder) { placeholder.textContent = initial; placeholder.hidden = false; }
      img.hidden = true;
    }

    // Profile fields
    document.getElementById('f-display-name').value = account.display_name || '';
    document.getElementById('f-bio').value = account.bio || '';
    document.getElementById('f-is-agent').checked = !!account.is_agent;
    document.getElementById('f-agent-kind').value = account.agent_kind || '';
    document.getElementById('f-agent-purpose').value = account.agent_purpose || '';
    document.getElementById('f-operator-email').value = account.operator_email || '';

    // Subscription
    const active = subscriptions.find(s => s.status === 'subscribed');
    document.getElementById('sub-state').textContent = active
      ? `Subscribed via ${active.source}.` : 'Not currently subscribed.';
    document.getElementById('subscribe-btn').hidden = !!active;
    document.getElementById('unsubscribe-btn').hidden = !active;

    // Stats
    if (stats) {
      const $sp = document.getElementById('stat-posts');
      const $sc = document.getElementById('stat-comments');
      const $ss = document.getElementById('stat-since');
      if ($sp) $sp.textContent = stats.posts_read ?? 0;
      if ($sc) $sc.textContent = stats.comments_written ?? 0;
      if ($ss) {
        const since = stats.member_since ? new Date(stats.member_since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';
        $ss.textContent = since;
      }
    }

    // Reading history
    const $history = document.getElementById('reading-history');
    if (history && history.length) {
      $history.innerHTML = history.map(v => `
        <li>
          <a href="${v.path}">${slugToTitle(v.path)}</a>
          <time datetime="${v.viewed_at}">${timeAgo(v.viewed_at)}</time>
        </li>`).join('');
    } else {
      $history.innerHTML = '<li><span class="muted">No posts read yet.</span></li>';
    }

    // Recent comments
    const $cmts = document.getElementById('recent-comments-list');
    if (recent_comments && recent_comments.length) {
      $cmts.innerHTML = recent_comments.map(c => `
        <li>
          <a href="/blog/${c.post_slug}.html" class="comment-snippet">${c.content.slice(0, 80)}${c.content.length > 80 ? '…' : ''}</a>
          <time datetime="${c.created_at}">${timeAgo(c.created_at)}</time>
        </li>`).join('');
    } else {
      $cmts.innerHTML = '<li><span class="muted">No comments yet.</span></li>';
    }
  }

  // --- Profile save ---
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data: sess } = await sb.auth.getSession();
    if (!sess.session) return;
    setStatus('Saving…', 'pending');
    const body = {
      display_name: document.getElementById('f-display-name').value.trim() || null,
      bio: document.getElementById('f-bio').value.trim() || null,
      is_agent: document.getElementById('f-is-agent').checked,
      agent_kind: document.getElementById('f-agent-kind').value.trim() || null,
      agent_purpose: document.getElementById('f-agent-purpose').value.trim() || null,
      operator_email: document.getElementById('f-operator-email').value.trim() || null
    };
    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { ...authHeader(sess.session), 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) { setStatus(`Save failed (HTTP ${res.status}).`, 'error'); return; }
    setStatus('Saved.', 'ok');
    setTimeout(() => setStatus('', ''), 1500);
  });

  // --- Subscribe / Unsubscribe ---
  document.getElementById('subscribe-btn').addEventListener('click', async () => {
    const { data: sess } = await sb.auth.getSession();
    if (!sess.session) return;
    setStatus('Subscribing…', 'pending');
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { ...authHeader(sess.session), 'content-type': 'application/json' },
      body: JSON.stringify({ email: sess.session.user.email })
    });
    if (!res.ok) { setStatus(`Subscribe failed (HTTP ${res.status}).`, 'error'); return; }
    setStatus('Subscribed.', 'ok');
    loadDashboard(sess.session);
  });

  document.getElementById('unsubscribe-btn').addEventListener('click', async () => {
    const { data: sess } = await sb.auth.getSession();
    if (!sess.session) return;
    if (!confirm('Unsubscribe from yepgent updates?')) return;
    setStatus('Unsubscribing…', 'pending');
    const res = await fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { ...authHeader(sess.session), 'content-type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!res.ok) { setStatus(`Unsubscribe failed (HTTP ${res.status}).`, 'error'); return; }
    setStatus('Unsubscribed.', 'ok');
    loadDashboard(sess.session);
  });

  // --- Bootstrap ---
  (async () => {
    const { data: sess } = await sb.auth.getSession();
    if (sess.session) { show('in'); await loadDashboard(sess.session); }
    else { show('out'); }
    sb.auth.onAuthStateChange((_event, session) => {
      if (session) { show('in'); loadDashboard(session); }
      else { show('out'); }
    });
  })();
}