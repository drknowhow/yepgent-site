// /account -- "Science / Anima" panel: your searches + validation feedback.
// Uses the shared yepgent Supabase session; talks to the Anima API on Cloud Run.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4?bundle';
import { makeCookieStorage, SHARED_STORAGE_KEY } from './cookie_storage.js';

const ANIMA_API = 'https://anima-screen-312853893256.us-central1.run.app';
const cfg = window.YEPGENT_CONFIG;

if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey && cfg.supabaseAnonKey !== 'REPLACE_AT_DEPLOY_TIME') {
  const root = document.getElementById('anima-history');
  if (root) {
    const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: {
        storage: makeCookieStorage(cfg.cookieDomain || '.yepgent.com'),
        storageKey: SHARED_STORAGE_KEY,
        persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
      },
    });
    injectStyles();
    run(sb, root);
  }
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (p) => (p == null ? '-' : Math.round(p * 100) + '%');
const badge = (r) => (r === 'HIGH' ? 'ah-high' : r === 'LOW' ? 'ah-low' : 'ah-mod');
const tok = async (sb) => { const { data } = await sb.auth.getSession(); return data.session && data.session.access_token; };

async function run(sb, root) {
  root.innerHTML = '<div class="ah-empty">Loading your searches...</div>';
  const t = await tok(sb);
  if (!t) { root.innerHTML = '<div class="ah-empty">Sign in to see your Anima searches.</div>'; return; }
  let data;
  try {
    const res = await fetch(ANIMA_API + '/api/my/history', { headers: { Authorization: 'Bearer ' + t } });
    data = await res.json();
  } catch (_e) { root.innerHTML = '<div class="ah-empty">Could not load your history right now.</div>'; return; }
  const searches = (data && data.searches) || [];
  if (!searches.length) {
    root.innerHTML = '<div class="ah-empty">No searches yet. <a href="https://science.yepgent.com/anima/">Run the Screen &rarr;</a></div>';
    return;
  }
  root.innerHTML = searches.map(rowHtml).join('');

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('.ah-fb-btn');
    if (!b) return;
    const box = b.closest('.ah-fb');
    const q = (sel) => box.querySelector(sel);
    const payload = {
      smiles: box.getAttribute('data-canon'),
      endpoint: q('.ah-ep').value,
      verdict: q('.ah-verdict').value,
      observed: q('.ah-obs').value.trim(),
      notes: q('.ah-notes').value.trim(),
      source: q('.ah-src').value.trim(),
    };
    const msg = q('.ah-msg');
    if (!payload.verdict && !payload.observed && !payload.notes) { msg.textContent = 'Add a verdict, a value, or a note.'; return; }
    const t2 = await tok(sb);
    if (!t2) { msg.textContent = 'Session expired - reload.'; return; }
    b.disabled = true; msg.textContent = 'Saving...';
    try {
      const res = await fetch(ANIMA_API + '/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t2 },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { msg.textContent = j.error || ('Error ' + res.status); b.disabled = false; return; }
      msg.textContent = 'Thanks - saved to the validation set.';
      q('.ah-obs').value = ''; q('.ah-notes').value = ''; q('.ah-src').value = '';
    } catch (_e) { msg.textContent = 'Network error - try again.'; b.disabled = false; }
  });
}

function rowHtml(s) {
  const name = (s.metadata && s.metadata.label) ? s.metadata.label : s.canonical;
  const c = s.cardiotox || {}, l = s.liver_dili || {};
  const fb = (s.feedback || []).map((f) => `<span class="ah-tag">${esc(f.endpoint)}: ${esc(f.verdict || 'noted')}</span>`).join(' ');
  return `<div class="ah-row">
    <div class="ah-top"><span class="ah-name" title="${esc(s.canonical)}">${esc(name)}</span><span class="ah-date">${esc((s.at || '').slice(0, 10))}</span></div>
    <div class="ah-pred"><span class="ah-p ${badge(c.risk)}">hERG ${esc(c.risk || '-')} ${pct(c.probability)}</span><span class="ah-p ${badge(l.risk)}">DILI ${esc(l.risk || '-')} ${pct(l.probability)}</span></div>
    ${fb ? `<div class="ah-fbs">Your validation: ${fb}</div>` : ''}
    <details class="ah-fb" data-canon="${esc(s.canonical)}">
      <summary>Validate / add data</summary>
      <div class="ah-fb-grid">
        <div class="ah-two">
          <select class="ah-ep"><option value="liver_dili">DILI (liver)</option><option value="cardiotox">hERG (cardiac)</option><option value="general">General</option></select>
          <select class="ah-verdict"><option value="">Verdict...</option><option value="confirmed">Confirmed</option><option value="disputed">Disputed</option><option value="uncertain">Uncertain</option></select>
        </div>
        <input class="ah-obs" type="text" placeholder="Observed value / label (e.g. IC50 2 uM, known blocker)">
        <input class="ah-src" type="text" placeholder="Source (paper DOI, assay...)">
        <textarea class="ah-notes" rows="2" placeholder="Notes"></textarea>
        <div class="ah-row2"><button type="button" class="cta primary av4-btn ah-fb-btn">Submit</button><span class="ah-msg"></span></div>
      </div>
    </details>
  </div>`;
}

function injectStyles() {
  const css = `
    .anima-history .ah-empty{color:#6f7f75;font-size:14px;padding:6px 0}
    .ah-row{border-top:1px solid #eef2ef;padding:14px 0}.ah-row:first-child{border-top:0}
    .ah-top{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
    .ah-name{font-weight:650}.ah-date{font-family:ui-monospace,monospace;font-size:12px;color:#8a9a90}
    .ah-pred{display:flex;gap:10px;margin-top:8px;flex-wrap:wrap}
    .ah-p{font-family:ui-monospace,monospace;font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid #e5ebe7}
    .ah-high{color:#d6432f;background:rgba(214,67,47,.08)}.ah-low{color:#0a7a43;background:rgba(18,161,80,.09)}.ah-mod{color:#b26b00;background:rgba(210,153,34,.1)}
    .ah-fbs{margin-top:8px;font-size:12.5px;color:#48584f}
    .ah-tag{font-family:ui-monospace,monospace;font-size:11px;background:#eef2ef;padding:2px 8px;border-radius:999px}
    .ah-fb{margin-top:10px}.ah-fb summary{cursor:pointer;color:#0a7a43;font-weight:600;font-size:13px;width:fit-content}
    .ah-fb-grid{display:grid;gap:8px;margin-top:12px;max-width:540px}
    .ah-two{display:flex;gap:8px;flex-wrap:wrap}.ah-two select{flex:1;min-width:150px}
    .ah-fb-grid select,.ah-fb-grid input,.ah-fb-grid textarea{border:1px solid #e5ebe7;border-radius:8px;padding:9px 11px;font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;background:#fff;color:#0c1611}
    .ah-row2{display:flex;align-items:center;gap:12px}.ah-msg{font-size:12.5px;color:#48584f}
  `;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
}
