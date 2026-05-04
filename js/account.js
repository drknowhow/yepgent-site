// /account — magic-link signup/signin + account dashboard.
//
// Uses Supabase JS via ESM CDN (no build step). The flow:
//   - Page loads → init Supabase client → check session.
//   - If signed in → fetch /api/me → render dashboard.
//   - If not signed in → render magic-link form.
//   - Magic-link redirects back to /account/ with a hash fragment;
//     Supabase JS auto-detects and stores the session.
//
// All "authed" API calls send Authorization: Bearer <access_token>.

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
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce'
    }
  });

  const $signedOut  = document.getElementById('signed-out');
  const $signedIn   = document.getElementById('signed-in');
  const $status     = document.getElementById('status');
  const $signinForm = document.getElementById('signin-form');
  const $signinEmail= document.getElementById('signin-email');
  const $signoutBtn = document.getElementById('signout-btn');
  const $profileForm= document.getElementById('profile-form');
  const $subscribeBtn = document.getElementById('subscribe-btn');
  const $unsubscribeBtn = document.getElementById('unsubscribe-btn');

  function show(which) {
    $signedOut.hidden = which !== 'out';
    $signedIn.hidden  = which !== 'in';
    document.getElementById('loading').hidden = true;
  }

  function setStatus(msg, kind) {
    $status.textContent = msg || '';
    $status.dataset.kind = kind || '';
  }

  function authHeader(session) {
    return { authorization: `Bearer ${session.access_token}` };
  }

  // ---------- signed-out form ----------
  $signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $signinEmail.value.trim();
    if (!email) return;
    setStatus('Sending magic link…', 'pending');
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/account/` }
    });
    if (error) {
      setStatus(`Couldn't send: ${error.message}`, 'error');
      return;
    }
    setStatus(`Check ${email} — the link will sign you in. You can close this tab.`, 'ok');
  });

  // ---------- signed-in dashboard ----------
  $signoutBtn.addEventListener('click', async () => {
    await sb.auth.signOut();
    location.reload();
  });

  async function loadDashboard(session) {
    setStatus('Loading your account…', 'pending');
    let res;
    try {
      res = await fetch('/api/me', { headers: authHeader(session) });
    } catch (err) {
      setStatus(`Network error: ${err.message}`, 'error');
      return;
    }
    if (!res.ok) {
      setStatus(`Couldn't load account (HTTP ${res.status}).`, 'error');
      return;
    }
    const data = await res.json();
    renderDashboard(data, session);
    setStatus('', '');
  }

  function renderDashboard({ account, subscriptions }, session) {
    document.getElementById('me-email').textContent = account.email;
    document.getElementById('me-id').textContent = account.user_id;
    document.getElementById('f-display-name').value = account.display_name || '';
    document.getElementById('f-is-agent').checked = !!account.is_agent;
    document.getElementById('f-agent-kind').value = account.agent_kind || '';
    document.getElementById('f-agent-purpose').value = account.agent_purpose || '';
    document.getElementById('f-operator-email').value = account.operator_email || '';

    const active = subscriptions.find(s => s.status === 'subscribed');
    document.getElementById('sub-state').textContent = active
      ? `Subscribed via ${active.source}.`
      : 'Not currently subscribed.';
    $subscribeBtn.hidden    = !!active;
    $unsubscribeBtn.hidden  = !active;
  }

  $profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data: sess } = await sb.auth.getSession();
    if (!sess.session) return;
    setStatus('Saving…', 'pending');
    const body = {
      display_name: document.getElementById('f-display-name').value.trim() || null,
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
    if (!res.ok) {
      setStatus(`Save failed (HTTP ${res.status}).`, 'error');
      return;
    }
    setStatus('Saved.', 'ok');
    setTimeout(() => setStatus('', ''), 1500);
  });

  $subscribeBtn.addEventListener('click', async () => {
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

  $unsubscribeBtn.addEventListener('click', async () => {
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

  // ---------- bootstrap ----------
  (async () => {
    const { data: sess } = await sb.auth.getSession();
    if (sess.session) {
      show('in');
      await loadDashboard(sess.session);
    } else {
      show('out');
    }
    sb.auth.onAuthStateChange((_event, session) => {
      if (session) {
        show('in');
        loadDashboard(session);
      } else {
        show('out');
      }
    });
  })();
}
