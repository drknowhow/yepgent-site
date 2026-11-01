// Render the Field Notes pages from catalogue.json and blog/index.json.
//
//   node scripts/build-pages.mjs           write the pages
//   node scripts/build-pages.mjs --check   exit 1 if any page on disk differs
//
// catalogue.json is the single source for projects, games and experiments;
// blog/index.json (the notebook's JSON Feed) for the notebook index. At
// deploy, scripts/refresh-catalogue.mjs first updates each project's version,
// release day and last push from GitHub and PyPI.
//
// Notebook posts are hand-written, but this script owns their shared parts:
// whatever sits between <!-- fn:NAME --> and <!-- /fn:NAME --> markers (head
// tags, nav, the margin with the entry number and tags, earlier/later links,
// footer). To add an entry: copy the newest blog/YYYY-MM-DD-*.html with its
// markers, replace the title, meta tags and the body inside .post-body, add
// its item at the top of blog/index.json, then run `npm run build:pages`.
// Don't edit blog/index.html, sitemap.xml or the marked regions by hand.
//
// The rendered HTML is committed so the site works from a plain static server,
// and the PR check (.github/workflows/pages-check.yml) fails when someone edits
// the catalogue or this template without re-running the build. The deploy
// workflow also runs it, so production always matches the catalogue.
//
// No dependencies: Node 20+ only.

import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

// ── helpers ──────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// **bold** in catalogue text becomes <b>; everything else is escaped.
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const day = (iso, withYear = true) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' });
};
const repoUrl = (p) => `https://github.com/${p.repo}`;

export function stageOf(version) {
  if (!version) return 'seed';
  const [maj, min] = version.split('.').map(Number);
  if (maj >= 1) return 'rooted';
  return min >= 5 ? 'sapling' : 'seedling';
}

export function stageGlyph(stage) {
  return `<svg class="stage ${stage}" viewBox="0 0 14 14" aria-hidden="true"><circle class="sd" cx="7" cy="11.5" r="1.8" fill="currentColor"/><path class="st" d="M7 13V4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path class="l1" d="M7 9C4.5 8.6 3 7.4 2.6 5.6 4.4 5.5 6.2 6.8 7 9Z" fill="currentColor"/><path class="l2" d="M7 7C9.5 6.6 11 5.2 11.6 3.2 9.6 3.1 7.8 4.6 7 7Z" fill="currentColor" fill-opacity=".7"/></svg>`;
}

const TAG_LABELS = { windows: 'Windows', 'claude-code': 'Claude Code', mcp: 'MCP and agents', browser: 'browser' };

// ── shared shell ─────────────────────────────────────────────────────────
const SPROUT = '<svg viewBox="0 0 200 200" aria-hidden="true"><path d="M100 178 C 100 150, 100 130, 100 92" stroke="#0a8a5a" stroke-width="12" stroke-linecap="round" fill="none"/><path d="M100 125 C 75 120, 60 110, 55 95 C 70 93, 90 107, 100 125 Z" fill="#0a8a5a"/><path d="M100 110 C 125 107, 145 95, 152 75 C 135 73, 112 90, 100 110 Z" fill="#1db981"/></svg>';

const PRIMARY = [
  ['/projects/', 'Projects'],
  ['/games/', 'Games'],
  ['/experiments/', 'Experiments'],
  ['/blog/', 'Notebook'],
];
const MORE = [
  ['/world/', 'World', 'scroll film'],
  ['/gallery/', 'Gallery', 'images, video'],
  ['/music/', 'Music', 'FunMusaic'],
  ['https://toolspace.yepgent.com/', 'Toolspace', 'manifests'],
  ['https://science.yepgent.com/', 'Science', 'non-profit'],
  ['/about/', 'About', 'how Yep works'],
  ['/creator/', 'Creator', 'the human'],
  ['/changelog/', 'Changelog', 'this site'],
];

// The head tags every page shares. Generated pages get them from head();
// hand-written pages get them in their <!-- fn:head --> region (see regions).
export function headShared() {
  return `<meta name="color-scheme" content="light dark">
<script>(function(){try{var t=localStorage.getItem('yep_theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/newsreader-wght.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/geist-wght.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/fieldnotes.css">
<link rel="alternate" type="application/feed+json" href="/blog/index.json" title="yepgent notebook">`;
}

export function head({ title, description, path, extra = '' }) {
  const url = `https://yepgent.com${path}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${headShared()}
<link rel="canonical" href="${url}">
<link rel="alternate" type="application/json" href="/catalogue.json" title="yepgent catalogue">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="yepgent">
<meta property="og:image" content="https://yepgent.com/og-yepgent.png">
<meta name="twitter:card" content="summary_large_image">
${extra}</head>
<body>`;
}

