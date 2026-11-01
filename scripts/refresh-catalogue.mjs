// Refresh the project facts in catalogue.json that GitHub and PyPI already know.
//
//   node scripts/refresh-catalogue.mjs             update catalogue.json
//   node scripts/refresh-catalogue.mjs --dry-run   print the changes, write nothing
//   node scripts/refresh-catalogue.mjs --compare   also say whether the result
//                                                  differs from the live catalogue
//
// catalogue.json decides WHAT the site lists: adding or removing an entry is
// still a PR. For each project with a `repo`, this script fills in:
//
//   version, released   the newest release: GitHub's latest release, and PyPI
//                       when `install` is `pip install <name>`
//   pushed              the day of the last push to the repo (GitHub pushed_at)
//
// The newest date wins among what the lookups return and what catalogue.json
// already says, so a hand-typed value is only ever replaced by a later one. A
// lookup that fails (network, rate limit, 5xx) falls back to the live site's
// catalogue, so a GitHub outage on deploy day does not put the older committed
// values back on the site. A repo that is gone or private keeps its committed
// values and prints a warning. Games and experiments are not touched.
//
// deploy.yml runs this before build:pages on every push to main and once a
// day; the daily run deploys only when --compare reports a change. Failed
// lookups never make it exit non-zero. An unreadable catalogue.json does.
//
// No dependencies: Node 20+ (global fetch).

import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'catalogue.json');
const LIVE = 'https://yepgent.com/catalogue.json';
const TIMEOUT_MS = 15000;

const warn = (msg) => console.warn(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `warning: ${msg}`);

// ── lookups ──────────────────────────────────────────────────────────────
// Each returns { status: 'ok', data } | { status: 'none' } (404) | { status: 'failed', why }.
async function getJson(url, headers = {}) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'yepgent-site refresh-catalogue', ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (r.status === 404) return { status: 'none' };
    if (!r.ok) return { status: 'failed', why: `HTTP ${r.status}` };
    return { status: 'ok', data: await r.json() };
  } catch (e) {
    return { status: 'failed', why: e.name === 'TimeoutError' ? 'timed out' : e.message };
  }
}

const day = (iso) => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : null);

// "v2.161.0" -> "2.161.0". A tag that doesn't look like a version is ignored.
export function versionFromTag(tag) {
  const v = String(tag ?? '').replace(/^v/i, '');
  return /^\d+(\.\d+)*([-+.][0-9A-Za-z.-]+)?$/.test(v) ? v : null;
}

async function github(repo, token) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const info = await getJson(`https://api.github.com/repos/${repo}`, headers);
  if (info.status !== 'ok') return { from: 'github', ...info, missing: info.status === 'none' };
  const out = { from: 'github', status: 'ok', pushed: day(info.data.pushed_at) };
  const rel = await getJson(`https://api.github.com/repos/${repo}/releases/latest`, headers);
  if (rel.status === 'failed') return { from: 'github', status: 'failed', why: `latest release: ${rel.why}` };
  if (rel.status === 'ok') {
    const version = versionFromTag(rel.data.tag_name);
    if (version) out.release = { version, released: day(rel.data.published_at) };
    else warn(`${repo}: latest release tag "${rel.data.tag_name}" is not a version; ignored`);
  }
  return out;
}

async function pypi(name) {
  const r = await getJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
  if (r.status !== 'ok') return { from: 'pypi', ...r };
  const version = r.data.info?.version;
  const files = r.data.releases?.[version] || [];
  const released = day(files[0]?.upload_time_iso_8601);
  return { from: 'pypi', status: 'ok', ...(version && released ? { release: { version, released } } : {}) };
}

export function pipName(install) {
  const m = String(install ?? '').match(/^pip install ([A-Za-z0-9._-]+)$/);
  return m ? m[1] : null;
}

// ── merge ────────────────────────────────────────────────────────────────
// Newest date wins; on a tie the earlier candidate in the list wins, so the
// order below is also the preference order: lookups, then the live site,
// then catalogue.json.
function newest(cands, key) {
  let best = null;
  for (const c of cands) if (c[key] && (!best || c[key] > best[key])) best = c;
  return best;
}

