#!/usr/bin/env node
/**
 * QMetriX demo runner — dogfoods QMetriX against this repository and assembles a
 * self-contained, GitHub-Pages-ready demo site under `dist/site/`.
 *
 * Pipeline:
 *   1. clean    — remove the previous `dist/site/` so re-runs leave nothing stale
 *   2. seed     — copy illustrative sample reports (dev/demo/fixtures/reports/**) into
 *                 dist/reports/ so the dashboard's coverage / security / deps panels populate
 *   3. live run — qmetrix-audit-structure  → dist/reports/jsinspect.json
 *                 qmetrix-quality-dashboard → dist/site/{dashboard.html,dashboard.json,codebase-bundle.html}
 *   4. assemble — copy jsinspect.json into dist/site/ and render the landing dist/site/index.html
 *   5. serve    — static-serve dist/site/ over node:http (unless --no-serve)
 *
 * Offline & credential-free: it runs only the bins that need no network/auth; coverage and
 * security data come from the seeded samples (clearly labelled in the UI). Everything new
 * lives under dev/ and never ships in the npm tarball.
 *
 * Usage:
 *   node dev/demo/run.mjs [--no-serve] [--port <n>] [--host <h>] [--open]
 *   npm run demo            # build + serve
 *   npm run demo:build      # build only (--no-serve)
 */
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { renderLanding } from './landing.mjs';
import { startServer } from './serve.mjs';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const FIXTURES = path.join(ROOT, 'dev', 'demo', 'fixtures', 'reports');
const SAMPLE_DUP = path.join(ROOT, 'dev', 'demo', 'fixtures', 'jsinspect.sample.json');
const REPORTS = path.join(ROOT, 'dist', 'reports');
const SITE = path.join(ROOT, 'dist', 'site');
const JSINSPECT = path.join(REPORTS, 'jsinspect.json');

const log = (msg) => console.log(`\x1b[36m[demo]\x1b[0m ${msg}`);

/** Run a QMetriX bin from the repo root, inheriting stdio. Throws on a non-zero exit. */
function runBin(rel, args, { allowFail = false } = {}) {
  const r = spawnSync(process.execPath, [path.join('src', rel), ...args], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (r.error) {
    throw new Error(`failed to launch src/${rel}: ${r.error.message}`);
  }
  if (r.status !== 0 && !allowFail) {
    throw new Error(`src/${rel} exited with code ${r.status}`);
  }
  return r.status ?? 0;
}

/** Count structural-duplication clone groups from the jsinspect-plus JSON report. */
function duplicationCount() {
  try {
    const j = JSON.parse(readFileSync(JSINSPECT, 'utf8') || 'null');
    if (Array.isArray(j)) {
      return j.length;
    }
    if (Array.isArray(j?.matches)) {
      return j.matches.length;
    }
    return 0;
  } catch {
    return 0;
  }
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

async function main() {
  // Guard the cwd contract: the demo dogfoods *this* repo and must run from its root.
  if (!existsSync(path.join(ROOT, 'package.json')) || !existsSync(path.join(ROOT, 'src'))) {
    console.error(
      'qmetrix demo: run from the repository root (expected ./package.json and ./src to exist).',
    );
    process.exit(1);
  }

  // 1. Clean — a fresh dist/site/ every run (idempotent; no stale artifacts survive).
  log('Cleaning dist/site/ …');
  rmSync(SITE, { recursive: true, force: true });

  // 2. Seed illustrative sample reports so coverage / security / deps panels populate.
  log('Seeding illustrative sample reports into dist/reports/ …');
  mkdirSync(REPORTS, { recursive: true });
  cpSync(FIXTURES, REPORTS, { recursive: true });

  // 3. Live-run the offline bins against this repo.
  //    Remove any prior duplication report first so its presence afterwards reflects
  //    purely this run (idempotent live-vs-sample decision below).
  rmSync(JSINSPECT, { force: true });
  log('Running qmetrix-audit-structure (structural duplication) …');
  runBin('audit-structure.mjs', ['src'], { allowFail: true }); // advisory: never blocks the demo

  // jsinspect-plus only scans .js/.jsx/.ts/.tsx; QMetriX's own source is .mjs, so the live
  // audit produces no report here. Fall back to an illustrative sample (labelled in the UI)
  // so the structural-duplication capability is still showcased. A real .js/.ts consumer
  // gets the live report instead.
  const dupLive = existsSync(JSINSPECT);
  if (!dupLive) {
    log('No .js/.ts sources for jsinspect-plus (QMetriX is .mjs) — using sample duplication report.');
    cpSync(SAMPLE_DUP, JSINSPECT);
  }

  log('Running qmetrix-quality-dashboard (dashboard + codebase bundle) …');
  runBin('quality-dashboard.mjs', ['--out', path.join('dist', 'site', 'dashboard.html')]);

  // 4. Assemble the served tree: bring the duplication report inside dist/site/ and
  //    render the landing page from the dashboard's own data dump.
  log('Assembling landing page …');
  cpSync(JSINSPECT, path.join(SITE, 'jsinspect.json'));
  const dash = readJson(path.join(SITE, 'dashboard.json'));
  const html = renderLanding({
    meta: dash.meta,
    code: dash.code,
    coverage: dash.coverage,
    security: dash.security,
    bundle: dash.bundle,
    duplicationMatches: duplicationCount(),
    duplicationLive: dupLive,
  });
  mkdirSync(SITE, { recursive: true });
  writeFileSync(path.join(SITE, 'index.html'), html, 'utf8');

  log(`Demo site ready → ${path.relative(ROOT, SITE)}/index.html`);

  // 5. Serve (unless build-only).
  if (flag('--no-serve')) {
    console.log(
      `\nBuild complete. Open ${path.join(path.relative(ROOT, SITE), 'index.html')} or publish the` +
        ` ${path.relative(ROOT, SITE)}/ directory to GitHub Pages.`,
    );
    return;
  }

  const port = Number(opt('--port', process.env.QMETRIX_DEMO_PORT || 8080));
  const host = opt('--host', '127.0.0.1');
  const { url } = await startServer({ root: SITE, port, host });
  console.log(`\n\x1b[32m●\x1b[0m QMetriX demo serving at \x1b[1m${url}\x1b[0m  (Ctrl-C to stop)\n`);

  if (flag('--open')) {
    const [cmd, args] =
      process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : process.platform === 'darwin'
          ? ['open', [url]]
          : ['xdg-open', [url]];
    spawnSync(cmd, args, { stdio: 'ignore', windowsHide: true });
  }
}

main().catch((err) => {
  console.error(`\nqmetrix demo failed: ${err.message}`);
  process.exit(1);
});
