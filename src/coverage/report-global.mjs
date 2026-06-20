#!/usr/bin/env node
/**
 * Merge all three suites into one global coverage report over the full src/ tree.
 *
 *   unit       → dist/reports/coverage/unit/coverage-final.json       (jest istanbul)
 *   e2e        → dist/reports/coverage/e2e/coverage-final.json        (browser + server V8 → istanbul)
 *   storybook  → dist/reports/coverage/storybook/coverage-final.json  (browser V8 → istanbul)
 *
 * All three are Istanbul coverage maps already scoped to src/. They are
 * instrumented by DIFFERENT tools (unit: jest/babel; e2e + storybook: monocart
 * V8 → istanbul), so the same file has different statementMap/fnMap structures
 * across suites. Handing those straight to monocart/istanbul does NOT union them —
 * mismatched structures are stacked side by side and per-file totals double, so a
 * file covered by e2e but not unit reads ~50% instead of 100%. We therefore
 * pre-merge into ONE structure per file (mergeIstanbulSuites, line-level union)
 * before add(). Run the per-suite steps first (coverage:unit / :e2e / :storybook).
 *
 * The merged global figure is "covered by ANY suite" at line granularity — the
 * right headline number. (See dev/docs/coverage-by-suite-plan.md.)
 *
 *   node dev/scripts/coverage/report-global.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { CoverageReport } from 'monocart-coverage-reports';

import { mergeIstanbulSuites } from './merge-istanbul.mjs';
import { inSrc } from './src-filter.mjs';

const ROOT = process.cwd();
const COV = path.join(ROOT, 'dist', 'reports', 'coverage');

const mcr = new CoverageReport({
  name: 'Global coverage (unit + e2e + storybook)',
  outputDir: path.join(COV, 'global'),
  sourceFilter: inSrc,
  // istanbul reporters only (text-summary, not v8 'console-summary') so no Bytes /
  // V8-Lines column appears anywhere — the merged input is istanbul maps with no
  // byte data, so every metric here is statement/fn/branch-derived.
  reports: ['text-summary', 'html', 'json', 'json-summary', 'lcovonly'],
});

/**
 * Canonicalize istanbul file keys to `src/<path>` (posix) so the same file is
 * unified across suites. jest emits absolute Windows paths
 * (C:\…\src\foo.tsx); MCR emits project-relative ones (name/src/foo.tsx) — left
 * as-is they'd be treated as two different files and inflate the denominator.
 */
function canonicalize(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    const p = k.replace(/\\/g, '/');
    const i = p.lastIndexOf('/src/');
    const key = i >= 0 ? p.slice(i + 1) : p; // 'src/…'
    // Safety net: only merge real project src/ files. A stale suite-final could
    // still carry unmapped `.next/server/**` dist bundles (Turbopack route stubs /
    // runtime chunks); inSrc drops anything that doesn't resolve under <root>/src.
    if (!inSrc(key)) {
      continue;
    }
    out[key] = { ...v, path: key };
  }
  return out;
}

const suites = [];
for (const suite of ['unit', 'e2e', 'storybook']) {
  const f = path.join(COV, suite, 'coverage-final.json');
  if (!existsSync(f)) {
    console.warn(`[coverage:global] ${suite}/coverage-final.json missing — run coverage:${suite}.`);
    continue;
  }
  suites.push(canonicalize(JSON.parse(readFileSync(f, 'utf8'))));
}
const parts = suites.length;

if (!parts) {
  console.warn('[coverage:global] no suite reports found — run coverage:unit / :e2e / :storybook.');
} else {
  // Union the suites into one structure per file BEFORE handing to monocart, so
  // cross-instrumenter structure mismatches can't double the per-file totals.
  await mcr.add(mergeIstanbulSuites(suites));
}

const res = await mcr.generate();
const pct = res?.summary?.lines?.pct;
console.log(
  `[coverage:global] merged ${parts} suite(s) → dist/reports/coverage/global/coverage-final.json (lines ${pct ?? '?'}%)`,
);