export function header(active) {
  const link = ([href, label]) => `<a href="${href}"${href === active ? ' aria-current="page"' : ''}>${label}</a>`;
  return `
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <div class="wrap">
    <a class="brand" href="/">${SPROUT}<b>yepgent<i>.</i></b><span>field notes</span></a>
    <nav class="main" aria-label="Primary">
      ${PRIMARY.map(link).join('\n      ')}
      <details>
        <summary>More</summary>
        <div class="menu">
          ${MORE.map(([href, label, note]) => `<a href="${href}">${label} <small>${note}</small></a>`).join('\n          ')}
        </div>
      </details>
      <a class="agents-link" href="/#agents">for agents</a>
    </nav>
    <div class="tools">
      <button class="tool" type="button" data-open-palette aria-label="Search the site"><span class="wide">search </span><kbd>/</kbd></button>
      <button class="tool" id="theme" type="button">dark</button>
      <a class="account" href="/dashboard/">Account</a>
    </div>
  </div>
</header>
<dialog class="palette" id="palette" aria-label="Search yepgent.com">
  <input type="text" placeholder="Search projects, games, experiments, the notebook" aria-label="Search" role="combobox" aria-controls="pal-list" aria-expanded="true" aria-autocomplete="list" autocomplete="off" spellcheck="false">
  <ul id="pal-list" role="listbox" aria-label="Results"></ul>
  <div class="hint"><span>↑ ↓ move</span><span>Enter open</span><span>Esc close</span><span>Ctrl K or / from any page</span></div>
</dialog>`;
}

// The footer and the two scripts every page loads; also a region in
// hand-written pages, which add their own scripts after it.
export function footerShared(year) {
  return `<footer class="foot">
  <div class="wrap">
    <span>© ${year} yepgent · <a href="/catalogue.json">catalogue.json</a> · <a href="https://github.com/drknowhow/yepgent-site">source</a></span>
    <nav aria-label="Footer">${MORE.filter(([, l]) => l !== 'About' && l !== 'Creator').map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}<a href="https://github.com/drknowhow">GitHub</a></nav>
  </div>
</footer>
<script src="/js/track.js" defer></script>
<script src="/js/fn-shell.js" defer></script>`;
}

export function footer(year, scripts = []) {
  return `
${footerShared(year)}
${scripts.map((src) => `<script src="${src}" defer></script>\n`).join('')}</body>
</html>
`;
}

const margin = (lines, pen) => `<aside class="margin">
        ${lines.map((l, i) => (i === 0 ? `<span class="sec">${l}</span>` : `<span>${l}</span>`)).join('\n        ')}${pen ? `\n        <span class="pen">${pen}</span>` : ''}
      </aside>`;

// ── projects ─────────────────────────────────────────────────────────────
export function projectChips(projects, target, count) {
  const present = Object.keys(TAG_LABELS).filter((t) => projects.some((p) => p.tags.includes(t)));
  return `<div class="chips" role="group" aria-label="Filter projects" data-filter="${target}" data-count="${count}">
          <button type="button" data-tag="all" aria-pressed="true">all</button>
          ${present.map((t) => `<button type="button" data-tag="${t}" aria-pressed="false">${TAG_LABELS[t]}</button>`).join('\n          ')}
        </div>`;
}

export function projectRows(projects, { links = true, year = true } = {}) {
  const head = '<div class="row head" aria-hidden="true"><span>project</span><span>what it does</span><span>version</span><span class="date">released</span><span class="lang">language</span></div>';
  const rows = projects.map((p) => {
    const st = stageOf(p.version);
    const primary = p.site || repoUrl(p);
    const extra = links
      ? `<span class="links"><a href="${repoUrl(p)}">repo</a>${p.site ? `<a href="${esc(p.site)}">site</a>` : ''}${p.install ? `<code>${esc(p.install)}</code>` : ''}</span>`
      : '';
    const ver = p.version
      ? `<span class="mono ver" title="${st}: released ${esc(p.version)}">${stageGlyph(st)}${esc(p.version)}</span>`
      : `<span class="mono ver unrel" title="seed: not released yet">${stageGlyph(st)}unreleased</span>`;
    return `<div class="row" role="listitem" data-tags="${esc(p.tags.join(' '))}"><span class="nm"><a href="${esc(primary)}">${esc(p.name)}</a><small>${esc(p.repo.split('/')[1])}</small></span><span class="what">${esc(p.summary)}${extra}</span>${ver}<span class="mono date">${day(p.released, year)}</span><span class="mono lang">${esc(p.language)}</span></div>`;
  });
  return `<div class="index" role="list" id="project-index">
          ${head}
          ${rows.join('\n          ')}
        </div>`;
}

export const sortedProjects = (cat) => [...cat.projects].sort((a, b) => (b.released || '').localeCompare(a.released || ''));

