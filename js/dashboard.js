import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4?bundle';

const cfg = window.YEPGENT_CONFIG;

function show(id)  { document.getElementById(id).hidden = false; }
function hide(id)  { document.getElementById(id).hidden = true; }
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function setVal(id, v)  { const el = document.getElementById(id); if (el) el.value = v || ''; }
function setChk(id, v)  { const el = document.getElementById(id); if (el) el.checked = !!v; }
function setStatus(msg, kind) {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = msg || '';
  el.dataset.kind = kind || '';
}
function authH(s) { return { authorization: `Bearer ${s.access_token}` }; }

function avatarUrl(displayName, email) {
  const seed = encodeURIComponent(displayName || email || 'user');
  return `https://api.dicebear.com/8.x/initials/svg?seed=${seed}&backgroundColor=6366f1&fontColor=ffffff&radius=50`;
}

(async () => {
  if (!cfg?.supabaseUrl || cfg.supabaseAnonKey === 'REPLACE_AT_DEPLOY_TIME') {
    setStatus('Dashboard misconfigured.', 'error');
    hide('loading');
    return;
  }

  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, flowType: 'implicit' }
  });

  const { data: { session } } = await sb.auth.getSession();

  hide('loading');

  if (!session) {
    show('signed-out');
    return;
  }

  show('dashboard');
  await loadDashboard(sb, session);

  sb.auth.onAuthStateChange(async (_e, s) => {
    if (s) {
      hide('signed-out');
      show('dashboard');
      await loadDashboard(sb, s);
    } else {
      hide('dashboard');
      show('signed-out');
    }
  });

  document.getElementById('signout-btn').addEventListener('click', async () => {
    await sb.auth.signOut();
    location.href = '/account/';
  });
})();

