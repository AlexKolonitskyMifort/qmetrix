/** 2. Test coverage — per suite (unit / e2e / storybook) plus their global merge.
 *
 * Collect-only: this reads whatever `npm run coverage:*` last wrote to
 * dist/reports/coverage/<suite>/coverage-summary.json (see dev/scripts/coverage/* and
 * .config/jest.config.mjs). It never runs jest itself — when no summary exists the
 * section is marked missing with the command that generates it.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { ROOT } from '../config.mjs';
import { rel } from '../utils/fs.mjs';

const SUITES = [
  { key: 'unit', label: 'Unit' },
  { key: 'e2e', label: 'E2E' },
  { key: 'storybook', label: 'Storybook' },
  { key: 'global', label: 'Global' },
];

// Istanbul emits the string "Unknown" for pct when a category has zero measurable
// items; coerce anything non-numeric to null so renderers show an em-dash.
const pctOf = (m) => (typeof m?.pct === 'number' ? m.pct : null);

const summaryPath = (key) =>
  path.join(ROOT, 'dist', 'reports', 'coverage', key, 'coverage-summary.json');

// Istanbul's html reporter writes a browsable index.html next to the summary —
// the per-file / per-folder drill-down the dashboard links to.
const reportIndexPath = (key) => path.join(ROOT, 'dist', 'reports', 'coverage', key, 'index.html');

/** Link to a suite's HTML report, relative to the dashboard output dir when known. */
function reportHrefFor(key, outDir) {
  const idx = reportIndexPath(key);
  if (!existsSync(idx)) {
    return null;
  }
  if (!outDir) {
    return rel(idx);
  }
  return path.relative(outDir, idx).split(path.sep).join('/');
}

function readSuite({ key, label }, outDir) {
  const p = summaryPath(key);
  if (!existsSync(p)) {
    return { key, label, available: false };
  }
  let data;
  try {
    data = JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return { key, label, available: false, note: `${key}: summary could not be parsed.` };
  }
  const total = data.total || {};
  const files = Object.entries(data)
    .filter(([k]) => k !== 'total')
    .map(([file, m]) => ({ file: rel(path.resolve(ROOT, file)), lines: pctOf(m.lines) }))
    .sort((a, b) => (a.lines ?? 101) - (b.lines ?? 101));
  return {
    key,
    label,
    available: true,
    statements: pctOf(total.statements),
    branches: pctOf(total.branches),
    functions: pctOf(total.functions),
    lines: pctOf(total.lines),
    fileCount: files.length,
    files,
    reportHref: reportHrefFor(key, outDir),
  };
}

/** @param {string} [outDir] directory the dashboard html is written to (for relative report links). */
export function collectCoverage(outDir) {
  const suites = SUITES.map((s) => readSuite(s, outDir));
  const byKey = Object.fromEntries(suites.map((s) => [s.key, s]));
  // Headline (chip + bars + per-file table) prefers the global merge, else unit.
  const head = byKey.global?.available ? byKey.global : byKey.unit;
  const available = suites.some((s) => s.available);

  return {
    available,
    note: available
      ? 'Per-suite coverage over the full src/ tree. Run `npm run coverage:all` to refresh e2e / storybook / global.'
      : 'No coverage artifact found. Run `npm run coverage:unit` (or `npm run coverage:all`) to generate it.',
    // Headline fields consumed by the existing summary chip + gauge bars.
    statements: head?.statements ?? null,
    branches: head?.branches ?? null,
    functions: head?.functions ?? null,
    lines: head?.lines ?? null,
    headLabel: head?.label ?? null,
    files: head?.files ?? [],
    reportHref: head?.reportHref ?? null,
    // Per-suite breakdown (files[] omitted to keep the JSON dump small).
    suites: suites.map(({ files, ...rest }) => rest),
  };
}