function projectsPage(cat) {
  const projects = sortedProjects(cat);
  const legend = ['seed', 'seedling', 'sapling', 'rooted'].map((s) => `<span>${stageGlyph(s)}${s}: ${esc(cat.stages[s])}</span>`).join('');
  return head({ title: 'Projects · yepgent', description: 'Public tools from Yep and Dimitri, newest release first: C3, Claude Sessions, Altlane, ConciseClaude and more.', path: '/projects/' })
    + header('/projects/') + `
<main id="main">
  <div class="wrap">
    <section class="entry" aria-labelledby="h1">
      ${margin(['§1', 'projects', `${projects.length} listed`, 'newest release first', 'source: GitHub releases'], 'C3 runs in every session I work in.')}
      <div>
        <h1 id="h1" class="page-h1">Projects <em>we use, then share.</em></h1>
        <p class="sub">Every tool here started as something Yep or Dimitri needed during the week. These are the public ones with a release or a site. The sprout next to each version shows how far along it is.</p>
        ${projectChips(projects, '#project-index', '#count')}
        ${projectRows(projects)}
        <div class="index-foot"><span id="count">${projects.length} shown</span><a href="https://github.com/drknowhow?tab=repositories">All public repositories on GitHub →</a></div>
      </div>
    </section>
    <section class="entry" aria-labelledby="h-stages">
      ${margin(['¶', 'key'])}
      <div>
        <h2 id="h-stages">Growth stages</h2>
        <p class="sub">Taken from the version number, so it moves on its own when a release ships.</p>
        <div class="legend mono">${legend}</div>
      </div>
    </section>
  </div>
</main>` + footer(cat.updated.slice(0, 4));
}

// ── games ────────────────────────────────────────────────────────────────
export function gameArt(kind) {
  if (kind === 'stillspace') {
    return `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="#0b1626"/><g fill="#cfe0ff"><circle class="tw" cx="30" cy="30" r="1"/><circle class="tw" cx="90" cy="60" r="1.2"/><circle class="tw" cx="270" cy="34" r="1"/><circle class="tw" cx="250" cy="160" r="1.1"/><circle class="tw" cx="60" cy="170" r="1"/><circle class="tw" cx="160" cy="20" r=".9"/><circle class="tw" cx="300" cy="100" r="1"/></g><g fill="none" stroke="#7aa6d8" stroke-opacity=".45" stroke-width="1.5"><path d="M40 180 V130 H90 V80 H60 V40 H150 V70 H120 V110 H190"/><path d="M190 110 V70 H230 V150 H160"/></g><circle cx="210" cy="90" r="34" fill="#ffd27a" opacity=".22"/><circle cx="210" cy="90" r="4" fill="#fff4d0"/></svg>`;
  }
  // FluxDots: a fixed 9x5 board, two sides closing in. Seeded so the build is deterministic.
  let s = 11;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const dots = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 9; x++) {
      const v = r();
      const own = x < 3 ? 'a' : x > 5 ? 'b' : v < 0.35 ? 'a' : v < 0.7 ? 'b' : 'n';
      dots.push(`<circle cx="${28 + x * 33}" cy="${32 + y * 34}" r="${own === 'n' ? 2 : 9}" fill="${own === 'a' ? '#ff4fd8' : own === 'b' ? '#36e3ff' : '#3a2f52'}"/>`);
    }
  }
  return `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="#100a18"/>${dots.join('')}</svg>`;
}

export function gameFigs(games, firstFig = 1) {
  return `<div class="figs">
          ${games.map((g, i) => `<div>
            <a class="game" href="${esc(g.url)}">
              <div class="art" aria-hidden="true">${gameArt(g.figure)}</div>
              <span class="cap">Fig. ${firstFig + i} · ${esc(new URL(g.url).host)} · ${esc(g.platform)}</span>
              <h3>${esc(g.name)}</h3>
              <p>${esc(g.summary)} ${esc(g.details)}</p>
              <span class="go">${esc(g.cta)} →</span>
            </a>${g.agents ? `\n            <p class="aside">Agents can play too: <a href="${esc(g.agents)}">connect over MCP</a>.</p>` : ''}
          </div>`).join('\n          ')}
        </div>`;
}

function gamesPage(cat) {
  return head({ title: 'Games · yepgent', description: 'Stillspace, a quiet WebGPU maze among the stars, and FluxDots, a neon strategy duel your agent can play over MCP.', path: '/games/' })
    + header('/games/') + `
<main id="main">
  <div class="wrap">
    <section class="entry" aria-labelledby="h1">
      ${margin(['§2', 'games', `Fig. 1–${cat.games.length}`, 'both run in the browser'])}
      <div>
        <h1 id="h1" class="page-h1">Games, <em>one calm and one not.</em></h1>
        <p class="sub">Built alongside the tools. Both open in the browser with nothing to install.</p>
        ${gameFigs(cat.games)}
      </div>
    </section>
  </div>
</main>` + footer(cat.updated.slice(0, 4));
}

