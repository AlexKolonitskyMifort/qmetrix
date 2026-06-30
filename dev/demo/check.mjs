#!/usr/bin/env node
/**
 * Post-build smoke check for the QMetriX demo site.
 *
 * Guards the two invariants that are easy to break silently:
 *   1. Every expected artifact exists under dist/site/.
 *   2. The emitted HTML is self-contained — no file link escapes dist/site/ (a stray
 *      `href="../…"`, an absolute filesystem path, or a `localhost` URL would break the
 *      site once published to GitHub Pages). Absolute https:// links are allowed.
 *
 * Exits non-zero with a clear message on the first failure. Run after a build:
 *   node dev/demo/run.mjs --no-serve && node dev/demo/check.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SITE = path.join(ROOT, 'dist', 'site');

const EXPECTED = [
  'index.html',
  'dashboard.html',
  'dashboard.json',
  'codebase-bundle.html',
  'jsinspect.json',
];

// HTML files we generate/control and can link-scan. codebase-bundle.html is excluded:
// it is a single self-contained file that embeds the whole repo's source as display
// text, so it legitimately contains arbitrary strings (e.g. docs quoting `href="../"`).
const SCANNED = ['index.html', 'dashboard.html'];

// Forbidden link shapes inside emitted HTML — each would escape the published dir.
const FORBIDDEN = [
  { re: /(?:href|src)\s*=\s*["']\.\.\//i, why: 'parent-relative link (../) escapes dist/site/' },
  { re: /(?:href|src)\s*=\s*["']file:\/\//i, why: 'file:// link is not portable' },
  { re: /(?:href|src)\s*=\s*["']https?:\/\/localhost/i, why: 'localhost link is not portable' },
  { re: /(?:href|src)\s*=\s*["'][A-Za-z]:[\\/]/i, why: 'absolute Windows path leaked into HTML' },
  { re: /(?:href|src)\s*=\s*["']\/[A-Za-z]/i, why: 'root-absolute link breaks under a Pages sub-path' },
];

const fail = (msg) => {
  console.error(`✗ demo check: ${msg}`);
  process.exit(1);
};

if (!existsSync(SITE)) {
  fail(`dist/site/ does not exist — run \`npm run demo:build\` first.`);
}

for (const name of EXPECTED) {
  if (!existsSync(path.join(SITE, name))) {
    fail(`missing expected artifact dist/site/${name}`);
  }
}

for (const name of SCANNED) {
  const html = readFileSync(path.join(SITE, name), 'utf8');
  for (const { re, why } of FORBIDDEN) {
    const m = re.exec(html);
    if (m) {
      fail(`${name}: ${why} — found ${JSON.stringify(m[0])}`);
    }
  }
}

console.log(
  `✓ demo check: ${EXPECTED.length} artifacts present; ${SCANNED.length} emitted pages self-contained.`,
);
