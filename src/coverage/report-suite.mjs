#!/usr/bin/env node
/**
 * Generate a Playwright suite's Istanbul coverage report.
 *
 * The browser-side V8 coverage was already resolved against source maps and
 * cached by the in-test fixture (.config/coverage-fixture.ts) — see the
 * comment there for why that has to happen while the server is live. This step
 * just adds the server-side V8 dumps (e2e only; their maps are on disk so they
 * resolve offline) and renders the report from the shared cache.
 *
 * Cache (browser, written by the fixture across workers):
 *   dist/reports/coverage/.cache/<suite>/
 * Server V8 (NODE_V8_COVERAGE, inspector format; e2e only):
 *   dist/reports/coverage/.raw/<suite>-server/*.json
 * Output:
 *   dist/reports/coverage/<suite>/coverage-final.json   (Istanbul, src/-mapped)
 *   dist/reports/coverage/<suite>/coverage-summary.json
 *   dist/reports/coverage/<suite>/lcov.info
 *   dist/reports/coverage/<suite>/index.html            (istanbul HTML report)
 *
 *   node dev/scripts/coverage/report-suite.mjs <e2e|storybook>
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CoverageReport } from 'monocart-coverage-reports';

import { inSrc } from './src-filter.mjs';

// Picking the value out of the constant list (rather than trusting argv) keeps
// the argument from ever being used as a path fragment.
const suite = ['e2e', 'storybook'].find((s) => s === process.argv[2]);
if (!suite) {
  console.error('usage: node dev/scripts/coverage/report-suite.mjs <e2e|storybook>');
  process.exit(1);
}

const ROOT = process.cwd();
const COV = path.join(ROOT, 'dist', 'reports', 'coverage');
const baseDir = path.join(COV, suite);
// MCR forces cacheDir to <outputDir>/.cache; the fixture (same outputDir) wrote
// the resolved browser coverage there, and generate() reads it back.
const cacheDir = path.join(baseDir, '.cache');

const mcr = new CoverageReport({
  name: `${suite} coverage`,
  outputDir: baseDir,
  // Keep server bundles (file: URLs, source attached below) and browser bundles
  // that carry a source map; drop node_modules and map-less runtime bundles.
  entryFilter: (entry) => {
    const url = String(entry.url || '');
    if (!url || url.includes('node_modules')) {
      return false;
    }
    if (url.startsWith('file:') || /[\\/]\.next[\\/]/.test(url)) {
      return true;
    }
    return /sourceMappingURL=/.test(String(entry.source || ''));
  },
  sourceFilter: inSrc,
  // Turbopack labels server-bundle sources `[project]/src/…`; the browser half of
  // the same suite labels the identical file `src/…`. Strip the `[project]/`
  // prefix so both halves collapse onto one `src/…` key — otherwise a file
  // exercised on both server and client is listed (and counted) twice.
  sourcePath: (filePath) => {
    const s = String(filePath).replace(/\\/g, '/');
    return s.startsWith('[project]/') ? s.slice('[project]/'.length) : s;
  },
  // istanbul reporters only — deliberately NOT monocart's 'v8' reporter. The v8
  // report's headline (Bytes / V8-Lines) is byte-RANGE coverage: a module that was
  // imported but never invoked reads ~100% there (its top-level eval covers the
  // file's byte span) while no function actually ran — false confidence. istanbul
  // 'html' + 'text-summary' derive every metric from statement/fn/branch hits, so a
  // loaded-but-not-run file honestly reads ~0%. coverage-final.json is unaffected
  // either way — it never carried byte data — so the global merge is unchanged.
  reports: ['html', 'text-summary', 'json', 'json-summary', 'lcovonly'],
});

// Read a server bundle's sibling source map and return its `sources` list
// (Turbopack maps may be sectioned). Returns [] when the map is missing or empty.
const mapSourcesFor = (bundlePath) => {
  try {
    const map = JSON.parse(readFileSync(`${bundlePath}.map`, 'utf8'));
    const srcs = map.sections
      ? map.sections.flatMap((s) => s.map?.sources || [])
      : map.sources || [];
    return srcs.map(String);
  } catch {
    return [];
  }
};

// Server-side V8 (e2e): NODE_V8_COVERAGE inspector dumps. These carry no source
// text, so attach it from disk (MCR drops entries without source); the on-disk
// `.next/server/**/*.js.map` then resolve offline. We only bother loading source
// for .next server bundles — Node internals (node:…) are skipped.
//
// We also DROP any bundle whose map carries no project `src/` file: Turbopack
// route stubs ship an empty map (`sources: []`) and runtime/action chunks map
// only to node_modules. MCR's `sourceFilter` runs solely on sources unpacked FROM
// a map, so these never reach it — without this gate MCR keeps the raw
// `.next/server/**` dist file in the report instead of real source files.
let server = 0;
const serverDir = path.join(COV, '.raw', `${suite}-server`);
const loadSource = (entry) => {
  const url = String(entry.url || '');
  if (!/[\\/]\.next[\\/]/.test(url)) {
    return null;
  }
  try {
    const p = url.startsWith('file:') ? fileURLToPath(url) : url;
    if (!mapSourcesFor(p).some(inSrc)) {
      return null;
    }
    return { ...entry, source: readFileSync(p, 'utf8') };
  } catch {
    return null;
  }
};
if (existsSync(serverDir)) {
  for (const f of readdirSync(serverDir)) {
    if (!f.endsWith('.json')) {
      continue;
    }
    const { result } = JSON.parse(readFileSync(path.join(serverDir, f), 'utf8'));
    if (!Array.isArray(result)) {
      continue;
    }
    const withSource = result.map(loadSource).filter(Boolean);
    if (withSource.length) {
      await mcr.add(withSource);
      server++;
    }
  }
}

if (!existsSync(cacheDir) && server === 0) {
  console.warn(
    `[coverage:${suite}] no coverage cache at ${path.relative(ROOT, cacheDir)} and no server dumps — did the suite run with COVERAGE=1?`,
  );
}

const res = await mcr.generate();
const pct = res?.summary?.lines?.pct;
console.log(
  `[coverage:${suite}] server-dumps=${server} → ${path.relative(ROOT, baseDir)}/coverage-final.json (lines ${pct ?? '?'}%)`,
);