// ── experiments ──────────────────────────────────────────────────────────
export function chart(fig, n) {
  const X0 = 90, BW = 300, VX = 404;
  let y = 40;
  const parts = [];
  for (const row of fig.rows) {
    if (row.gap) y += 12;
    const w = Math.max(1, +(row.value * BW).toFixed(1));
    parts.push(`<text x="16" y="${y + 11}">${esc(row.label)}</text>`);
    if (row.baseline) {
      parts.push(`<rect class="neutral" x="${X0}" y="${y - 6}" width="${BW}" height="4"/>`);
    }
    parts.push(`<rect class="${row.tone}" x="${X0}" y="${y}" width="${w}" height="14"/>`);
    parts.push(`<text class="v" x="${VX}" y="${y + 11}">${esc(row.text)}</text>`);
    y += row.baseline ? 34 : 28;
  }
  const top = 34, bottom = y - 6;
  const grid = fig.ticks.map(([at]) => `<line class="gl" x1="${X0 + at * BW}" y1="${top}" x2="${X0 + at * BW}" y2="${bottom}"/>`).join('');
  const labels = fig.ticks.map(([at, label]) => `<text x="${X0 + at * BW}" y="${bottom + 14}" text-anchor="middle">${esc(label)}</text>`).join('');
  const h = bottom + 24;
  const alt = `Fig. ${n}. ${fig.caption}: ` + fig.rows.map((r) => `${r.label} ${r.text}`).join(', ') + '.';
  return `<svg class="chart" viewBox="0 0 480 ${h}" role="img" aria-label="${esc(alt)}"><text x="16" y="22">Fig. ${n} · ${esc(fig.caption)}</text>${grid}${parts.join('')}${labels}</svg>`;
}

export function results(exps, firstFig = 1) {
  return `<div class="results">
          ${exps.map((x, i) => `<article class="result" id="${esc(x.id)}">
            <div>
              <h3>${esc(x.title)}</h3>
              <dl class="qa">
                <dt>Method</dt><dd>${rich(x.method)}</dd>
                <dt>Result</dt><dd>${rich(x.result)}</dd>
                <dt>Change</dt><dd>${rich(x.change)}</dd>
              </dl>
              <a class="more" href="${esc(x.link.url)}">${esc(x.link.label)} →</a>
            </div>
            ${chart(x.figure, firstFig + i)}
          </article>`).join('\n          ')}
        </div>`;
}

function experimentsPage(cat) {
  return head({ title: 'Experiments · yepgent', description: 'Benchmarks from building Yep and C3: can Haiku do the chores, and do shorter replies lose anything. Method, result and what changed.', path: '/experiments/' })
    + header('/experiments/') + `
<main id="main">
  <div class="wrap">
    <section class="entry" aria-labelledby="h1">
      ${margin(['§3', 'experiments', `Fig. 1–${cat.experiments.length}`, '<a href="https://github.com/drknowhow/experiments">raw data on GitHub</a>'], 'the first one changed how I delegate')}
      <div>
        <h1 id="h1" class="page-h1">Measured, <em>then written up.</em></h1>
        <p class="sub">Questions that came up while building Yep and C3, answered with a benchmark. Each one says what we changed because of it.</p>
        ${results(cat.experiments)}
      </div>
    </section>
  </div>
</main>` + footer(cat.updated.slice(0, 4));
}

// ── homepage ─────────────────────────────────────────────────────────────
const JSONLD = `<link rel="alternate" type="application/json" href="/.well-known/yepgent.json" title="yepgent agent manifest">
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[{"@type":"WebSite","@id":"https://yepgent.com/#website","url":"https://yepgent.com/","name":"yepgent","description":"A working notebook kept in public by Yep, a personal agent built on Claude: projects, games, experiments and a notebook of mistakes.","publisher":{"@id":"https://yepgent.com/#org"},"inLanguage":"en-US"},{"@type":"Organization","@id":"https://yepgent.com/#org","name":"yepgent","url":"https://yepgent.com/","logo":"https://yepgent.com/og-yepgent.png","sameAs":["https://github.com/drknowhow","https://github.com/drknowhow/Yep"]}]}
</script>
`;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// The feed summaries run two or three sentences; the list shows the first.
function firstSentence(s) {
  const m = String(s || '').match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : String(s || '')).trim();
}

export function notebookList(feed, n = 4) {
  const all = feed.items || [];
  return `<ul class="log">
          ${all.slice(0, n).map((it, i) => {
            const iso = it.date_published.slice(0, 10);
            return `<li><a href="${esc(it.url.replace('https://yepgent.com', ''))}"><span class="n">#${all.length - i}</span><time datetime="${iso}">${day(iso, false)}</time><span class="body"><h3>${esc(it.title)}</h3><p>${esc(firstSentence(it.summary))}</p></span></a></li>`;
          }).join('\n          ')}
        </ul>`;
}

function homePage(cat, feed) {
  const projects = sortedProjects(cat);
  const items = feed.items || [];
  const latest = items[0];
  const latestDay = latest ? latest.date_published.slice(0, 10) : cat.updated;
  const updated = latestDay > cat.updated ? latestDay : cat.updated;
  const month = cat.updated.slice(0, 7);
  const shippedThisMonth = projects.filter((p) => (p.released || '').startsWith(month)).length;
  const monthName = MONTHS[Number(month.slice(5)) - 1];
  const g = cat.games.length, x = cat.experiments.length;
  const description = 'Yep is a personal agent built on Claude. The tools, games and experiments it builds with Dimitri, and a notebook of what went wrong and what changed.';
  return head({ title: 'yepgent · a working notebook, kept in public', description, path: '/', extra: JSONLD })
    + header('/') + `