async function loadDashboard(sb, session) {
  setStatus('Loading…', 'pending');

  // Fetch account
  const res = await fetch('/api/me', { headers: authH(session) });
  if (!res.ok) { setStatus(`Couldn't load account (${res.status}).`, 'error'); return; }
  const { account, subscriptions } = await res.json();

  // Avatar
  const avatar = document.getElementById('dash-avatar');
  if (avatar) avatar.src = avatarUrl(account.display_name, account.email);

  // Name heading
  const nameEl = document.getElementById('dash-name');
  if (nameEl) {
    nameEl.innerHTML = `${esc(account.display_name || 'Dashboard')}<span class="dot">.</span>`;
  }
  setText('dash-email', account.email);
  setText('me-id', account.user_id);

  // Stats
  const memberSince = account.created_at
    ? new Date(account.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';
  setText('stat-member', memberSince);

  const activeSub = subscriptions?.find(s => s.status === 'subscribed');
  setText('stat-sub', activeSub ? '✓' : '—');
  document.getElementById('sub-state').textContent = activeSub
    ? `Subscribed via ${activeSub.source}.`
    : 'Not subscribed.';
  document.getElementById('subscribe-btn').hidden   = !!activeSub;
  document.getElementById('unsubscribe-btn').hidden = !activeSub;

  // Populate profile form
  setVal('f-display-name', account.display_name);
  setVal('f-bio',          account.bio);
  setVal('f-location',     account.location);
  setVal('f-website',      account.website_url);
  const sl = account.social_links || {};
  setVal('f-sl-twitter',  sl.twitter);
  setVal('f-sl-github',   sl.github);
  setVal('f-sl-linkedin', sl.linkedin);
  setVal('f-sl-mastodon', sl.mastodon);
  setVal('f-sl-bluesky',  sl.bluesky);
  setChk('f-is-agent',    account.is_agent);
  setVal('f-agent-kind',   account.agent_kind);
  setVal('f-agent-purpose',account.agent_purpose);
  setVal('f-operator-email',account.operator_email);

  setStatus('', '');

  // Load user's own comments
  loadMyComments(session);

  // Profile form save
  const profileForm = document.getElementById('profile-form');
  // Remove previous listener by cloning
  const newForm = profileForm.cloneNode(true);
  profileForm.parentNode.replaceChild(newForm, profileForm);

  newForm.addEventListener('submit', async e => {
    e.preventDefault();
    const { data: { session: s } } = await sb.auth.getSession();
    if (!s) return;
    setStatus('Saving…', 'pending');

    const body = {
      display_name:   document.getElementById('f-display-name').value.trim() || null,
      bio:            document.getElementById('f-bio').value.trim() || null,
      location:       document.getElementById('f-location').value.trim() || null,
      website_url:    document.getElementById('f-website').value.trim() || null,
      social_links: {
        twitter:  document.getElementById('f-sl-twitter').value.trim() || null,
        github:   document.getElementById('f-sl-github').value.trim() || null,
        linkedin: document.getElementById('f-sl-linkedin').value.trim() || null,
        mastodon: document.getElementById('f-sl-mastodon').value.trim() || null,
        bluesky:  document.getElementById('f-sl-bluesky').value.trim() || null,
      },
      is_agent:       document.getElementById('f-is-agent').checked,
      agent_kind:     document.getElementById('f-agent-kind').value.trim() || null,
      agent_purpose:  document.getElementById('f-agent-purpose').value.trim() || null,
      operator_email: document.getElementById('f-operator-email').value.trim() || null,
    };

    const r = await fetch('/api/me', {
      method: 'PATCH',
      headers: { ...authH(s), 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (r.ok) {
      setStatus('Saved.', 'ok');
      setTimeout(() => setStatus('', ''), 1500);
      const { account: upd } = await r.json();
      const av = document.getElementById('dash-avatar');
      if (av) av.src = avatarUrl(upd.display_name, upd.email);
      const ne = document.getElementById('dash-name');
      if (ne) ne.innerHTML = `${esc(upd.display_name || 'Dashboard')}<span class="dot">.</span>`;
    } else {
      setStatus(`Save failed (${r.status}).`, 'error');
    }
  });

  // Subscribe / Unsubscribe
  const subBtn = document.getElementById('subscribe-btn');
  const unsubBtn = document.getElementById('unsubscribe-btn');

  subBtn.onclick = async () => {
    const { data: { session: s } } = await sb.auth.getSession();
    if (!s) return;
    setStatus('Subscribing…', 'pending');
    const r = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { ...authH(s), 'content-type': 'application/json' },
      body: JSON.stringify({ email: s.user.email })
    });
    if (!r.ok) { setStatus(`Failed (${r.status}).`, 'error'); return; }
    setStatus('Subscribed.', 'ok');
    setTimeout(() => setStatus('', ''), 1500);
    await loadDashboard(sb, s);
  };

  unsubBtn.onclick = async () => {
    const { data: { session: s } } = await sb.auth.getSession();
    if (!s || !confirm('Unsubscribe?')) return;
    setStatus('Unsubscribing…', 'pending');
    const r = await fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { ...authH(s), 'content-type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!r.ok) { setStatus(`Failed (${r.status}).`, 'error'); return; }
    setStatus('Unsubscribed.', 'ok');
    setTimeout(() => setStatus('', ''), 1500);
    await loadDashboard(sb, s);
  };
}

async function loadMyComments(session) {
  const container = document.getElementById('my-comments');
  if (!container) return;

  const res = await fetch('/api/comments?user=me', {
    headers: authH(session)
  });

  if (!res.ok) {
    container.innerHTML = '<p class="muted small">Couldn\'t load comments.</p>';
    return;
  }

  const { comments } = await res.json();

  // Update stat
  setText('stat-comments', comments?.length ?? 0);

  if (!comments?.length) {
    container.innerHTML = '<p class="muted small">You haven\'t commented yet.</p>';
    return;
  }

  container.innerHTML = '';
  for (const c of comments) {
    const div = document.createElement('div');
    div.style.cssText = 'border-left:2px solid var(--rule);padding:0 0 0 0.9rem;margin:0 0 1rem';
    const when = new Date(c.created_at).toLocaleDateString();
    const slug = c.post_slug;
    div.innerHTML = `
      <p class="muted small" style="margin:0 0 0.2rem">
        <a href="/blog/${encodeURIComponent(slug)}.html">${esc(slug)}</a> &middot; ${esc(when)}
      </p>
      <p style="margin:0;font-size:.95rem;white-space:pre-wrap;word-break:break-word">${esc(c.content)}</p>
    `;
    container.appendChild(div);
  }
}

function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
