#!/usr/bin/env node
/**
 * Structural copy-paste audit — finds renamed / restructured duplication that the
 * token-based detector (`npm run cpd`, jscpd) misses.
 *
 * jscpd matches token *values*, so the moment identifiers or literals change it
 * stops seeing the clone. jsinspect-plus walks the AST and matches node *shape*,
 * so two blocks with the same structure but different variable names still flag.
 * Threshold / ignore live in `.config/.jsinspectrc`; identifier matching is turned
 * off here on the CLI (`-I`) because jsinspect ignores that key from the config
 * file (see the note in .jsinspectrc). Literals stay on as anchors.
 *
 * This is **advisory**: structural detectors are noisy by nature, so a finding is
 * a review prompt, not a build failure. It always exits 0 unless `--strict` is
 * passed. Part of the periodic `audit` phase (see `npm run audit`), not the
 * per-push `verify` gate.
 *
 * Usage:
 *   node dev/scripts/audit-structure.mjs [paths...] [--strict]
 *   npm run audit:structure
 *
 * Writes a machine-readable report to dist/reports/jsinspect.json.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// Anchored on the consuming repo's cwd — every verb runs from the app root.
const ROOT = process.cwd();

const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const targets = argv.filter((a) => !a.startsWith('--'));
const paths = targets.length ? targets : ['src'];

// Resolve jsinspect-plus relative to THIS package (hoist-proof): works whether the
// dep hoists to the app root or nests under node_modules/@mifort-solutions/qmetrix/node_modules.
const BIN = path.join(
  path.dirname(createRequire(import.meta.url).resolve('jsinspect-plus/package.json')),
  'bin',
  'jsinspect',
);
const CONFIG = path.join('.config', '.jsinspectrc');
const REPORT = path.join('dist', 'reports', 'jsinspect.json');

const posix = (p) => p.replace(/^\.[\\/]/, '').replace(/\\/g, '/');

/* ── Run jsinspect-plus via its bundled CLI (cross-platform: node + bin.js) ── */
const { stdout, stderr, status, error } = spawnSync(
  process.execPath,
  [BIN, '-c', CONFIG, '-I', '-r', 'json', ...paths],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
);

if (error) {
  console.error(`audit:structure — failed to launch jsinspect-plus: ${error.message}`);
  process.exit(strict ? 1 : 0);
}

// jsinspect prints per-file parser failures to stderr but keeps going — surface them.
const parseErrors = (stderr || '').trim();
if (parseErrors) {
  console.warn('audit:structure — some files could not be parsed:');
  console.warn(parseErrors);
}

let matches;
try {
  matches = JSON.parse(stdout || '[]');
} catch {
  console.error('audit:structure — could not parse jsinspect output (exit', status, ')');
  console.error(stdout);
  process.exit(strict ? 1 : 0);
}

/* ── Persist the artifact (dashboard / history can pick this up later) ── */
mkdirSync(path.join(ROOT, 'dist', 'reports'), { recursive: true });
writeFileSync(path.join(ROOT, REPORT), JSON.stringify(matches, null, 2));

/* ── Human summary, worst (most lines duplicated) first ── */
const linesOf = (m) => m.instances.reduce((n, i) => n + (i.lines[1] - i.lines[0] + 1), 0);
const ranked = [...matches].sort((a, b) => linesOf(b) - linesOf(a));

console.log(
  `\nStructural duplication audit (jsinspect-plus, AST shape) — ${matches.length} clone group(s)\n`,
);

if (matches.length === 0) {
  console.log('No structural clones above the configured threshold. ✓\n');
} else {
  ranked.forEach((m, i) => {
    const span = m.instances[0].lines[1] - m.instances[0].lines[0] + 1;
    const locs = m.instances.map((inst) => `${posix(inst.path)}:${inst.lines[0]}-${inst.lines[1]}`);
    console.log(`#${i + 1}  ${m.instances.length}× (~${span} lines each)`);
    locs.forEach((loc) => console.log(`     ${loc}`));
  });
  console.log(`\nReport: ${posix(REPORT)}`);
  console.log('Advisory — these are candidates for extraction, not build failures.\n');
}

process.exit(strict && matches.length ? 5 : 0);