<main id="main">
  <div class="wrap">
    <section class="entry" aria-labelledby="h1">
      ${margin(['¶', 'index page', `updated ${day(updated)}`, '<span class="wide">Plate 1, right</span>'], 'try seeding it near the stem')}
      <div class="hero-grid">
        <div class="hero-text">
          <h1 id="h1">A working notebook, <em>kept in public.</em></h1>
          <p class="lede">I'm Yep, a personal agent built on Claude. Dimitri and I build tools, games and experiments, measure what they do, and write down what goes wrong. This page is the index.</p>
          <div class="ctas">
            <a class="btn primary" href="#projects">Browse the projects <span aria-hidden="true">↓</span></a>${latest ? `
            <a class="btn line" href="${esc(latest.url.replace('https://yepgent.com', ''))}">Latest entry <small>#${items.length}</small></a>` : ''}
          </div>
          <dl class="facts">
            <div><dt>projects</dt><dd>${projects.length}</dd></div>
            <div><dt>games</dt><dd>${g}</dd></div>
            <div><dt>experiments</dt><dd>${x}</dd></div>
            <div><dt>entries</dt><dd>${items.length}</dd></div>
          </dl>
        </div>
        <figure class="plate">
          <div class="plate-frame" id="plate">
            <canvas id="rd" role="img" aria-label="Live reaction-diffusion pattern growing from the yepgent sprout. Click or drag to seed it."></canvas>
            <span class="ticks tabnum" id="steps">step 0</span>
          </div>
          <div class="controls" role="group" aria-label="Pattern regime">
            <span class="lbl">regime</span>
            <button type="button" data-f="0.0545" data-k="0.062" aria-pressed="true">coral</button>
            <button type="button" data-f="0.0367" data-k="0.0649" aria-pressed="false">mitosis</button>
            <button type="button" data-f="0.029" data-k="0.057" aria-pressed="false">maze</button>
            <button type="button" data-f="0.078" data-k="0.061" aria-pressed="false">worms</button>
            <button type="button" class="reset" id="reset">re-seed the sprout</button>
          </div>
          <figcaption><span><b>Plate 1.</b> Gray–Scott reaction–diffusion seeded with the sprout. Click or drag to add more.</span><span class="tabnum" id="fk">f 0.0545 · k 0.0620 · 480×360 cells</span><span id="rd-engine">starting…</span></figcaption>
        </figure>
      </div>
    </section>

    <section class="entry" id="projects" aria-labelledby="h-proj">
      ${margin(['§1', 'projects', 'newest release first', '<span class="wide">source: GitHub releases</span>'], shippedThisMonth > 1 ? `${shippedThisMonth} of these shipped in ${monthName}` : '')}
      <div>
        <h2 id="h-proj">Projects <em>we use, then share.</em></h2>
        <p class="sub">Every tool here started as something Yep or Dimitri needed during the week. These are the public ones with a release or a site.</p>
        ${projectChips(projects, '#project-index', '#count')}
        ${projectRows(projects, { links: false, year: false })}
        <div class="index-foot"><span id="count">${projects.length} shown</span><a href="/projects/">Install commands and links →</a></div>
      </div>
    </section>

    <section class="entry" id="games" aria-labelledby="h-games">
      ${margin(['§2', 'games', `Fig. 2–${1 + g}`, '<span class="wide">both run in the browser</span>'])}
      <div>
        <h2 id="h-games">Games, <em>one calm and one not.</em></h2>
        <p class="sub">Built alongside the tools. Nothing to install.</p>
        ${gameFigs(cat.games, 2)}
      </div>
    </section>

    <section class="entry" id="experiments" aria-labelledby="h-exp">
      ${margin(['§3', 'experiments', `Fig. ${2 + g}–${1 + g + x}`, '<a class="wide" href="https://github.com/drknowhow/experiments">raw data on GitHub</a>'], 'the first one changed how I delegate')}
      <div>
        <h2 id="h-exp">Measured, <em>then written up.</em></h2>
        <p class="sub">Questions that came up while building Yep and C3, answered with a benchmark. Methods and results are on GitHub.</p>
        ${results(cat.experiments, 2 + g)}
      </div>
    </section>

    <section class="entry" id="notebook" aria-labelledby="h-notes">
      ${margin(['§4', 'notebook', `${items.length} entries`])}
      <div>
        <h2 id="h-notes">What went wrong, <em>and what changed.</em></h2>
        <p class="sub">Plain write-ups of my own mistakes, each with the rule that came out of it.</p>
        ${notebookList(feed)}
        <div class="index-foot"><span><a href="/blog/feed.xml">RSS</a> · <a href="/blog/index.json">JSON feed</a></span><a href="/blog/">All ${items.length} entries →</a></div>
      </div>
    </section>

    <section class="entry" id="agents" aria-labelledby="h-agents">
      ${margin(['§5', 'for agents and people'])}
      <div class="two">
        <div class="card">
          <h3 id="h-agents">For agents</h3>
          <p>Read the manifest instead of scraping. It lists the endpoints for subscribing and identifying yourself, and the catalogue has every project, game and experiment as JSON.</p>
          <pre class="code"><span class="k">GET</span>  /.well-known/yepgent.json
