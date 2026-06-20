#!/usr/bin/env node
/**
 * Code-quality dashboard generator (orchestrator) — COLLECT-ONLY.
 *
 * Walks the known artifact locations and renders a single, self-contained (offline,
 * no CDN) HTML dashboard. It does NOT run linters, tests or audits; whatever a section
 * needs must already exist on disk, and anything missing is clearly flagged with the
 * command that generates it.
 *
 *   1. Tests, lint & types — coverage-summary.json + dist/reports/eslint.json + tsc.log
 *   2. Security scanners   — Snyk / CodeQL / Checkmarx (local SARIF, else CI link)
 *   3. Dependencies        — filterable table: prod/dev, what it is, why/when added,
 *                            imported?, outdated?, vulnerable? (npm-audit.json / npm-outdated.json)
 *   4. File graph          — internal import relationships (expandable folder tree + force graph)
 *   5. Routing             — Next.js App Router tree (pages / API routes / layouts)
 *   6. Component composition — app-rooted nested rectangles of feature widgets (props/state/events/API)
 *   7. Data model          — ER-style entity boxes parsed from supabase/migrations/*.sql
 *   8. Storybook           — link to the static Storybook built next to the dashboard
 *   9. Codebase bundle     — the whole codebase as one browsable HTML file
 *
 * Read-only artifact inputs (generate them separately; the dashboard only reads them):
 *   - dist/reports/coverage/<suite>/coverage-summary.json   (npm run coverage:unit / :all)
 *   - dist/reports/eslint.json    (npm run lint -- -f json -o dist/reports/eslint.json)
 *   - dist/reports/tsc.log        (npm run typecheck > dist/reports/tsc.log 2>&1)
 *   - dist/reports/npm-audit.json (npm audit --json > dist/reports/npm-audit.json)
 *   - dist/reports/npm-outdated.json (npm outdated --json > dist/reports/npm-outdated.json)
 *   - dist/reports/*.sarif        (npm run security:scan)
 *   - <outDir>/storybook/index.html (built by `npm run quality:dashboard`, or `npm run build-storybook`)
 *
 * The collection logic lives in dev/scripts/dashboard/collectors/*, shared helpers in
 * dev/scripts/dashboard/utils/*, and the HTML rendering in dev/scripts/dashboard/render/*.
 *
 * The dependency "what it is / why / when" columns are populated automatically from
 * each package's node_modules description and the git commit that introduced it in
 * package.json. To curate them, create dev/scripts/dependency-notes.json:
 *   { "<package>": { "description": "...", "reason": "...", "task": "PROJ-123", "added": "2026-06-05" } }
 * Any field present there overrides the auto-detected value.
 *
 * Usage:
 *   npm run quality:dashboard          # full deployable site: build Storybook + dashboard → dist/site/
 *   node dev/scripts/quality-dashboard.mjs [options]   # fast report-only regen (no Storybook build)
 *
 * Options:
 *   --out <file>   Output path (default: dist/site/index.html)
 *   --no-bundle    Skip generating the codebase bundle (bundle-codebase.mjs)
 *   --open         Open the dashboard when done
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { bundleCodebase } from './bundle-codebase.mjs';
import { ROOT } from './dashboard/config.mjs';
import { collectCode } from './dashboard/collectors/code.mjs';
import { collectComposition } from './dashboard/collectors/composition.mjs';
import { collectCoverage } from './dashboard/collectors/coverage.mjs';
import { collectDeps } from './dashboard/collectors/deps.mjs';
import { collectEntities } from './dashboard/collectors/entities.mjs';
import { collectGraph } from './dashboard/collectors/graph.mjs';
import { collectLint } from './dashboard/collectors/lint.mjs';
import { collectRouting } from './dashboard/collectors/routing.mjs';
import { collectSecurity } from './dashboard/collectors/security.mjs';
import { collectStorybook } from './dashboard/collectors/storybook.mjs';
import { render } from './dashboard/render/template.mjs';
import { exec, log } from './dashboard/utils/exec.mjs';
import { rel } from './dashboard/utils/fs.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const OUT = path.resolve(ROOT, opt('--out', 'dist/site/index.html'));
const RUN_BUNDLE = !flag('--no-bundle');

/**
 * Print a found/missing inventory of every collect-only artifact the dashboard reads,
 * so the build log shows at a glance which reports were picked up and which are absent
 * (with the command that generates each missing one). Source-derived sections (code,
 * graph, routing, composition, entities) are always computed and aren't listed here.
 */
