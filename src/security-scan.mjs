#!/usr/bin/env node
/**
 * Local security scanners → SARIF, ready for the Quality Dashboard.
 *
 *   • Snyk      — Open Source (SCA) + Snyk Code (SAST). Requires a free Snyk account
 *                 (run `snyk auth`, or set SNYK_TOKEN). Skipped with guidance if absent.
 *   • CodeQL    — GitHub's semantic SAST. Free, no account. Auto-downloads the official
 *                 CodeQL CLI bundle into ./.codeql-bundle/ on first run, then builds a DB
 *                 from ./src and analyses it with the security-and-quality suite.
 *
 * Outputs (under dist/reports/, git-ignored, all parsed by dev/scripts/quality-dashboard.mjs):
 *   dist/reports/snyk-deps.sarif · dist/reports/snyk-code.sarif · dist/reports/codeql.sarif
 *
 * Usage:
 *   node dev/scripts/security-scan.mjs [--snyk-only|--codeql-only] [--no-download]
 *   npm run security:scan
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Anchored on the consuming repo's cwd — every verb runs from the app root.
const ROOT = process.cwd();

// All SARIF reports are collected here (alongside jest/playwright under dist/reports).
const REPORTS_DIR = path.join(ROOT, 'dist', 'reports');
mkdirSync(REPORTS_DIR, { recursive: true });
const SARIF = {
  snykDeps: path.join(REPORTS_DIR, 'snyk-deps.sarif'),
  snykCode: path.join(REPORTS_DIR, 'snyk-code.sarif'),
  codeql: path.join(REPORTS_DIR, 'codeql.sarif'),
};

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const SNYK_ONLY = has('--snyk-only');
const CODEQL_ONLY = has('--codeql-only');
const ANY_ONLY = SNYK_ONLY || CODEQL_ONLY;
const NO_DOWNLOAD = has('--no-download');

const results = [];

/* ── helpers ── */
function exec(cmd, { timeout = 1_800_000, stdio = 'pipe', cwd = ROOT } = {}) {
  const r = spawnSync(cmd, {
    cwd,
    shell: true,
    encoding: 'utf8',
    timeout,
    maxBuffer: 128 * 1024 * 1024,
    windowsHide: true,
    stdio: stdio === 'inherit' ? 'inherit' : 'pipe',
  });
  return {
    code: r.status ?? (r.error ? 1 : 0),
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    error: r.error,
  };
}
function which(cmd) {
  const probe = process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`;
  return exec(probe).code === 0;
}
const hr = (t) => console.log(`\n${'─'.repeat(58)}\n  ${t}\n${'─'.repeat(58)}`);
const sarifCount = (file) => {
  try {
    const doc = JSON.parse(readFileSync(file, 'utf8'));
    return (doc.runs || []).reduce((n, run) => n + (run.results?.length || 0), 0);
  } catch {
    return null;
  }
};

/* ─────────────────────────── Snyk ─────────────────────────── */
function snykAuthed() {
  if (process.env.SNYK_TOKEN) {
    return true;
  }
  const cfgs = [
    path.join(process.env.APPDATA || '', 'configstore', 'snyk.json'),
    path.join(os.homedir(), '.config', 'configstore', 'snyk.json'),
  ];
  return cfgs.some((p) => p && existsSync(p));
}

function runSnyk() {
  hr('Snyk — Open Source (SCA) + Snyk Code (SAST)');
  if (!snykAuthed()) {
    console.log('⚠  No Snyk credentials found (no SNYK_TOKEN, no stored auth).');
    console.log('   Authenticate once, then re-run:');
    console.log('     npm i -g snyk   &&   snyk auth        (free account)');
    console.log('     — or set $env:SNYK_TOKEN=<token>');
    console.log('   Skipping Snyk.');
    results.push({ tool: 'Snyk', status: 'skipped (not authenticated)' });
    return;
  }
  const snyk = which('snyk') ? 'snyk' : 'npx --yes snyk';
  console.log(`Using: ${snyk}`);

  console.log('→ snyk test (dependencies)…');
  const dep = exec(
    `${snyk} test --all-projects --severity-threshold=low --sarif-file-output="${SARIF.snykDeps}"`,
  );
  // Snyk exits non-zero when issues are found — that's success for us, the SARIF is what matters.
  const depN = sarifCount(SARIF.snykDeps);
  console.log(
    depN == null
      ? `  (no SARIF — ${(dep.stderr || dep.stdout).trim().split('\n')[0]})`
      : `  ${depN} dependency findings`,
  );

  console.log('→ snyk code test (SAST)…');
  const code = exec(
    `${snyk} code test --severity-threshold=low --sarif-file-output="${SARIF.snykCode}"`,
  );
  const codeN = sarifCount(SARIF.snykCode);
  console.log(
    codeN == null
      ? `  (no SARIF — ${(code.stderr || code.stdout).trim().split('\n')[0]})`
      : `  ${codeN} code findings`,
  );

  results.push({
    tool: 'Snyk',
    status:
      depN == null && codeN == null
        ? 'no SARIF produced'
        : `deps=${depN ?? '—'}, code=${codeN ?? '—'}`,
  });
}

/* ────────────────────────── CodeQL ────────────────────────── */
function codeqlPlatformAsset() {
  if (process.platform === 'win32') {
    return 'codeql-bundle-win64.tar.gz';
  }
  if (process.platform === 'darwin') {
    return 'codeql-bundle-osx64.tar.gz';
  }
  return 'codeql-bundle-linux64.tar.gz';
}

function ensureCodeql() {
  // 1) Explicit override, 2) on PATH, 3) local cached bundle, 4) download bundle.
  if (process.env.CODEQL_DIST) {
    const p = path.join(
      process.env.CODEQL_DIST,
      process.platform === 'win32' ? 'codeql.exe' : 'codeql',
    );
    if (existsSync(p)) {
      return `"${p}"`;
    }
  }
  if (which('codeql')) {
    return 'codeql';
  }

  const cacheDir = path.join(ROOT, 'dist', '.codeql-bundle');
  const bin = path.join(cacheDir, 'codeql', process.platform === 'win32' ? 'codeql.exe' : 'codeql');
  if (existsSync(bin)) {
    return `"${bin}"`;
  }

  if (NO_DOWNLOAD) {
    console.log('⚠  CodeQL CLI not found and --no-download was passed. Skipping CodeQL.');
    return null;
  }

  const asset = codeqlPlatformAsset();
  const url = `https://github.com/github/codeql-action/releases/latest/download/${asset}`;
  const tarball = path.join(cacheDir, asset);
  mkdirSync(cacheDir, { recursive: true });

  console.log(`→ Downloading CodeQL CLI bundle (~700 MB, one-time)…\n  ${url}`);
  const dl = exec(`curl -L --fail --retry 3 -o "${tarball}" "${url}"`, { timeout: 1_800_000 });
  if (dl.code !== 0 || !existsSync(tarball)) {
    console.log(`✗ Download failed: ${(dl.stderr || dl.stdout).trim().split('\n').slice(-1)[0]}`);
    return null;
  }
  console.log('→ Extracting…');
  const ex = exec(`tar -xzf "${tarball}" -C "${cacheDir}"`, { timeout: 600_000 });
  try {
    rmSync(tarball);
  } catch {}
  if (ex.code !== 0 || !existsSync(bin)) {
    console.log(`✗ Extraction failed: ${(ex.stderr || ex.stdout).trim()}`);
    return null;
  }
  console.log('✓ CodeQL ready.');
  return `"${bin}"`;
}