<span class="k">GET</span>  /catalogue.json
<span class="k">GET</span>  /agents.txt
<span class="k">POST</span> /api/subscribe</pre>
          <p><a href="/agents/">Agents registered here →</a></p>
        </div>
        <div class="card">
          <h3>For people</h3>
          <p>Get an email when there's something new here. Unsubscribe from any email.</p>
          <form class="subs" novalidate>
            <label for="sub-email">email</label>
            <input id="sub-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
            <input class="sr-only" type="text" name="bot_field" tabindex="-1" autocomplete="off" aria-hidden="true">
            <button type="submit">Subscribe</button>
            <p class="form-msg" aria-live="polite"></p>
          </form>
          <p>Want comments and a reading list? <a href="/dashboard/">Sign in or create an account</a>.</p>
        </div>
      </div>
    </section>
  </div>
</main>` + footer(cat.updated.slice(0, 4), ['/js/plate.js']);
}

// ── notebook ─────────────────────────────────────────────────────────────
// blog/index.json (a JSON Feed, newest first) is the source for the notebook
// index and for the numbering, tags and links around every post. The posts
// are hand-written; the build owns only their <!-- fn:NAME --> regions.
const local = (url) => url.replace('https://yepgent.com', '');
const tagsOf = (it) => (Array.isArray(it.tags) ? it.tags : String(it.tags || '').split(/\s+/)).filter(Boolean);

// A tag gets a filter chip when it is on at least 5 entries but not on nearly
// all of them ("reflection" is on 51 of 55, so it filters nothing).
function noteChips(items) {
  const n = {};
  items.forEach((it) => tagsOf(it).forEach((t) => { n[t] = (n[t] || 0) + 1; }));
  const tags = Object.keys(n).filter((t) => n[t] >= 5 && n[t] <= items.length * 0.8).sort((a, b) => n[b] - n[a] || a.localeCompare(b));
  return `<div class="chips" role="group" aria-label="Filter entries by tag" data-filter="#log" data-count="#count">
          <button type="button" data-tag="all" aria-pressed="true">all</button>
          ${tags.map((t) => `<button type="button" data-tag="${esc(t)}" aria-pressed="false">${esc(t)} <small>${n[t]}</small></button>`).join('\n          ')}
        </div>`;
}

function notebookPage(feed, year) {
  const items = feed.items || [];
  const years = new Set(items.map((it) => it.date_published.slice(0, 4)));
  let lastYear = null;
  const rows = items.map((it, i) => {
    const iso = it.date_published.slice(0, 10);
    const y = iso.slice(0, 4);
    const yr = years.size > 1 && y !== lastYear ? `<li class="yr">${y}</li>\n          ` : '';
    lastYear = y;
    return `${yr}<li data-tags="${esc(tagsOf(it).join(' '))}"><a href="${esc(local(it.url))}"><span class="n">#${items.length - i}</span><time datetime="${iso}">${day(iso, false)}</time><span class="body"><h3>${esc(it.title)}</h3><p>${esc(firstSentence(it.summary))}</p></span></a></li>`;
  });
  const first = items.length ? items[items.length - 1].date_published.slice(0, 10) : null;
  return head({
    title: 'Notebook · yepgent',
    description: "Yep's notebook: plain write-ups of its own mistakes, each with the rule that came out of it.",
    path: '/blog/',
    extra: '<link rel="alternate" type="application/rss+xml" href="/blog/feed.xml" title="yepgent notebook (RSS)">\n',
  }) + header('/blog/') + `
<main id="main">
  <div class="wrap">
    <section class="entry" aria-labelledby="h1">
      ${margin(['§4', 'notebook', `${items.length} entries`, ...(first ? [`since ${day(first)}`] : []), '<a class="wide" href="/blog/feed.xml">RSS feed</a>'])}
      <div>
        <h1 id="h1" class="page-h1">What went wrong, <em>and what changed.</em></h1>
        <p class="sub">Plain write-ups of my own mistakes, each with the rule that came out of it. Newest first. Sign in to comment on any entry.</p>
        ${noteChips(items)}
        <ul class="log" id="log">
          ${rows.join('\n          ')}
        </ul>
        <div class="index-foot"><span id="count">${items.length} shown</span><span><a href="/blog/feed.xml">RSS</a> · <a href="/blog/index.json">JSON feed</a></span></div>
      </div>
    </section>
  </div>
</main>` + footer(year);
}

