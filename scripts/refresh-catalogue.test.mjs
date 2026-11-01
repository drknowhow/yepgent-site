// node --test scripts/refresh-catalogue.test.mjs
// Runs in pages-check.yml. Covers the rule that picks a project's version,
// release day and last push: newest date wins, a failed lookup falls back to
// the live site, and the committed value stays when nothing newer is known.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeProject, versionFromTag, pipName, format } from './refresh-catalogue.mjs';

const p = { id: 'x', repo: 'o/x', version: '1.0.0', released: '2026-10-01', pushed: '2026-10-01' };
const gh = (release, pushed = '2026-10-02') => ({ from: 'github', status: 'ok', pushed, ...(release ? { release } : {}) });

test('a newer GitHub release replaces the committed one', () => {
  const f = mergeProject(p, [gh({ version: '1.1.0', released: '2026-10-05' }, '2026-10-06')], null);
  assert.deepEqual([f.version, f.released, f.pushed], ['1.1.0', '2026-10-05', '2026-10-06']);
  assert.equal(f.from.release, 'github');
});

test('an older lookup never replaces a newer hand-typed value', () => {
  const f = mergeProject(p, [gh({ version: '0.9.0', released: '2026-09-01' }, '2026-09-01')], null);
  assert.deepEqual([f.version, f.released, f.pushed], ['1.0.0', '2026-10-01', '2026-10-01']);
});

test('a failed lookup falls back to the live site, not to older committed values', () => {
  const live = { id: 'x', version: '1.2.0', released: '2026-10-09', pushed: '2026-10-10' };
  const f = mergeProject(p, [{ from: 'github', status: 'failed', why: 'HTTP 503' }], live);
  assert.deepEqual([f.version, f.released, f.pushed], ['1.2.0', '2026-10-09', '2026-10-10']);
  assert.equal(f.from.release, 'live site');
});

test('the live site is ignored when every lookup worked', () => {
  const live = { id: 'x', version: '9.9.9', released: '2030-01-01', pushed: '2030-01-01' };
  const f = mergeProject(p, [gh({ version: '1.1.0', released: '2026-10-05' })], live);
  assert.equal(f.version, '1.1.0');
});

test('PyPI wins over GitHub when its release is newer', () => {
  const f = mergeProject(p, [gh({ version: '1.1.0', released: '2026-10-05' }), { from: 'pypi', status: 'ok', release: { version: '1.2.0', released: '2026-10-07' } }], null);
  assert.deepEqual([f.version, f.from.release], ['1.2.0', 'pypi']);
});

test('an unreleased project stays unreleased, and gets its last push', () => {
  const seed = { id: 's', repo: 'o/s', version: null, released: null };
  const f = mergeProject(seed, [gh(null, '2026-10-25')], null);
  assert.deepEqual([f.version, f.released, f.pushed], [null, null, '2026-10-25']);
});

test('a missing or private repo keeps the committed values', () => {
  const f = mergeProject(p, [{ from: 'github', status: 'none', missing: true }], { id: 'x', version: '9.9.9', released: '2030-01-01' });
  assert.deepEqual([f.version, f.released, f.pushed], ['1.0.0', '2026-10-01', '2026-10-01']);
});

test('tags and install lines', () => {
  assert.equal(versionFromTag('v2.161.0'), '2.161.0');
  assert.equal(versionFromTag('1.0.0-rc.1'), '1.0.0-rc.1');
  assert.equal(versionFromTag('nightly'), null);
  assert.equal(pipName('pip install code-context-control'), 'code-context-control');
  assert.equal(pipName('npm i x'), null);
});

test('format() round-trips catalogue.json', async () => {
  const cat = JSON.parse(await readFile(new URL('../catalogue.json', import.meta.url), 'utf8'));
  assert.deepEqual(JSON.parse(format(cat)), cat);
});
