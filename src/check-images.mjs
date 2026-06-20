#!/usr/bin/env node
/**
 * Image budget check — fails the build when committed images are too heavy for the web.
 *
 * Scans public/, src/ and content/ for raster + SVG assets and reports every file that
 * exceeds the byte budget or (rasters only) the pixel budget. Wired into `npm run verify`.
 *
 * Budgets (override per run with flags, per file via EXCEPTIONS below):
 *   • size:       ≤ 300 KB per file
 *   • dimensions: ≤ 3840 px on the longest side (raster formats, needs sharp)
 *
 * Usage:
 *   node dev/scripts/check-images.mjs [--max-kb 300] [--max-px 3840]
 *   npm run images:check
 *
 * Fix offenders with:  npm run images:optimize -- <file|dir> [--format webp]
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

// Anchored on the consuming repo's cwd — every verb runs from the app root.
const ROOT = process.cwd();

const SCAN_ROOTS = ['public', 'src', 'content'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'coverage']);
const RASTER_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);
const VECTOR_EXT = new Set(['.svg']);

// Per-file budget overrides, keyed by posix path relative to the repo root.
// Use sparingly — prefer optimizing the asset over raising its budget.
//   ['public/images/huge-hero.png', { maxKB: 800 }],
const EXCEPTIONS = new Map([]);

/* ── CLI flags ── */
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? Number(argv[i + 1]) : fallback;
};
const MAX_KB = flag('--max-kb', 300);
const MAX_PX = flag('--max-px', 3840);

/* ── helpers ── */
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const fmtKB = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        yield* walk(path.join(dir, entry.name));
      }
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (RASTER_EXT.has(ext) || VECTOR_EXT.has(ext)) {
        yield path.join(dir, entry.name);
      }
    }
  }
}

// sharp ships with Next 16; degrade to size-only checks if it ever goes missing.
let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.log('⚠  sharp not found — checking file sizes only (no dimension checks).');
}

/* ── scan ── */
const violations = [];
let checked = 0;

for (const root of SCAN_ROOTS) {
  const abs = path.join(ROOT, root);
  if (!existsSync(abs)) {
    continue;
  }
  for (const file of walk(abs)) {
    checked++;
    const relPath = rel(file);
    const maxKB = EXCEPTIONS.get(relPath)?.maxKB ?? MAX_KB;
    const bytes = statSync(file).size;
    const problems = [];

    if (bytes > maxKB * 1024) {
      problems.push(`${fmtKB(bytes)} (budget ${maxKB} KB)`);
    }

    if (sharp && RASTER_EXT.has(path.extname(file).toLowerCase())) {
      try {
        const { width = 0, height = 0 } = await sharp(file).metadata();
        if (Math.max(width, height) > MAX_PX) {
          problems.push(`${width}×${height} px (budget ${MAX_PX} px)`);
        }
      } catch {
        problems.push('unreadable by sharp (corrupt image?)');
      }
    }

    if (problems.length) {
      violations.push({ relPath, problems });
    }
  }
}

/* ── report ── */
console.log(`\n==  Image budget check  ==  (${checked} files, ≤${MAX_KB} KB, ≤${MAX_PX} px)\n`);

if (violations.length === 0) {
  console.log('✓ All images within budget.\n');
  process.exit(0);
}

for (const v of violations) {
  console.log(`  ✗ ${v.relPath}\n      ${v.problems.join(' · ')}`);
}
console.log(`\n${violations.length} image(s) over budget. Fix with:`);
console.log('  npm run images:optimize -- <file|dir> [--format webp]');
console.log('or add a justified exception in dev/scripts/check-images.mjs (EXCEPTIONS).\n');
process.exit(1);