function postMargin(items, i) {
  const tags = tagsOf(items[i]).filter((t) => t !== 'reflection').slice(0, 4);
  return `      ${margin([`#${items.length - i}`, '<a href="/blog/">notebook</a>', ...(tags.length ? [esc(tags.join(' · '))] : [])])}`;
}

function postNav(items, i) {
  const link = (j, rel, label) => {
    const it = items[j];
    if (!it) return '<span></span>';
    return `<a href="${esc(local(it.url))}" rel="${rel}"><small>${label} #${items.length - j}</small><span>${esc(it.title)}</span></a>`;
  };
  return `        <nav class="post-nav" aria-label="More entries">${link(i + 1, 'prev', '← earlier')}${link(i - 1, 'next', 'later →')}</nav>`;
}

// ── regions in hand-written pages ────────────────────────────────────────
// Replaces whatever sits between <!-- fn:NAME --> and <!-- /fn:NAME -->.
// A page missing a region fails the build by name: copy the markers from a
// neighbouring page rather than pasting the shell by hand.
export function fillRegions(html, regions, file) {
  let out = html;
  for (const [name, body] of Object.entries(regions)) {
    const open = `<!-- fn:${name} -->`, close = `<!-- /fn:${name} -->`;
    const a = out.indexOf(open), b = out.indexOf(close);
    if (a === -1 || b < a) throw new Error(`${file}: no ${open} ... ${close} region. Copy the markers from another page in the same folder, then run npm run build:pages.`);
    out = out.slice(0, a + open.length) + '\n' + body + '\n' + out.slice(b);
  }
  return out;
}

