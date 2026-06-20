#!/usr/bin/env node
/**
 * Print a high-level markdown outline of the Playwright suites without running them.
 *
 * Levels map onto the spec structure:
 *   1. feature / widget  — the spec file (or the top-level describe for storybook)
 *   2. functionality     — test.describe block
 *   3. scenario / case   — test title
 *
 * Usage:
 *   node dev/scripts/test-outline.mjs              # both e2e and storybook
 *   node dev/scripts/test-outline.mjs e2e          # just the site e2e suite
 *   node dev/scripts/test-outline.mjs storybook    # just the storybook suite
 */
import { execFileSync } from 'node:child_process';

// Anchored on the consuming repo's cwd — every verb runs from the app root.
const rootDir = process.cwd();

const SUITES = {
  e2e: { title: 'E2E (site)', config: '.config/playwright.config.ts' },
  storybook: { title: 'Storybook (widgets)', config: '.config/playwright.storybook.config.ts' },
};

function listTests(config) {
  const out = execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['playwright', 'test', `--config=${config}`, '--list', '--reporter=json'],
    {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      shell: process.platform === 'win32',
    },
  );
  // The json reporter is the only stdout writer under --list, but guard against
  // stray npm/node noise before the JSON payload.
  return JSON.parse(out.slice(out.indexOf('{')));
}

const prettify = (s) =>
  s
    .replace(/\.((e2e|storybook)\.)?spec\.ts$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());

/** Feature title from the co-located spec path: its basename, with an api/ prefix kept for API-route specs. */
function featureTitle(file) {
  const p = file.replace(/\\/g, '/');
  const base = p.split('/').pop();
  return prettify(p.includes('/api/') ? `api/${base}` : base);
}

/** Collect spec titles, deduplicating parameterized tests that expand per item. */
function specTitles(suite) {
  const titles = [];
  for (const spec of suite.specs ?? []) {
    if (!titles.includes(spec.title)) {
      titles.push(spec.title);
    }
  }
  return titles;
}

function printSuite(fileSuite) {
  // Level 1: the spec file (api specs keep their api/ prefix for context)
  console.log(`- **${featureTitle(fileSuite.title)}**`);
  // Tests declared at file top level (outside any describe) land directly at level 2.
  for (const title of specTitles(fileSuite)) {
    console.log(`  - ${title}`);
  }
  for (const describe of fileSuite.suites ?? []) {
    console.log(`  - ${describe.title}`);
    for (const title of specTitles(describe)) {
      console.log(`    - ${title}`);
    }
    // Flatten deeper describes into level 3 so the outline never exceeds three levels.
    for (const nested of describe.suites ?? []) {
      for (const title of specTitles(nested)) {
        console.log(`    - ${nested.title} — ${title}`);
      }
    }
  }
}

const wanted = process.argv[2] ? [process.argv[2]] : Object.keys(SUITES);
for (const key of wanted) {
  const suite = SUITES[key];
  if (!suite) {
    console.error(`Unknown suite "${key}". Use: ${Object.keys(SUITES).join(', ')}`);
    process.exit(1);
  }
  const report = listTests(suite.config);
  console.log(`\n# ${suite.title}\n`);
  for (const fileSuite of report.suites ?? []) {
    printSuite(fileSuite);
  }
}
