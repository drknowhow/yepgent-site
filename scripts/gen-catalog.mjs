// Generate gallery/catalog.json from gallery/index.html.
//
// WHY THIS EXISTS (not just the Netlify build plugin):
// The live deploy ships via `netlify deploy --dir . --prod` in
// .github/workflows/deploy.yml — a direct push of a prebuilt directory.
// That path does NOT run `netlify build`, so the onBuild build plugins
// declared in netlify.toml (gallery-catalog, blog-notify) never execute.
// Result: gallery/catalog.json was 404 in production. This script runs
// the SAME parser (imported from the plugin) as an explicit CI step so
// the catalog is generated into the deployed directory.
//
// Idempotent and side-effect-free. Never exits non-zero — a failure
// here must not break the deploy; it degrades to an empty catalog.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCatalog } from '../plugins/gallery-catalog/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'gallery/index.html');
const OUTPUT = resolve(ROOT, 'gallery/catalog.json');

async function main() {
  let html = null;
  try {
    await stat(SOURCE);
    html = await readFile(SOURCE, 'utf8');
  } catch {
    console.log(`[gen-catalog] source not found at ${SOURCE} — emitting empty catalog`);
  }

  const catalog = buildCatalog(html);

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  console.log(`[gen-catalog] wrote ${catalog.count} items → gallery/catalog.json`);
}

main().catch((err) => {
  // Never fail the deploy over the catalog.
  console.warn(`[gen-catalog] non-fatal error: ${err.message}`);
  process.exit(0);
});