export function mergeProject(p, sources, live) {
  const anyFailed = sources.some((s) => s.status === 'failed');
  const fromLive = anyFailed && live ? [{ ...pickFacts(live), from: 'live site' }] : [];
  const committed = { ...pickFacts(p), from: 'catalogue.json' };
  const ok = sources.filter((s) => s.status === 'ok');
  const rel = newest([...ok.filter((s) => s.release).map((s) => ({ ...s.release, from: s.from })), ...fromLive, committed].filter((c) => c.version), 'released');
  const push = newest([...ok.map((s) => ({ pushed: s.pushed, from: s.from })), ...fromLive, committed], 'pushed');
  return {
    version: rel ? rel.version : p.version ?? null,
    released: rel ? rel.released : p.released ?? null,
    pushed: push ? push.pushed : p.pushed ?? null,
    from: { release: rel?.from ?? 'catalogue.json', pushed: push?.from ?? 'catalogue.json' },
  };
}

const pickFacts = (e) => ({ version: e.version ?? null, released: e.released ?? null, pushed: e.pushed ?? null });

// Put `pushed` right after `released` the first time it is added, so the
// entry keeps reading in the same order.
function withFacts(p, f) {
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === 'pushed') continue;
    out[k] = k === 'version' ? f.version : k === 'released' ? f.released : v;
    if (k === 'released') out.pushed = f.pushed;
  }
  if (!('pushed' in out)) out.pushed = f.pushed;
  return out;
}

export async function refresh(cat, { token, live } = {}) {
  const liveById = new Map((live?.projects || []).map((p) => [p.id, p]));
  const results = await Promise.all(cat.projects.map(async (p) => {
    if (!p.repo) return { entry: p, changes: [] };
    const sources = [await github(p.repo, token)];
    const pip = pipName(p.install);
    if (pip) sources.push(await pypi(pip));
    for (const s of sources) {
      if (s.status === 'failed') warn(`${p.id}: ${s.from} lookup failed (${s.why}); falling back to ${liveById.has(p.id) ? 'the live site and ' : ''}catalogue.json`);
      if (s.missing) warn(`${p.id}: github.com/${p.repo} not found (deleted, renamed or private); keeping the committed values`);
    }
    const f = mergeProject(p, sources, liveById.get(p.id));
    const changes = ['version', 'released', 'pushed']
      .filter((k) => (p[k] ?? null) !== f[k])
      .map((k) => `${p.id}: ${k} ${p[k] ?? 'none'} -> ${f[k] ?? 'none'} (${k === 'pushed' ? f.from.pushed : f.from.release})`);
    return { entry: withFacts(p, f), changes };
  }));
  const projects = results.map((r) => r.entry);
  const changes = results.flatMap((r) => r.changes);
  const latest = projects.map((p) => p.released).filter(Boolean).sort().pop();
  const updated = latest && latest > cat.updated ? latest : cat.updated;
  if (updated !== cat.updated) changes.push(`updated ${cat.updated} -> ${updated}`);
  return { cat: { ...cat, updated, projects }, changes };
}

// ── output ───────────────────────────────────────────────────────────────
// Two-space JSON, with any array or object that fits on one line (140
// columns) kept on one line, the way catalogue.json is written by hand.
const WIDTH = 140;
const inline = (v) => (Array.isArray(v) ? `[${v.map(inline).join(', ')}]`
  : v && typeof v === 'object' ? (Object.keys(v).length ? `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }` : '{}')
  : JSON.stringify(v));

function fmt(v, indent = '', used = 0) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  const one = inline(v);
  if (indent.length + used + one.length + 1 <= WIDTH) return one;
  const pad = indent + '  ';
  if (Array.isArray(v)) return `[\n${v.map((x) => pad + fmt(x, pad)).join(',\n')}\n${indent}]`;
  return `{\n${Object.entries(v).map(([k, x]) => { const key = `${JSON.stringify(k)}: `; return pad + key + fmt(x, pad, key.length); }).join(',\n')}\n${indent}}`;
}
export const format = (cat) => fmt(cat) + '\n';

// Key order doesn't matter when comparing with the live file.
const stable = (v) => (Array.isArray(v) ? `[${v.map(stable).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
  : JSON.stringify(v));

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  const compare = args.includes('--compare');
  const cat = JSON.parse(await readFile(FILE, 'utf8'));
  const liveRes = await getJson(LIVE);
  if (liveRes.status !== 'ok') warn(`could not read ${LIVE} (${liveRes.why || 'not found'}); no live fallback`);
  const live = liveRes.status === 'ok' ? liveRes.data : null;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

  const { cat: next, changes } = await refresh(cat, { token, live });
  console.log(changes.length ? `catalogue.json:\n  ${changes.join('\n  ')}` : 'catalogue.json: no changes');
  if (!dry) await writeFile(FILE, format(next), 'utf8');

  if (compare) {
    const changed = !live || stable(live) !== stable(next);
    console.log(`differs from ${LIVE}: ${changed}`);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
