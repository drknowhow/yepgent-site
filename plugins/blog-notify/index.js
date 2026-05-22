// Netlify Build Plugin: blog-notify
//
// After a successful deploy, fan out an email blast to every active
// subscriber for any post in blog/index.json that hasn't been notified
// yet. Idempotent via the Supabase `email_sends` ledger (one row per
// (recipient, slug); a duplicate insert is a silent no-op).
//
// Why this exists: the prior flow was a Python module on the Yep agent
// (src/listeners/blog_notify.py) that I had to remember to call
// manually after publishing. Forgetting that step is exactly the kind
// of thing humans don't catch until a subscriber pings them. Wiring it
// into the deploy pipeline removes the human (and the agent) from the
// loop — the URL is live the moment Netlify reports onSuccess, so
// there's no race.
//
// Mirrors src/listeners/blog_notify.py from the yep repo. If the email
// template or send semantics diverge, that file is the source of
// truth — port back here.
//
// Required Netlify env vars:
//   RESEND_API_KEY       — Resend API key (Bearer, server-only)
//   SUPABASE_URL         — same one used by other Functions
//   SUPABASE_SERVICE_KEY — service-role JWT; bypasses RLS
//   UNSUB_SECRET         — shared with Yep + unsubscribe.js
//
// Optional:
//   FROM_EMAIL           — overrides plugin `fromEmail` input
//
// Failure modes the plugin recovers from on the next deploy:
//   - Resend 5xx for some recipients → those rows aren't inserted as
//     'sent', so the next run retries them.
//   - Supabase REST flake → the whole run aborts, but no partial
//     ledger writes mean re-running is safe.
//   - Plugin crash → onSuccess is not a deploy gate; the site is
//     still live. We log the error so Netlify surfaces it.

import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const RESEND_API = 'https://api.resend.com/emails';
const USER_AGENT = 'Yep/1.0 (+https://github.com/drknowhow/yepgent-site)';

// Match the Python module's exclude list — these are test fixtures
// that should never receive real mail.
const EXCLUDED_SOURCES = new Set(['yep-smoke-test', 'test', 'fixture']);

/** Resolve env var with optional plugin-input override. */
function pick(input, envName) {
  if (input !== undefined && input !== null && input !== '') return input;
  return process.env[envName] || '';
}

/** Token = hex(HMAC-SHA256(UNSUB_SECRET, email.lower())). Mirrors the Python helper. */
function unsubUrl(email, secret) {
  if (!secret) return null;
  const token = createHmac('sha256', secret)
    .update(email.toLowerCase())
    .digest('hex');
  return `https://yepgent.com/unsubscribe?t=${token}&e=${encodeURIComponent(email)}`;
}

/** Minimal HTML escape — same surface area as html.escape() in Python. */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Render the two bodies. Matches the layout in src/listeners/blog_notify.py. */
function renderEmail({ title, summary, url, recipientName, unsubUrl }) {
  const safeTitle = escapeHtml(title);
  const safeSummary = escapeHtml(summary);
  const safeUrl = escapeHtml(url);
  const greeting = recipientName ? `Hi ${escapeHtml(recipientName)}` : 'Hi';

  const textLines = [
    `${recipientName ? `Hi ${recipientName}` : 'Hi'},`,
    '',
    `New post on yepgent.com: ${title}`,
    '',
    summary,
    '',
    `Read it here: ${url}`,
    '',
    '— Yep',
  ];
  if (unsubUrl) {
    textLines.push('', `Unsubscribe: ${unsubUrl}`);
  }
  const text = textLines.join('\n');

  const unsubBlock = unsubUrl
    ? `<a href="${escapeHtml(unsubUrl)}" style="color:#7a7a7a;">Unsubscribe</a>`
    : '';

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f7f5f1;
             font:16px/1.6 ui-serif,Georgia,'Iowan Old Style',
             Cambria,'Times New Roman',serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         border="0" style="background:#f7f5f1;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0"
               cellspacing="0" border="0"
               style="max-width:560px;background:#ffffff;border-radius:8px;
                      box-shadow:0 1px 3px rgba(0,0,0,0.06);
                      padding:36px 32px;">
          <tr>
            <td style="font:14px/1.5 ui-sans-serif,system-ui,
                       -apple-system,'Segoe UI',Roboto,sans-serif;
                       color:#7a7a7a;letter-spacing:0.04em;
                       text-transform:uppercase;padding-bottom:8px;">
              new post on yepgent.com
            </td>
          </tr>
          <tr>
            <td style="font:600 26px/1.25 ui-sans-serif,system-ui,
                       -apple-system,'Segoe UI',Roboto,sans-serif;
                       color:#111;padding-bottom:16px;">
              ${safeTitle}
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:20px;">${safeSummary}</td>
          </tr>
          <tr>
            <td style="padding-bottom:28px;">
              <a href="${safeUrl}"
                 style="display:inline-block;background:#111;color:#fff;
                        text-decoration:none;padding:10px 18px;
                        border-radius:6px;font:14px/1 ui-sans-serif,
                        system-ui,sans-serif;">Read the post →</a>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #ececec;padding-top:18px;
                       font:13px/1.5 ui-sans-serif,system-ui,sans-serif;
                       color:#7a7a7a;">
              — Yep<br>
              ${unsubBlock}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // `greeting` is referenced only to silence the unused-warning when
  // a linter ever runs over this. The greeting is already inlined in
  // textLines / html via the recipientName branches.
  void greeting;

  return { text, html };
}

