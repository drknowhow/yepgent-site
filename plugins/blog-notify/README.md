# netlify-plugin-blog-notify

Netlify Build Plugin that emails subscribers about new yepgent.com
blog posts after each successful deploy.

## What it does

1. Reads the built `blog/index.json` from the publish dir.
2. For each item, derives a slug from the post URL.
3. Drops anything older than `lookbackDays` (default 14) as a
   first-run flood guard.
4. Pulls active rows from Supabase `email_subscribers`
   (`status='subscribed'`, excluding test sources).
5. For each (post, subscriber) pair not already in `email_sends`,
   POSTs an email to Resend and inserts a ledger row.

The plugin runs in Netlify's `onSuccess` stage, so the post URL is
live by the time the email goes out — no race between the blast and
the page being available.

## Why a plugin (not a Function or a cron)

A Function would need to be triggered (by webhook, schedule, or the
agent), which is the exact failure mode this plugin removes. The
plugin runs because the deploy succeeded, with the just-deployed
content sitting on disk and the URL already live. Zero coordination,
no race.

## Required Netlify environment variables

| Variable               | Used for                                |
|------------------------|-----------------------------------------|
| `RESEND_API_KEY`       | POST to `api.resend.com/emails`         |
| `SUPABASE_URL`         | REST against `email_subscribers` + `email_sends` |
| `SUPABASE_SERVICE_KEY` | Service-role JWT (bypasses RLS)         |
| `UNSUB_SECRET`         | HMAC for unsubscribe link in email footer |
| `FROM_EMAIL` (optional)| Overrides the `fromEmail` plugin input  |

The first three are already used by `netlify/functions/_shared.js`.
`UNSUB_SECRET` is already used by `netlify/functions/unsubscribe.js`.
`RESEND_API_KEY` is the only new one to add.

## Idempotency

Per-`(recipient, campaign_kind, campaign_ref)` uniqueness is enforced
in Supabase by a partial unique index on `email_sends`. The plugin
does a SELECT before each send and treats Postgres `23505` /
`409 Conflict` on insert as `already_logged`. Re-running a build —
manually, or after a fix — never double-sends.

## Inputs

See `manifest.yml`. Typical override:

```toml
[[plugins]]
  package = "./plugins/blog-notify"
  [plugins.inputs]
    dryRun = true            # preview without sending
```

## Failure handling

- Missing env vars → log a warning, skip the blast. **Never fails
  the deploy.**
- Supabase or Resend errors → logged per-recipient, ledgered as
  `status='failed'` when reachable, retried on the next deploy.
- Plugin crash → `onSuccess` failures don't roll back the deploy.

## Related code

- `src/listeners/blog_notify.py` (yep repo) — Python source of truth
  for email template + send semantics. Keep the two in sync.
- `src/listeners/blog_notify_catchup.py` — 2-hour cron on the yep
  side that fires for any gap. Will be retired once this plugin is
  confirmed running in production.
- `netlify/functions/unsubscribe.js` — token verifier; mirrors the
  HMAC used here for unsubscribe links.
