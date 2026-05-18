/* ─────────────────────────────────────────────────────────────────────
   cookie_storage.js — chunked-cookie storage adapter for Supabase auth.

   Mirrors static/yep_auth.js in drknowhow/Yep so the Supabase session
   persisted on yepgent.com is byte-for-byte readable by any
   *.yepgent.com subdomain (notably chat.yepgent.com). Both surfaces
   create Supabase clients with:

       { storage: makeCookieStorage('.yepgent.com'),
         storageKey: 'yepgent-auth', ... }

   Supabase session JSON can exceed the per-cookie 4KB limit (JWT +
   refresh + user metadata frequently lands in the 3-5KB range), so we
   chunk the encoded value across cookies and write a `${key}.n` meta
   cookie with the chunk count. The legacy single-cookie shape is read
   transparently for backward compat.

   Localhost behaviour: cookies cannot carry a Domain= attribute when
   served from `localhost`/`127.0.0.1` (browsers reject them silently).
   Detect that case and drop Domain= entirely.
   ───────────────────────────────────────────────────────────────────── */

const CHUNK_SIZE = 3000;

function _cookieAttrs(domain) {
  const onLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const parts = ['Path=/', 'Max-Age=31536000', 'SameSite=Lax'];
  if (location.protocol === 'https:') parts.push('Secure');
  if (!onLocalhost && domain) parts.push(`Domain=${domain}`);
  return parts.join('; ');
}

function _cookieMap() {
  const out = {};
  document.cookie.split(';').forEach(c => {
    const eq = c.indexOf('=');
    if (eq < 0) return;
    out[c.slice(0, eq).trim()] = c.slice(eq + 1);
  });
  return out;
}

export function makeCookieStorage(domain = '.yepgent.com') {
  const attrs = _cookieAttrs(domain);
  const expireAttrs = _cookieAttrs(domain).replace('Max-Age=31536000', 'Max-Age=0');

  return {
    getItem(key) {
      const map = _cookieMap();
      const n = parseInt(map[`${key}.n`] || '0', 10);
      if (!n) {
        const v = map[key];
        return v != null ? decodeURIComponent(v) : null;
      }
      let val = '';
      for (let i = 0; i < n; i++) {
        const part = map[`${key}.${i}`];
        if (part == null) return null;
        val += decodeURIComponent(part);
      }
      return val;
    },
    setItem(key, value) {
      this.removeItem(key);
      const enc = encodeURIComponent(value);
      const chunks = [];
      for (let i = 0; i < enc.length; i += CHUNK_SIZE) {
        chunks.push(enc.slice(i, i + CHUNK_SIZE));
      }
      document.cookie = `${key}.n=${chunks.length}; ${attrs}`;
      chunks.forEach((c, i) => {
        document.cookie = `${key}.${i}=${c}; ${attrs}`;
      });
    },
    removeItem(key) {
      const map = _cookieMap();
      Object.keys(map).forEach(k => {
        if (k === key || k === `${key}.n` || k.startsWith(`${key}.`)) {
          document.cookie = `${k}=; ${expireAttrs}`;
        }
      });
    },
  };
}

// Stable, project-agnostic name — must match chat.yepgent.com.
export const SHARED_STORAGE_KEY = 'yepgent-auth';