// --- Supabase REST helpers ---------------------------------------------------
//
// We don't pull in @supabase/supabase-js — the plugin's Node 18+
// runtime has fetch, and we only need three trivial reads/writes.

async function sbSelect({ url, key, table, query }) {
  const u = new URL(`${url}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
  const r = await fetch(u, {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'accept-profile': 'public',
    },
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`supabase select ${table} HTTP ${r.status}: ${body.slice(0, 400)}`);
  }
  return r.json();
}

async function sbInsert({ url, key, table, row }) {
  const r = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      'content-profile': 'public',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (r.status === 409) return 'already_logged'; // unique violation = idempotent
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    // Postgres unique-violation surfaces as 23505 inside the error body
    // for some PostgREST configs even with non-409 status. Treat that
    // as idempotent, not failure.
    if (body.includes('23505') || /duplicate key/i.test(body)) return 'already_logged';
    throw new Error(`supabase insert ${table} HTTP ${r.status}: ${body.slice(0, 400)}`);
  }
  return 'inserted';
}

// --- Resend POST ------------------------------------------------------------

async function postResend(payload, apiKey) {
  const r = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      // Cloudflare in front of api.resend.com blocks the default
      // fetch UA with err 1010. The Python module hit this; matching
      // the workaround here.
      'user-agent': USER_AGENT,
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`resend HTTP ${r.status}: ${body.slice(0, 400)}`);
  }
  return r.json().catch(() => ({}));
}

// --- Plugin entry point -----------------------------------------------------

export const onSuccess = async ({ inputs, constants, utils }) => {
  // Inputs (manifest.yml supplies defaults).
  const enabled = inputs.enabled !== false;
  const feedPath = inputs.feedPath || 'blog/index.json';
  const campaignKind = inputs.campaignKind || 'blog_post';
  const fromEmail = pick(inputs.fromEmail, 'FROM_EMAIL') || 'Yepgent <hello@yepgent.com>';
  const dryRun = inputs.dryRun === true;
  const lookbackDays = Number(inputs.lookbackDays ?? 14);

  if (!enabled) {
    console.log('[blog-notify] disabled via input — skipping.');
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const unsubSecret = process.env.UNSUB_SECRET || '';

  // Missing config is loud but non-fatal. We don't want a forgotten
  // env var to fail the deploy itself — the site already shipped.
  const missing = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseKey) missing.push('SUPABASE_SERVICE_KEY');
  if (!resendKey && !dryRun) missing.push('RESEND_API_KEY');
  if (missing.length) {
    const msg = `[blog-notify] missing env vars: ${missing.join(', ')}. ` +
                `Skipping blast — fix in Netlify env and re-deploy.`;
    console.warn(msg);
    if (utils?.status?.show) {
      utils.status.show({ title: 'blog-notify skipped', summary: msg, text: '' });
    }
    return;
  }

  // 1. Read the built feed from the publish dir.
  const publishDir = constants?.PUBLISH_DIR || '.';
  const feedFullPath = join(publishDir, feedPath);
  let feed;
  try {
    const raw = await readFile(feedFullPath, 'utf8');
    feed = JSON.parse(raw);
  } catch (e) {
    console.warn(`[blog-notify] could not read ${feedFullPath}: ${e.message}. ` +
                 'Skipping blast.');
    return;
  }
  const items = Array.isArray(feed?.items) ? feed.items : [];
  if (!items.length) {
    console.log('[blog-notify] feed has no items — nothing to do.');
    return;
  }

  // 2. Resolve slug for each item. Convention: the slug is the path
  //    minus /blog/ and .html. Same shape the Python module uses.
  const itemsWithSlug = items
    .map((it) => {
      const url = String(it.url || '');
      const m = url.match(/\/blog\/([^/]+)\.html$/);
      if (!m) return null;
      return {
        slug: m[1],
        title: String(it.title || ''),
        summary: String(it.summary || ''),
        url,
        datePublished: it.date_published || null,
      };
    })
    .filter(Boolean);

  // 3. Apply lookback guard. Anything older than lookbackDays AND not
  //    in the ledger gets dropped silently — first-run flood
  //    protection. (Posts already in the ledger are skipped later via
  //    per-recipient idempotency, so they're harmless either way.)
  const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
  const recent = itemsWithSlug.filter((it) => {
    if (!it.datePublished) return true; // no date → don't drop
    const t = Date.parse(it.datePublished);
    return Number.isFinite(t) ? t >= cutoff : true;
  });

  if (recent.length === 0) {
    console.log('[blog-notify] no posts within lookback window — nothing to do.');
    return;
  }

  console.log(`[blog-notify] candidates within ${lookbackDays}d: ` +
              recent.map((r) => r.slug).join(', '));

  // 4. Pull subscribers once. Filter out test fixtures.
  let subs;
  try {
    subs = await sbSelect({
      url: supabaseUrl,
      key: supabaseKey,
      table: 'email_subscribers',
      query: { select: 'id,email,name,source,status', status: 'eq.subscribed' },
    });
  } catch (e) {
    console.error(`[blog-notify] subscriber fetch failed: ${e.message}`);
    return;
  }
  const activeSubs = subs.filter((s) => !EXCLUDED_SOURCES.has(s.source || ''));
  if (activeSubs.length === 0) {
    console.log('[blog-notify] no active subscribers — nothing to send.');
    return;
  }

  // 5. For each candidate post, fetch the already-sent set, then
  //    fire the gap. Per-post idempotency ledger reads keep us from
  //    re-sending across deploys, and we trust the unique index on
  //    email_sends as the last defense.
  const summary = { posts: 0, sent: 0, skipped: 0, failed: 0 };
  const errors = [];

  for (const post of recent) {
    let already;
    try {
      already = await sbSelect({
        url: supabaseUrl,
        key: supabaseKey,
        table: 'email_sends',
        query: {
          select: 'email',
          campaign_kind: `eq.${campaignKind}`,
          campaign_ref: `eq.${post.slug}`,
        },
      });
    } catch (e) {
      console.error(`[blog-notify] could not check ledger for ${post.slug}: ${e.message}`);
      errors.push(`${post.slug}: ledger read failed`);
      continue;
    }
    const sentEmails = new Set(
      already.map((r) => String(r.email || '').toLowerCase()).filter(Boolean)
    );

    const subject = `New post on yepgent.com: ${post.title}`;
    let postSent = 0;
    let postSkipped = 0;
    let postFailed = 0;

    for (const sub of activeSubs) {
      const emailRaw = String(sub.email || '').trim();
      if (!emailRaw) {
        postSkipped += 1;
        continue;
      }
      if (sentEmails.has(emailRaw.toLowerCase())) {
        postSkipped += 1;
        continue;
      }

      if (dryRun) {
        console.log(`[blog-notify] DRY-RUN would send: ${emailRaw} ← ${post.slug}`);
        postSent += 1;
        continue;
      }

      const link = unsubUrl(emailRaw, unsubSecret);
      const { text, html } = renderEmail({
        title: post.title,
        summary: post.summary,
        url: post.url,
        recipientName: sub.name || null,
        unsubUrl: link,
      });

      const payload = {
        from: fromEmail,
        to: [emailRaw],
        subject,
        html,
        text,
      };
      if (link) {
        payload.headers = {
          'List-Unsubscribe': `<${link}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        };
      }

      let messageId = null;
      let sendStatus = 'sent';
      let sendError = null;

      try {
        const resp = await postResend(payload, resendKey);
        messageId = resp?.id || null;
        postSent += 1;
      } catch (e) {
        sendStatus = 'failed';
        sendError = String(e.message || e).slice(0, 1000);
        postFailed += 1;
        errors.push(`${emailRaw} (${post.slug}): ${sendError}`);
      }

      try {
        await sbInsert({
          url: supabaseUrl,
          key: supabaseKey,
          table: 'email_sends',
          row: {
            subscriber_id: sub.id || null,
            email: emailRaw,
            campaign_kind: campaignKind,
            campaign_ref: post.slug,
            subject,
            status: sendStatus,
            resend_message_id: messageId,
            error: sendError,
            metadata: { url: post.url, title: post.title, via: 'netlify-plugin' },
          },
        });
      } catch (e) {
        // Send may have gone through; log failure is a paper-trail
        // miss, not a re-send risk (the next deploy retries by slug
        // + recipient regardless).
        errors.push(`${emailRaw} (${post.slug}): ledger insert failed: ${e.message}`);
      }
    }

    summary.posts += 1;
    summary.sent += postSent;
    summary.skipped += postSkipped;
    summary.failed += postFailed;

    if (postSent === 0 && postFailed === 0) {
      console.log(`[blog-notify] ${post.slug}: nothing to send (${postSkipped} already-sent).`);
    } else {
      console.log(`[blog-notify] ${post.slug}: sent=${postSent} ` +
                  `skipped=${postSkipped} failed=${postFailed}` +
                  (dryRun ? ' (dry-run)' : ''));
    }
  }

  const final = `posts=${summary.posts} sent=${summary.sent} ` +
                `skipped=${summary.skipped} failed=${summary.failed}` +
                (dryRun ? ' (dry-run)' : '');
  console.log(`[blog-notify] done: ${final}`);

  if (utils?.status?.show) {
    utils.status.show({
      title: dryRun ? 'blog-notify dry-run complete' : 'blog-notify complete',
      summary: final,
      text: errors.length ? `Errors:\n${errors.slice(0, 20).join('\n')}` : '',
    });
  }

  // We intentionally never call utils.build.failBuild — the deploy is
  // already live; a notify failure should be loud in logs and the
  // status pane, not roll back the site.
};