function runCodeQL() {
  hr('CodeQL — semantic SAST (javascript-typescript)');
  const codeql = ensureCodeql();
  if (!codeql) {
    results.push({ tool: 'CodeQL', status: 'skipped (CLI unavailable)' });
    return;
  }
  const ver = exec(`${codeql} version --format=terse`).stdout.trim();
  if (ver) {
    console.log(`CodeQL ${ver}`);
  }

  const dbDir = path.join(ROOT, '.codeql-db');
  try {
    rmSync(dbDir, { recursive: true, force: true });
  } catch {}

  console.log('→ Building database from ./src …');
  const create = exec(
    `${codeql} database create "${dbDir}" --language=javascript-typescript --source-root="${path.join(ROOT, 'src')}" --overwrite`,
    { timeout: 1_200_000 },
  );
  if (create.code !== 0 || !existsSync(dbDir)) {
    console.log(
      `✗ database create failed:\n${(create.stderr || create.stdout).trim().split('\n').slice(-8).join('\n')}`,
    );
    results.push({ tool: 'CodeQL', status: 'database create failed' });
    return;
  }

  console.log('→ Analysing (security-and-quality)…');
  const out = SARIF.codeql;
  const analyzeWith = (suite) =>
    exec(
      `${codeql} database analyze "${dbDir}" ${suite} --format=sarif-latest --output="${out}" --sarif-category=codeql`,
      { timeout: 1_200_000 },
    );
  let an = analyzeWith('javascript-security-and-quality.qls');
  if (an.code !== 0 || !existsSync(out)) {
    console.log('  (retrying with default query pack…)');
    an = analyzeWith('codeql/javascript-queries');
  }
  const n = sarifCount(SARIF.codeql);
  if (n == null) {
    console.log(
      `✗ analyze failed:\n${(an.stderr || an.stdout).trim().split('\n').slice(-8).join('\n')}`,
    );
    results.push({ tool: 'CodeQL', status: 'analyze failed' });
  } else {
    console.log(`✓ dist/reports/codeql.sarif — ${n} findings`);
    results.push({ tool: 'CodeQL', status: `${n} findings` });
  }
  // Keep the DB out of the way but cheap to rebuild; remove to save disk.
  try {
    rmSync(dbDir, { recursive: true, force: true });
  } catch {}
}

/* ─────────────────────────── main ─────────────────────────── */
console.log('\n==  Local security scan  ==\n');
if (!ANY_ONLY || SNYK_ONLY) {
  runSnyk();
}
if (!ANY_ONLY || CODEQL_ONLY) {
  runCodeQL();
}

hr('Summary');
for (const r of results) {
  console.log(`  ${r.tool.padEnd(8)} ${r.status}`);
}
console.log('\nNext:  npm run quality:dashboard   (re-renders the dashboard with these reports)\n');