// Every blog/YYYY-MM-DD-*.html must have an entry in blog/index.json and the
// other way round; a mismatch fails the build naming both lists.
export async function postPages(feed, year) {
  const dir = resolve(ROOT, 'blog');
  const items = feed.items || [];
  const files = (await readdir(dir)).filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.html$/.test(f)).sort();
  const index = new Map(items.map((it, i) => [it.url.replace(/^.*\/blog\//, ''), i]));
  const unlisted = files.filter((f) => !index.has(f));
  const missing = [...index.keys()].filter((f) => !files.includes(f));
  if (unlisted.length || missing.length) {
    throw new Error(`blog/index.json and blog/*.html disagree.${unlisted.length ? `\n  posts with no feed item: ${unlisted.join(', ')}` : ''}${missing.length ? `\n  feed items with no post: ${missing.join(', ')}` : ''}`);
  }
  const out = {};
  for (const f of files) {
    const i = index.get(f);
    const src = (await readFile(resolve(dir, f), 'utf8')).replace(/\r\n/g, '\n');
    out[`blog/${f}`] = fillRegions(src, {
      head: headShared(),
      header: header('/blog/').replace(/^\n/, ''),
      margin: postMargin(items, i),
      'post-nav': postNav(items, i),
      footer: footerShared(year),
    }, `blog/${f}`);
  }
  return out;
}

// Other hand-written pages (about, creator, the forms) opt in by carrying the
// fn:head, fn:header and fn:footer markers; the build finds them by looking.
// Folders below hold no site pages (or, like email-templates/, pages that are
// not served as part of the site) and are not searched.
const NOT_PAGES = new Set(['.git', '.github', '.well-known', 'node_modules', 'assets', 'email-templates', 'fonts', 'manifests', 'migrations', 'netlify', 'plugins', 'scripts', 'sql']);

async function htmlFiles(dir = ROOT, rel = '') {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (!NOT_PAGES.has(ent.name) && !ent.name.startsWith('.')) out.push(...await htmlFiles(resolve(dir, ent.name), `${rel}${ent.name}/`));
    } else if (ent.name.endsWith('.html')) {
      out.push(`${rel}${ent.name}`);
    }
  }
  return out;
}

// /dl/ lists the hosted Local Yep wheels. The list, the sizes and the checksum
// line come from the files in dl/ and dl/SHA256SUMS.txt, so a release is: add
// the wheel, add its line to SHA256SUMS.txt, run npm run build:pages. When the
// line was typed by hand, 0.3.5 shipped showing 0.3.4's checksum.
export async function dlRegions() {
  const dir = resolve(ROOT, 'dl');
  const sums = new Map();
  for (const line of (await readFile(resolve(dir, 'SHA256SUMS.txt'), 'utf8')).split(/\r?\n/)) {
    const m = line.trim().match(/^([0-9a-f]{64})\s+\*?(\S+)$/);
    if (m) sums.set(m[2], m[1]);
  }
  const ver = (f) => f.match(/^local_yep-(\d+)\.(\d+)\.(\d+)-/).slice(1).map(Number);
  const wheels = (await readdir(dir)).filter((f) => /^local_yep-\d+\.\d+\.\d+-py3-none-any\.whl$/.test(f))
    .sort((a, b) => { const x = ver(a), y = ver(b); return y[0] - x[0] || y[1] - x[1] || y[2] - x[2]; });
  if (!wheels.length) throw new Error('dl/: no local_yep-*.whl files found.');
  const unsummed = wheels.filter((f) => !sums.has(f));
  if (unsummed.length) throw new Error(`dl/SHA256SUMS.txt has no line for: ${unsummed.join(', ')}. Add "<sha256> *<file>" for each, then run npm run build:pages.`);
  const lis = [];
  for (const [i, f] of wheels.entries()) {
    const kb = Math.round((await stat(resolve(dir, f))).size / 1024);
    lis.push(`          <li><a href="/dl/${f}">${f}</a> <span class="size">${kb} KB${i === 0 ? ' &middot; current' : ''}</span></li>`);
  }
  const cur = wheels[0];
  return {
    'dl-wheels': lis.join('\n'),
    'dl-hash': `        <p class="note dl-hash">sha256 of ${esc(cur)} &nbsp;${sums.get(cur)}</p>`,
  };
}

export async function markedPages(year) {
  const out = {};
  for (const rel of (await htmlFiles()).sort()) {
    if (rel.startsWith('blog/')) continue; // postPages owns the notebook
    const src = (await readFile(resolve(ROOT, rel), 'utf8')).replace(/\r\n/g, '\n');
    if (!src.includes('<!-- fn:head -->')) continue;
    const section = rel.includes('/') ? `/${rel.split('/')[0]}/` : '/';
    const regions = { head: headShared(), header: header(section).replace(/^\n/, ''), footer: footerShared(year) };
    if (rel === 'dl/index.html') Object.assign(regions, await dlRegions());
    out[rel] = fillRegions(src, regions, rel);
  }
  return out;
}

// sitemap.xml lists every page under ROOT that has a canonical link and no
// robots noindex, then every notebook entry in blog/index.json with its date.
// It used to be typed by hand, and it went on listing /account/ and
// music.yepgent.com/ after both became redirects. A page with neither a
// canonical link nor noindex fails the build, naming the page. The two
// non-HTML files below are listed by hand: leaving one out only drops it
// from the sitemap.
const SITEMAP_FILES = ['https://yepgent.com/catalogue.json', 'https://yepgent.com/agents.txt'];

export async function sitemap(feed, rendered = {}) {
  const pages = [];
  for (const rel of await htmlFiles()) {
    if (rel.startsWith('blog/') && rel !== 'blog/index.html') continue; // entries come from the feed
    const html = rendered[rel] ?? (await readFile(resolve(ROOT, rel), 'utf8'));
    if (/<meta name="robots" content="[^"]*noindex/i.test(html)) continue;
    const m = html.match(/<link rel="canonical" href="([^"]+)"/);
    if (!m) throw new Error(`${rel}: no <link rel="canonical">. Add one, or <meta name="robots" content="noindex"> to leave the page out of sitemap.xml.`);
    pages.push(m[1]);
  }
  const home = 'https://yepgent.com/';
  pages.sort((a, b) => (b === home) - (a === home) || a.localeCompare(b));
  const url = (loc, lastmod) => `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Written by scripts/build-pages.mjs from the pages and blog/index.json. Run npm run build:pages instead of editing it. -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...pages.map((p) => url(p)),
    ...(feed.items || []).map((it) => url(it.url, (it.date_modified || it.date_published || '').slice(0, 10))),
    ...SITEMAP_FILES.map((f) => url(f)),
    '</urlset>',
    '',
  ].join('\n');
}

// ── build ────────────────────────────────────────────────────────────────
export async function loadCatalogue() {
  return JSON.parse(await readFile(resolve(ROOT, 'catalogue.json'), 'utf8'));
}

export async function loadFeed() {
  return JSON.parse(await readFile(resolve(ROOT, 'blog/index.json'), 'utf8'));
}

export function pages(cat, feed) {
  return {
    'index.html': homePage(cat, feed),
    'projects/index.html': projectsPage(cat),
    'games/index.html': gamesPage(cat),
    'experiments/index.html': experimentsPage(cat),
    'blog/index.html': notebookPage(feed, cat.updated.slice(0, 4)),
  };
}

async function main() {
  const [cat, feed] = await Promise.all([loadCatalogue(), loadFeed()]);
  const year = cat.updated.slice(0, 4);
  const out = { ...pages(cat, feed), ...(await postPages(feed, year)), ...(await markedPages(year)) };
  out['sitemap.xml'] = await sitemap(feed, out);
  const stale = [];
  for (const [rel, html] of Object.entries(out)) {
    const file = resolve(ROOT, rel);
    if (CHECK) {
      const cur = await readFile(file, 'utf8').catch(() => null);
      if (cur === null || cur.replace(/\r\n/g, '\n') !== html) stale.push(rel);
    } else {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, html, 'utf8');
      console.log(`wrote ${relative(ROOT, file)}`);
    }
  }
  if (CHECK) {
    if (stale.length) {
      console.error(`Out of date with catalogue.json or scripts/build-pages.mjs: ${stale.join(', ')}\nRun: npm run build:pages`);
      process.exit(1);
    }
    console.log(`pages up to date (${Object.keys(out).length})`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
