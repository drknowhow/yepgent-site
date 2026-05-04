// Shared helpers for yepgent.com Netlify Functions.
//
// One Supabase project backs everything: auth.users, public.accounts,
// public.email_subscribers, public.page_views.
//
// Env vars (set in Netlify):
//   SUPABASE_URL          — https://<ref>.supabase.co
//   SUPABASE_SERVICE_KEY  — service-role JWT; bypasses RLS. Server only,
//                           NEVER exposed to the client.
//   SUPABASE_JWKS_URL     — derived from URL when absent. Used to verify
//                           user JWTs. (Optional — we use REST /auth/v1/user
//                           via the project's anon key instead.)
//   SUPABASE_ANON_KEY     — public anon key, used by the Function to
//                           proxy `auth.getUser` (which needs anon key
//                           plus the user's bearer token).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  // Surfaced at cold start so misconfig is loud, not silent.
  console.error('[shared] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
}

// Service-role client for writes. Singleton — Netlify keeps Function
// containers warm across invocations.
export const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

/** Standard JSON response with permissive CORS for agent traffic. */
export function json(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization,content-type,x-agent-identity',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'cache-control': 'no-store',
      ...headers
    }
  });
}

/** Preflight handler. */
export function handlePreflight(req) {
  if (req.method === 'OPTIONS') return json({}, { status: 204 });
  return null;
}

/** Pull bearer token from Authorization header. Returns null if absent. */
export function bearer(req) {
  const h = req.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/**
 * Verify a Supabase user JWT and return { user_id, email } or null.
 * Uses Supabase's REST /auth/v1/user endpoint, which validates the JWT
 * against the project secret server-side.
 */
export async function verifyUser(token) {
  if (!token || !SUPABASE_ANON_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${token}`
      }
    });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u || !u.id) return null;
    return { user_id: u.id, email: u.email || null };
  } catch (err) {
    console.warn('[shared] verifyUser failed:', err.message);
    return null;
  }
}

/** Coarse User-Agent classification: 'human' | 'bot' | 'agent' | null. */
export function classifyUA(ua, agentIdentity) {
  if (agentIdentity) return 'agent';
  if (!ua) return null;
  const u = ua.toLowerCase();
  // Self-declaring agents (curl, python, common SDKs) before bot heuristic.
  if (/\b(curl|wget|httpie|python-requests|python-urllib|node-fetch|axios|go-http-client|java-http-client)\b/.test(u)) return 'agent';
  // Conventional crawler User-Agents.
  if (/\b(bot|crawler|spider|slurp|googlebot|bingbot|yandex|duckduckbot|applebot)\b/.test(u)) return 'bot';
  // Browser families.
  if (/\b(mozilla|chrome|safari|firefox|edge|opera)\b/.test(u)) return 'human';
  return null;
}

/** Compact UA family string, e.g. 'firefox/126', 'curl/8'. Best-effort. */
export function uaFamily(ua) {
  if (!ua) return null;
  const m = ua.match(/(curl|wget|python-requests|python-urllib|node-fetch|axios|go-http-client|firefox|chrome|safari|edge|opera|bot|crawler)[\/\s](\d+)/i);
  if (m) return `${m[1].toLowerCase()}/${m[2]}`;
  // Fallback: first slash-separated token.
  const t = ua.split(/[\s\(]/, 1)[0];
  return t ? t.slice(0, 64).toLowerCase() : null;
}

/** Strip query string + fragment from a referrer to avoid leaking secrets. */
export function cleanReferrer(ref) {
  if (!ref) return null;
  try {
    const u = new URL(ref);
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

/** Best-effort country from edge headers. Netlify forwards x-nf-geo. */
export function countryFromHeaders(req) {
  // Netlify provides geo via x-nf-geo (JSON, base64-encoded) or
  // x-country in some configurations.
  const cc = req.headers.get('x-country');
  if (cc) return cc.slice(0, 8);
  const geo = req.headers.get('x-nf-geo');
  if (geo) {
    try {
      const decoded = JSON.parse(Buffer.from(geo, 'base64').toString('utf8'));
      return decoded?.country?.code || null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Tighten an arbitrary string. */
export function clamp(s, n) {
  if (typeof s !== 'string') return null;
  return s.length > n ? s.slice(0, n) : s;
}
