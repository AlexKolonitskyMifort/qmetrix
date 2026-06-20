/** 6–9. Security scanners — local SARIF/JSON artifacts (Snyk, CodeQL, Checkmarx). */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { ROOT } from '../config.mjs';
import { rel, walk } from '../utils/fs.mjs';

function findSarifFiles() {
  const found = [];
  // Primary location: dist/reports (where dev/scripts/security-scan.mjs writes). walk()
  // skips dist/, so scan it explicitly.
  const reportsDir = path.join(ROOT, 'dist', 'reports');
  if (existsSync(reportsDir)) {
    for (const name of readdirSync(reportsDir)) {
      if (name.toLowerCase().endsWith('.sarif')) {
        found.push(path.join(reportsDir, name));
      }
    }
  }
  // Back-compat: any *.sarif left elsewhere in the tree (e.g. downloaded from CI to root).
  found.push(...walk(ROOT).filter((f) => f.toLowerCase().endsWith('.sarif')));
  return found;
}

function parseSarif(file) {
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  const sev = { critical: 0, high: 0, medium: 0, low: 0, note: 0 };
  let driver = '';
  const rules = {};
  const findings = [];
  for (const run of doc.runs || []) {
    driver = run.tool?.driver?.name || driver;
    // CodeQL (and others) attach `security-severity` / level + a human-readable
    // title (shortDescription / help) to the rule, not the result.
    const ruleMeta = {};
    for (const r of run.tool?.driver?.rules || []) {
      ruleMeta[r.id] = {
        score: parseFloat(r.properties?.['security-severity']),
        level: (r.defaultConfiguration?.level || '').toString().toLowerCase(),
        title: (r.shortDescription?.text || r.name || '').trim(),
      };
    }
    for (const res of run.results || []) {
      const meta = ruleMeta[res.ruleId] || {};
      const resScore = parseFloat(res.properties?.['security-severity']);
      const score = Number.isNaN(resScore) ? meta.score : resScore;
      const level = (res.level || meta.level || '').toString().toLowerCase();
      let bucket = 'note';
      if (!Number.isNaN(score)) {
        bucket = score >= 9 ? 'critical' : score >= 7 ? 'high' : score >= 4 ? 'medium' : 'low';
      } else if (level === 'error') {
        bucket = 'high';
      } else if (level === 'warning') {
        bucket = 'medium';
      } else if (level === 'note') {
        bucket = 'low';
      }
      sev[bucket]++;
      const rid = res.ruleId || 'rule';
      rules[rid] = (rules[rid] || 0) + 1;

      // "Why this is flagged" — the rule title is the headline reason, the result
      // message is the specifics; keep both (deduped) plus the offending location.
      const loc = res.locations?.[0]?.physicalLocation;
      const uri = loc?.artifactLocation?.uri || '';
      const line = loc?.region?.startLine || null;
      const msg = (res.message?.text || '').trim();
      const reason = meta.title && meta.title !== msg ? meta.title : msg || meta.title;
      findings.push({
        rule: rid,
        severity: bucket,
        reason,
        detail: msg && msg !== reason ? msg : '',
        where: uri ? `${uri}${line ? `:${line}` : ''}` : '',
      });
    }
  }
  const total = Object.values(sev).reduce((a, b) => a + b, 0);
  // Most severe first, then by rule frequency, so the rendered list leads with what matters.
  const rank = { critical: 0, high: 1, medium: 2, low: 3, note: 4 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return {
    driver,
    sev,
    total,
    findings,
    topRules: Object.entries(rules)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
  };
}

export function collectSecurity(repo) {
  const sarifFiles = findSarifFiles();
  const parsed = sarifFiles
    .map((f) => ({ file: rel(f), ...parseSarif(f) }))
    .filter((p) => p && p.driver != null);

  const matchByName = (...needles) =>
    parsed.filter((p) =>
      needles.some(
        (n) => p.file.toLowerCase().includes(n) || (p.driver || '').toLowerCase().includes(n),
      ),
    );

  const ghSecurity = repo
    ? `https://github.com/${repo.owner}/${repo.name}/security/code-scanning`
    : null;
  const ciLink = (tool) =>
    ghSecurity ? `${ghSecurity}?query=tool%3A${encodeURIComponent(tool)}` : null;

  // ── Snyk ──
  const snykReports = [...matchByName('snyk')];
  // snyk test --json (non-SARIF) fallback — check dist/reports first, then repo root.
  for (const name of ['snyk.json', 'snyk-deps.json', 'snyk-code.json']) {
    const p = [path.join(ROOT, 'dist', 'reports', name), path.join(ROOT, name)].find((c) =>
      existsSync(c),
    );
    if (p) {
      try {
        const j = JSON.parse(readFileSync(p, 'utf8'));
        const arr = Array.isArray(j) ? j : j.vulnerabilities || [];
        const sev = { critical: 0, high: 0, medium: 0, low: 0, note: 0 };
        const findings = [];
        for (const v of arr) {
          const s = (v.severity || 'low').toLowerCase();
          sev[s] = (sev[s] || 0) + 1;
          findings.push({
            rule: v.id || v.packageName || 'vuln',
            severity: s,
            reason: (v.title || v.id || '').trim(),
            detail: v.packageName ? `${v.packageName}${v.version ? `@${v.version}` : ''}` : '',
            where: '',
          });
        }
        snykReports.push({
          file: name,
          driver: 'Snyk',
          sev,
          total: arr.length,
          findings,
          topRules: [],
        });
      } catch {}
    }
  }
  const snyk = {
    name: 'Snyk',
    tool: 'Open Source + Code (SAST/SCA)',
    workflow: existsSync(path.join(ROOT, '.github/workflows/snyk.yml')),
    reports: snykReports,
    dashboard: 'https://app.snyk.io',
    ci: ciLink('snyk'),
  };

  // ── CodeQL ──
  const codeql = {
    name: 'CodeQL',
    tool: 'GitHub semantic SAST (javascript-typescript)',
    workflow: existsSync(path.join(ROOT, '.github/workflows/codeql.yml')),
    reports: matchByName('codeql'),
    ci: ciLink('CodeQL'),
    dashboard: ghSecurity,
  };

  // ── Checkmarx ──
  const checkmarx = {
    name: 'Checkmarx One',
    tool: 'SAST · SCA · secret detection',
    workflow: existsSync(path.join(ROOT, '.github/workflows/checkmarx.yml')),
    reports: matchByName('cx-results', 'checkmarx'),
    ci: ciLink('Checkmarx'),
    dashboard: 'https://ast.checkmarx.net',
  };

  return { snyk, codeql, checkmarx, ghSecurity, anySarif: parsed.length };
}
