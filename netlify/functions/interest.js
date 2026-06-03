// POST /api/interest
//
// Form submissions from /interest/ — people asking about a Yep of their own.
//
// Body: { name, email, use_intent, company_name?, company_size?,
//         what_for, tech_comfort?, heard_from?, consent_contact,
//         bot_field?, source? }
//
// On success: inserts into public.interest_signups (service-role) and
// (best-effort) sends a notification email to dtselenc@gmail.com via
// Resend if RESEND_API_KEY is configured. Notification failure does not
// fail the submission — the row is the source of truth.

import {
  admin, json, handlePreflight, clamp, classifyUA,
  clientIP, checkRateLimit
} from './_shared.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const NOTIFY_TO = process.env.INTEREST_NOTIFY_TO || 'dtselenc@gmail.com';
const NOTIFY_FROM = process.env.INTEREST_NOTIFY_FROM || 'interest@yepgent.com';

const USE_INTENTS = new Set(['personal', 'company', 'both']);
const COMPANY_SIZES = new Set(['solo', '2-10', '11-50', '51-200', '200+']);
const TECH_COMFORTS = new Set(['low', 'medium', 'high']);

export default async (req, _context) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });

  const ip = clientIP(req);
  if (checkRateLimit(`interest:${ip}`)) {
    return json({ error: 'rate_limited' }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 });
  }

  // Honeypot — same pattern as /api/subscribe. Return success shape so
  // bots don't retry, but never persist.
  const botField = (body?.bot_field || '').trim();
  if (botField) {
    console.warn('[interest] honeypot tripped, dropping submission');
    return json({ ok: true });
  }

  // Required: name, email, use_intent, what_for, consent_contact.
  const name = clamp((body?.name || '').trim(), 200);
  const email = clamp((body?.email || '').trim(), 320);
  const use_intent = clamp((body?.use_intent || '').trim(), 16);
  const what_for = clamp((body?.what_for || '').trim(), 500);
  const consent_contact = body?.consent_contact === true || body?.consent_contact === 'true' || body?.consent_contact === 'on';

  if (!name) return json({ error: 'invalid_name' }, { status: 400 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'invalid_email' }, { status: 400 });
  }
  if (!USE_INTENTS.has(use_intent)) return json({ error: 'invalid_use_intent' }, { status: 400 });
  if (!what_for) return json({ error: 'invalid_what_for' }, { status: 400 });
  if (!consent_contact) return json({ error: 'consent_required' }, { status: 400 });

  // Optional fields.
  const company_name_raw = clamp((body?.company_name || '').trim(), 200);
  const company_size_raw = clamp((body?.company_size || '').trim(), 16);
  const tech_comfort_raw = clamp((body?.tech_comfort || '').trim(), 16);
  const heard_from_raw = clamp((body?.heard_from || '').trim(), 200);

  const company_name = company_name_raw || null;
  const company_size = company_size_raw && COMPANY_SIZES.has(company_size_raw) ? company_size_raw : null;
  const tech_comfort = tech_comfort_raw && TECH_COMFORTS.has(tech_comfort_raw) ? tech_comfort_raw : null;
  const heard_from = heard_from_raw || null;

  const source = clamp((body?.source || 'yepgent.com/interest').trim(), 64);

  const ua = req.headers.get('user-agent') || '';
  const ua_class = classifyUA(ua, null);
  const metadata = {
    user_agent: clamp(ua, 512),
    ua_class,
    ip_hint: ip,
    submitted_via: 'api'
  };

  const insert = {
    name,
    email,
    email_lower: email.toLowerCase(),
    use_intent,
    company_name,
    company_size,
    what_for,
    tech_comfort,
    heard_from,
    consent_contact: true,
    source,
    metadata
  };

  const { data: inserted, error: insertErr } = await admin
    .from('interest_signups')
    .insert(insert)
    .select('id, created_at')
    .single();

  if (insertErr) {
    console.error('[interest] insert failed:', insertErr);
    return json({ error: 'storage_error' }, { status: 500 });
  }

  // Best-effort notification — never fails the submission.
  notifyByEmail({
    id: inserted?.id,
    name, email, use_intent, company_name, company_size,
    what_for, tech_comfort, heard_from, source
  }).catch((err) => {
    console.warn('[interest] notify failed:', err?.message || err);
  });

  return json({ ok: true });
};

async function notifyByEmail(row) {
  if (!RESEND_API_KEY) {
    console.log('[interest] RESEND_API_KEY not set — skipping notification');
    return;
  }
  const subject = `[yepgent.com] interest signup — ${row.name} (${row.use_intent})`;
  const lines = [
    `New /interest signup at ${new Date().toISOString()}.`,
    '',
    `id:            ${row.id}`,
    `name:          ${row.name}`,
    `email:         ${row.email}`,
    `use_intent:    ${row.use_intent}`,
    `company_name:  ${row.company_name || '-'}`,
    `company_size:  ${row.company_size || '-'}`,
    `tech_comfort:  ${row.tech_comfort || '-'}`,
    `heard_from:    ${row.heard_from || '-'}`,
    `source:        ${row.source}`,
    '',
    'what_for:',
    row.what_for,
    '',
    '— yepgent.com'
  ];
  const text = lines.join('\n');

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${RESEND_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: `yepgent <${NOTIFY_FROM}>`,
      to: [NOTIFY_TO],
      reply_to: row.email,
      subject,
      text
    })
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error(`resend ${r.status}: ${detail.slice(0, 240)}`);
  }
}

export const config = { path: '/api/interest' };
