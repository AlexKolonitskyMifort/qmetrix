/** 3. Linter + typecheck — collect-only.
 *
 * Reads artifacts produced elsewhere (the dashboard never runs eslint/tsc itself):
 *   - ESLint JSON  → dist/reports/eslint.json
 *       generate with: npm run lint -- -f json -o dist/reports/eslint.json
 *   - tsc --noEmit → dist/reports/tsc.log
 *       generate with: npm run typecheck > dist/reports/tsc.log 2>&1
 * When an artifact is absent the section is marked missing with the command above.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { ROOT } from '../config.mjs';
import { rel } from '../utils/fs.mjs';

const ESLINT_ARTIFACT = path.join(ROOT, 'dist', 'reports', 'eslint.json');
const TSC_ARTIFACT = path.join(ROOT, 'dist', 'reports', 'tsc.log');

const ESLINT_HINT = 'npm run lint -- -f json -o dist/reports/eslint.json';
const TSC_HINT = 'npm run typecheck > dist/reports/tsc.log 2>&1';

/** Parse an ESLint JSON-formatter array into the shape the renderer expects. */
function parseEslint(json) {
  let errors = 0,
    warnings = 0;
  const byRule = {};
  const fileList = [];
  const problems = [];
  for (const f of json) {
    if (!f.errorCount && !f.warningCount) {
      continue;
    }
    errors += f.errorCount || 0;
    warnings += f.warningCount || 0;
    fileList.push({
      file: rel(f.filePath),
      errors: f.errorCount || 0,
      warnings: f.warningCount || 0,
    });
    for (const m of f.messages || []) {
      const id = m.ruleId || '(syntax)';
      const b = (byRule[id] ||= { rule: id, errors: 0, warnings: 0 });
      if (m.severity === 2) {
        b.errors++;
      } else {
        b.warnings++;
      }
      problems.push({
        file: rel(f.filePath),
        line: m.line ?? 0,
        column: m.column ?? 0,
        rule: id,
        severity: m.severity === 2 ? 'error' : 'warning',
        message: m.message || '',
      });
    }
  }
  // errors first, then by file/line — this is the "where & what" detail list.
  problems.sort(
    (a, b) =>
      (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) ||
      a.file.localeCompare(b.file) ||
      a.line - b.line,
  );
  return {
    available: true,
    errors,
    warnings,
    rules: Object.values(byRule).sort((a, b) => b.errors - a.errors || b.warnings - a.warnings),
    files: fileList.sort((a, b) => b.errors - a.errors || b.warnings - a.warnings).slice(0, 40),
    problems,
    problemsShown: Math.min(problems.length, 200),
  };
}

export function collectLint() {
  const out = { eslint: null, tsc: null };

  // ── ESLint ──
  if (existsSync(ESLINT_ARTIFACT)) {
    let json;
    try {
      json = JSON.parse(readFileSync(ESLINT_ARTIFACT, 'utf8'));
    } catch {
      json = null;
    }
    out.eslint = Array.isArray(json)
      ? parseEslint(json)
      : {
          available: false,
          note: `dist/reports/eslint.json is not valid JSON. Regenerate: ${ESLINT_HINT}`,
        };
  } else {
    out.eslint = { available: false, note: `Not generated. Run: ${ESLINT_HINT}` };
  }

  // ── tsc --noEmit ──
  if (existsSync(TSC_ARTIFACT)) {
    let txt;
    try {
      txt = readFileSync(TSC_ARTIFACT, 'utf8');
    } catch {
      txt = '';
    }
    const tsErrors = txt.split(/\r?\n/).filter((l) => /error TS\d+:/.test(l));
    out.tsc = {
      available: true,
      ok: tsErrors.length === 0,
      errors: tsErrors.length,
      sample: tsErrors.slice(0, 30),
    };
  } else {
    out.tsc = { available: false, note: `Not generated. Run: ${TSC_HINT}` };
  }

  return out;
}
