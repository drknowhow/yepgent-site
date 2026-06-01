// Netlify Build Plugin: gallery-catalog
//
// Parse gallery/index.html and emit gallery/catalog.json so agents
// can consume the generated-media gallery without scraping HTML.
//
// Source of truth is the HTML — each .card and .audio-row carries
// rich data-* attributes (data-kind, data-tool, data-tags, data-src,
// data-prompt, data-model, data-extra, data-post, data-suno) plus a
// .title and a .meta/.sub text line. We extract those, normalize,
// and write a flat JSON array. No drift risk because the HTML stays
// the source.
//
// Runs onBuild so the JSON is part of the deploy.
//
// Graceful behavior:
//   - If sourcePath doesn't exist, emit {generated_at, items: []} so
//     /gallery/catalog.json is always present (200, not 404) for
//     polite-agent expectations.
//   - Never fail the build — emit a warning and ship an empty catalog
//     if parsing throws.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export default function galleryCatalogPlugin() {
  return {
    onBuild: async ({ utils, inputs, constants }) => {
      const enabled = inputs?.enabled !== false;
      if (!enabled) {
        console.log('[gallery-catalog] disabled via inputs.enabled=false');
        return;
      }

      const publishDir = constants.PUBLISH_DIR || '.';
      const sourcePath = resolve(publishDir, inputs?.sourcePath || 'gallery/index.html');
      const outputPath = resolve(publishDir, inputs?.outputPath || 'gallery/catalog.json');

      let html = null;
      try {
        await stat(sourcePath);
        html = await readFile(sourcePath, 'utf8');
      } catch {
        console.log(`[gallery-catalog] source not found at ${sourcePath} — emitting empty catalog`);
      }

      let items = [];
      if (html) {
        try {
          items = parseGallery(html);
        } catch (err) {
          console.warn(`[gallery-catalog] parse failed: ${err.message} — emitting empty catalog`);
          items = [];
        }
      }

      const catalog = {
        generated_at: new Date().toISOString(),
        source: 'https://yepgent.com/gallery/',
        license: 'See /.well-known/yepgent.json#/policies — scraping_allowed, training_allowed=false',
        count: items.length,
        items,
      };

      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
      console.log(`[gallery-catalog] wrote ${items.length} items → ${outputPath}`);
    },
  };
}

// ---------------------------------------------------------------
// Parser — regex-based extraction of <figure class="card"> and
// <div class="audio-row"> blocks. Pairs each block's data-*
// attributes with the inner .title + .meta/.sub text.
// ---------------------------------------------------------------

function parseGallery(html) {
  const items = [];

  // Match a <figure class="card" ...>...</figure> block.
  const cardRe = /<figure[^>]*class="card"[^>]*>([\s\S]*?)<\/figure>/g;
  for (const m of html.matchAll(cardRe)) {
    const openTag = m[0].slice(0, m[0].indexOf('>') + 1);
    const inner = m[1];
    const item = buildItem(openTag, inner);
    if (item) items.push(item);
  }

  // Match a <div class="audio-row" ...>...</div> block. The block
  // contains a nested <div class="audio-head"> + waveform, but no
  // further audio-row, so a non-greedy match against the closing
  // </div> at depth 0 isn't quite right; the actual file structure
  // closes the audio-row at a specific indentation. We use the
  // structure that each audio-row ends with </div>\n        </div>
  // — match until the second </div> after the opening tag.
  const audioRe = /<div[^>]*class="audio-row"[^>]*>([\s\S]*?<\/div>\s*<\/div>)/g;
  for (const m of html.matchAll(audioRe)) {
    const openTag = m[0].slice(0, m[0].indexOf('>') + 1);
    const inner = m[1];
    const item = buildItem(openTag, inner);
    if (item) items.push(item);
  }

  return items;
}

function buildItem(openTag, inner) {
  const data = extractDataAttrs(openTag);
  if (!data.kind && !data.tool) return null;

  const title = extractText(inner, /<p class="title"[^>]*>([\s\S]*?)<\/p>/);
  const metaText = extractText(inner, /<p class="(?:meta|sub)"[^>]*>([\s\S]*?)<\/p>/);

  // meta is typically "YYYY-MM-DD · tool · extra" — split on the
  // styled dot separator or a plain dot/middle-dot.
  const metaParts = metaText
    ? metaText.split(/<span[^>]*class="dot-sep"[^>]*>[\s\S]*?<\/span>|\s+·\s+|\s+\u00b7\s+/)
        .map((s) => stripTags(s).trim())
        .filter(Boolean)
    : [];

  const date = metaParts.find((p) => /^\d{4}-\d{2}-\d{2}$/.test(p)) || null;

  let extra = null;
  if (data.extra) {
    try {
      extra = JSON.parse(data.extra);
    } catch {
      extra = { raw: data.extra };
    }
  }

  return {
    id: deriveId(data.src, title),
    kind: data.kind || null,                 // image | video | audio
    tool: data.tool || null,                 // sana | veo | ltx | suno | vibevoice
    tags: data.tags ? data.tags.split(/\s+/).filter(Boolean) : [],
    title: title ? stripTags(title).trim() : null,
    date,
    src: data.src || null,                   // canonical media URL on yepgent.com
    prompt: data.prompt || null,
    model: data.model || null,
    extra,                                   // JSON blob: duration, style, series, etc.
    related_post: data.post || null,
    suno_url: data.suno || null,
    meta_text: stripTags(metaText || '').trim() || null,
  };
}

function extractDataAttrs(openTag) {
  const out = {};
  const re = /\sdata-([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const m of openTag.matchAll(re)) {
    const key = m[1].toLowerCase();
    const val = m[2] ?? m[3] ?? '';
    out[key] = decodeEntities(val);
  }
  return out;
}

function extractText(inner, re) {
  const m = inner.match(re);
  return m ? m[1] : '';
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
}

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function deriveId(src, title) {
  if (src) {
    const base = src.split('/').pop() || '';
    return base.replace(/\.[a-zA-Z0-9]+$/, '');
  }
  return (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
