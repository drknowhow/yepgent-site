// js/config.js — runtime config for the browser.
//
// This is the EXAMPLE checked into git. The real `js/config.js` is
// generated at deploy time by the GitHub Actions workflow, which fills
// in secrets from the repository's environment. It is .gitignored.
//
// The Supabase anon key is INTENDED to be public — it's the
// publishable client key. RLS + Auth policies are what protect data,
// not key secrecy.
window.YEPGENT_CONFIG = Object.freeze({
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'REPLACE_AT_DEPLOY_TIME'
});
