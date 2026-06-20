/** 4. Dependencies + audit — package.json deps enriched with git/npm metadata.
 *
 * Collect-only for the vulnerability/outdated columns: they read artifacts rather
 * than running npm. Generate them with:
 *   npm audit --json    > dist/reports/npm-audit.json
 *   npm outdated --json > dist/reports/npm-outdated.json
 * The inventory itself (names, versions, why/when added) is read from package.json
 * and `git log` over package.json.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { ROOT, SCRIPTS_DIR } from '../config.mjs';
import { exec, log } from '../utils/exec.mjs';

/** description field from an installed package's own package.json (what it is). */
function pkgDescription(name) {
  try {
    const j = JSON.parse(
      readFileSync(path.join(ROOT, 'node_modules', name, 'package.json'), 'utf8'),
    );
    return (j.description || '').trim();
  } catch {
    return '';
  }
}

/**
 * For each dependency name, find the git commit that first introduced it into
 * package.json — gives us "when added" (date) and "why / which task" (subject).
 * One `git log -p` pass over package.json, oldest-first; first time we see a
 * line added for a known dep name wins.
 */
function gitDepHistory(names) {
  const want = new Set(names);
  const info = {};
  const r = exec('git log --reverse --date=short --format="@@C@@%h|%ad|%s" -p -- package.json', {
    timeout: 120_000,
  });
  if (r.code !== 0 || !r.stdout) {
    return info;
  }
  let cur = null;
  for (const line of r.stdout.split(/\r?\n/)) {
    if (line.startsWith('@@C@@')) {
      const [hash, date, ...subj] = line.slice(5).split('|');
      cur = { hash, date, subject: subj.join('|') };
      continue;
    }
    if (!cur) {
      continue;
    }
    const m = /^\+\s*"([^"]+)"\s*:/.exec(line); // an added "name": ... line in a hunk
    if (m && want.has(m[1]) && !info[m[1]]) {
      info[m[1]] = { ...cur };
    }
  }
  return info;
}

const AUDIT_ARTIFACT = path.join(ROOT, 'dist', 'reports', 'npm-audit.json');
const OUTDATED_ARTIFACT = path.join(ROOT, 'dist', 'reports', 'npm-outdated.json');
const AUDIT_HINT = 'npm audit --json > dist/reports/npm-audit.json';
const OUTDATED_HINT = 'npm outdated --json > dist/reports/npm-outdated.json';

/** Parse a saved `npm audit --json` file into a JSON object, or null. */
function readJsonArtifact(file) {
  if (!existsSync(file)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8') || 'null');
  } catch {
    return null;
  }
}

export function collectDeps(importedExternals) {
  let pkg = {};
  try {
    pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  } catch {}

  const prodNames = Object.keys(pkg.dependencies || {});
  const devNames = Object.keys(pkg.devDependencies || {});
  const prodCount = prodNames.length;
  const devCount = devNames.length;

  // npm audit — read the saved artifact (collect-only).
  let audit = { available: false, note: `Not generated. Run: ${AUDIT_HINT}` };
  const vulnByPkg = {}; // name -> severity (direct or transitive entry present in the tree)
  const auditJson = readJsonArtifact(AUDIT_ARTIFACT);
  if (auditJson) {
    const v = auditJson.metadata?.vulnerabilities;
    if (v) {
      audit = {
        available: true,
        info: v.info || 0,
        low: v.low || 0,
        moderate: v.moderate || 0,
        high: v.high || 0,
        critical: v.critical || 0,
        total: v.total || 0,
        deps: auditJson.metadata?.dependencies?.total ?? null,
      };
    }
    for (const [name, entry] of Object.entries(auditJson.vulnerabilities || {})) {
      if (entry?.severity) {
        vulnByPkg[name] = entry.severity;
      }
    }
  }

  // npm outdated — read the saved artifact (collect-only). `npm outdated --json`
  // emits {} when everything is current, a {name:{current,wanted,latest}} map when
  // packages are behind, or {"error":{code,summary,…}} when the registry call failed
  // (e.g. offline / ECONNRESET). Only the first two are usable — an error blob must
  // NOT be read as "0 need update", which is what made the section look illogical.
  const outdatedByPkg = {};
  const outdatedJson = readJsonArtifact(OUTDATED_ARTIFACT);
  const outdatedError =
    outdatedJson && outdatedJson.error && typeof outdatedJson.error === 'object'
      ? outdatedJson.error
      : null;
  const outdatedAvailable = outdatedJson != null && !outdatedError;
  if (outdatedAvailable) {
    for (const [name, m] of Object.entries(outdatedJson)) {
      if (!m || typeof m !== 'object') {
        continue;
      } // skip stray non-package keys
      outdatedByPkg[name] = { current: m.current, wanted: m.wanted, latest: m.latest };
    }
  }

  // when + why each dep was added (git), and an optional curated notes override.
  log('Reading dependency history (git) …');
  const gitInfo = gitDepHistory([...prodNames, ...devNames]);
  let notes = {};
  try {
    notes = JSON.parse(readFileSync(path.join(SCRIPTS_DIR, 'dependency-notes.json'), 'utf8'));
  } catch {}

  const build = (names, type) =>
    names.map((name) => {
      const n = notes[name] || {};
      const g = gitInfo[name] || {};
      const out = outdatedByPkg[name] || null;
      const version = (type === 'prod' ? pkg.dependencies : pkg.devDependencies)[name];
      return {
        name,
        type,
        version,
        imported: importedExternals.has(name),
        description: n.description || pkgDescription(name) || '',
        reason: n.reason || g.subject || '',
        task: n.task || '',
        added: n.added || g.date || '',
        addedHash: g.hash || '',
        outdated: out,
        needsUpdate: !!(out && out.latest && out.current !== out.latest),
        vuln: vulnByPkg[name] || null,
      };
    });

  const packages = [...build(prodNames, 'prod'), ...build(devNames, 'dev')].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return {
    prodCount,
    devCount,
    packages,
    audit,
    outdatedAvailable,
    outdatedNote: outdatedAvailable
      ? null
      : outdatedError
        ? `npm outdated could not reach the registry (${outdatedError.code || 'error'}: ${(outdatedError.summary || 'network error').split('\n')[0]}). Re-run: ${OUTDATED_HINT}`
        : `Not generated. Run: ${OUTDATED_HINT}`,
    outdatedCount: packages.filter((p) => p.needsUpdate).length,
    // Direct dependencies (in package.json) flagged by npm audit. This is a subset of
    // audit.total, which counts every advisory path including transitive packages —
    // hence vulnCount ≤ audit.total (they measure different things).
    vulnCount: packages.filter((p) => p.vuln).length,
    engines: pkg.engines || null,
  };
}
