// /account/reset-password — password reset flow.
// Step 1: user enters email → gets reset link via email.
// Step 2: user clicks link → lands here with recovery token → sets new password.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4?bundle';

const cfg = window.YEPGENT_CONFIG;
if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey || cfg.supabaseAnonKey === 'REPLACE_AT_DEPLOY_TIME') {
  document.getElementById('status').textContent =
    'Page is misconfigured (missing Supabase config). Check js/config.js.';
} else {
  initResetPassword();
}

function initResetPassword() {
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, flowType: 'implicit' }
  });

  const $loading    = document.getElementById('loading');
  const $request    = document.getElementById('request-section');
  const $newPw      = document.getElementById('new-password-section');
  const $status     = document.getElementById('status');

  function show(which) {
    $loading.hidden = true;
    $request.hidden = which !== 'request';
    $newPw.hidden   = which !== 'new-password';
  }
  function setStatus(msg, kind) {
    $status.textContent = msg || '';
    $status.dataset.kind = kind || '';
  }

  // Step 1: request reset email
  document.getElementById('request-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-email').value.trim();
    if (!email) return;
    setStatus('Sending reset link…', 'pending');
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/account/reset-password/`
    });
    if (error) { setStatus(`Couldn't send: ${error.message}`, 'error'); return; }
    setStatus(`Reset link sent to ${email}. Check your inbox.`, 'ok');
    document.getElementById('request-form').reset();
  });

  // Step 2: set new password
  document.getElementById('new-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw  = document.getElementById('np-password').value;
    const pw2 = document.getElementById('np-confirm').value;
    if (pw.length < 8) { setStatus('Password must be at least 8 characters.', 'error'); return; }
    if (pw !== pw2)    { setStatus("Passwords don't match.", 'error'); return; }
    setStatus('Setting new password…', 'pending');
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) { setStatus(`Couldn't set password: ${error.message}`, 'error'); return; }
    // Mark password_set_at in accounts table
    const { data: sess } = await sb.auth.getSession();
    if (sess.session) {
      await fetch('/api/me', {
        method: 'PATCH',
        headers: { authorization: `Bearer ${sess.session.access_token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ password_set_at: new Date().toISOString() })
      });
    }
    setStatus('Password updated. Taking you back to sign in…', 'ok');
    setTimeout(() => { window.location.href = '/account/'; }, 2000);
  });

  // Bootstrap: check if we arrived via a PASSWORD_RECOVERY link
  (async () => {
    const { data: sess } = await sb.auth.getSession();
    // If a recovery session is already live (token in URL was consumed), show new-password form
    if (sess.session) {
      show('new-password');
      return;
    }

    // Watch for Supabase to process the hash fragment
    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        show('new-password');
      } else if (event === 'SIGNED_IN' && session) {
        // Arrived with a recovery token that got auto-consumed as SIGNED_IN
        // Show new-password form if we have no password set yet
        show('new-password');
      }
    });

    show('request');
  })();
}