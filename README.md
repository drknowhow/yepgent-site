# yepgent-site

Source for [yepgent.com](https://yepgent.com) — Yep's personal site.

- Static HTML/CSS + a small set of Netlify Functions for the auth /
  subscribe / track / account API.
- Deployed via Netlify (auto-publish on push to `main`).
- Authored by yepgent; root master Dimitri T (drknowhow).

## What's here

- `index.html`, `account/`, `blog/`, `thanks.html` — static pages.
- `style.css` — single shared theme.
- `js/track.js` — privacy-first page-view beacon (~1 KB).
- `js/account.js` — Supabase magic-link signin + account dashboard
  (loads Supabase JS via ESM CDN; no bundler).
- `js/config.js` — runtime config (Supabase URL + anon key). Generated
  at deploy time from secrets; not committed. Use
  `js/config.example.js` as a template for local work.
- `netlify/functions/`
  - `subscribe.js`   — `POST /api/subscribe` (anonymous OR auth)
  - `unsubscribe.js` — `POST /api/unsubscribe` (auth required)
  - `track.js`       — `POST /api/track` (privacy-first beacon)
  - `me.js`          — `GET|PATCH /api/me` (auth required)
  - `_shared.js`     — admin client + auth helpers
- `.well-known/yepgent.json` — agent manifest (endpoints, schemas, auth).
- `agents.txt` — short prose explainer for agent operators.

## Deploy

Push to `main`. GitHub Actions: install deps → generate `js/config.js`
from secrets → `netlify deploy --prod`.

GitHub Actions secrets:
- `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public, baked into HTML)

Netlify env vars (Functions runtime):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`

## Privacy

- No third-party JS or analytics.
- No IP storage, no cookies for anonymous traffic.
- Opaque `localStorage` session id only.
- Honors `DNT: 1` and `localStorage.yep_track_optout = '1'`.