function printReportInventory({ coverage, lint, deps, security, storybook }) {
  const rows = [];
  const add = (section, name, found, detail) => rows.push({ section, name, found, detail });

  // 1. Coverage — one row per suite (unit / e2e / storybook / global).
  for (const s of coverage.suites) {
    const hint = s.key === 'unit' ? 'npm run coverage:unit' : 'npm run coverage:all';
    add(
      'Coverage',
      s.label,
      s.available,
      s.available ? `dist/reports/coverage/${s.key}/coverage-summary.json` : hint,
    );
  }

  // 2. Lint & types.
  add(
    'Lint & types',
    'ESLint',
    !!lint.eslint?.available,
    lint.eslint?.available
      ? 'dist/reports/eslint.json'
      : 'npm run lint -- -f json -o dist/reports/eslint.json',
  );
  add(
    'Lint & types',
    'TypeScript',
    !!lint.tsc?.available,
    lint.tsc?.available ? 'dist/reports/tsc.log' : 'npm run typecheck > dist/reports/tsc.log 2>&1',
  );

  // 3. Dependencies (audit + outdated).
  add(
    'Dependencies',
    'npm audit',
    !!deps.audit?.available,
    deps.audit?.available
      ? 'dist/reports/npm-audit.json'
      : 'npm audit --json > dist/reports/npm-audit.json',
  );
  add(
    'Dependencies',
    'npm outdated',
    !!deps.outdatedAvailable,
    deps.outdatedAvailable
      ? 'dist/reports/npm-outdated.json'
      : 'npm outdated --json > dist/reports/npm-outdated.json',
  );

  // 4. Security scanners — local SARIF/JSON if present, otherwise a CI link only.
  for (const tool of [security.snyk, security.codeql, security.checkmarx]) {
    const n = tool.reports?.length || 0;
    add(
      'Security',
      tool.name,
      n > 0,
      n > 0
        ? `${n} local report${n > 1 ? 's' : ''}`
        : 'no local SARIF (CI link only; Snyk: npm run security:scan)',
    );
  }

  // 5. Storybook static build (built next to the dashboard).
  add(
    'Storybook',
    'Static build',
    !!storybook.built,
    storybook.built
      ? rel(path.join(path.dirname(OUT), 'storybook', 'index.html'))
      : 'npm run quality:dashboard (or npm run build-storybook)',
  );

  const found = rows.filter((r) => r.found).length;
  console.log(`\n📋  Report inventory — ${found}/${rows.length} artifacts found (collect-only):\n`);
  const pad = Math.max(...rows.map((r) => r.name.length));
  let section = '';
  for (const r of rows) {
    if (r.section !== section) {
      section = r.section;
      console.log(`   ${section}`);
    }
    const tail = r.found ? r.detail : `missing — ${r.detail}`;
    console.log(`     ${r.found ? '✓' : '✗'}  ${r.name.padEnd(pad)}  ${tail}`);
  }
  console.log('');
}

function gitInfo() {
  const remote = exec('git config --get remote.origin.url').stdout.trim();
  const branch = exec('git rev-parse --abbrev-ref HEAD').stdout.trim() || 'unknown';
  let repo = null;
  const m = remote.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (m) {
    repo = { owner: m[1], name: m[2] };
  }
  return { repo, branch };
}

async function main() {
  console.log('\n📊  Building quality dashboard…\n');
  let pkg = {};
  try {
    pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  } catch {}
  const { repo, branch } = gitInfo();

  log('Scanning source tree…');
  const code = collectCode();
  const graph = collectGraph();
  const coverage = collectCoverage(path.dirname(OUT));
  const lint = collectLint();
  const deps = collectDeps(graph.importedExternals);
  const security = collectSecurity(repo);
  const routing = collectRouting();
  const composition = collectComposition();
  const entities = collectEntities();
  const storybook = collectStorybook(path.dirname(OUT));

  printReportInventory({ coverage, lint, deps, security, storybook });

  // Codebase bundle — generated next to the dashboard so the relative link works.
  let bundle = { available: false, note: 'Skipped (--no-bundle).' };
  if (RUN_BUNDLE) {
    log('Bundling codebase…');
    try {
      const b = await bundleCodebase(path.join(path.dirname(OUT), 'codebase-bundle.html'));
      bundle = {
        available: true,
        file: path.basename(b.outFile),
        fileCount: b.fileCount,
        totalBytes: b.totalBytes,
        htmlBytes: b.htmlBytes,
      };
    } catch (err) {
      bundle = { available: false, note: `Bundle failed: ${err.message}` };
    }
  }

  const meta = {
    name: pkg.name || 'project',
    version: pkg.version || '0.0.0',
    generated: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    repo,
    branch,
  };

  const html = render({
    meta,
    code,
    coverage,
    lint,
    deps,
    graph,
    security,
    routing,
    composition,
    entities,
    storybook,
    bundle,
  });
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, html, 'utf8');

  // Also dump the raw collected data for programmatic use / debugging.
  const jsonOut = OUT.replace(/\.html?$/i, '') + '.json';
  writeFileSync(
    jsonOut,
    JSON.stringify(
      {
        meta,
        code,
        coverage,
        lint,
        deps,
        graph: { ...graph, graph: undefined, importedExternals: [...graph.importedExternals] },
        security,
        routing,
        composition,
        entities,
        storybook,
        bundle,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`\n✅  Dashboard:  ${rel(OUT)}`);
  console.log(`   Raw data:   ${rel(jsonOut)}\n`);

  if (flag('--open')) {
    // Arg-array spawn (no shell string) so quotes/&/spaces in the path survive.
    const [cmd, args] =
      process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', OUT]]
        : process.platform === 'darwin'
          ? ['open', [OUT]]
          : ['xdg-open', [OUT]];
    spawnSync(cmd, args, { stdio: 'ignore', windowsHide: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
