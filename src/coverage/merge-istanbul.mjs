/**
 * Collapse N per-suite Istanbul coverage maps into ONE, unioning coverage at the
 * LINE level onto each file's richest structure.
 *
 * Why this is custom — and can't be a native istanbul/monocart merge: the three
 * suites are instrumented by DIFFERENT tools (unit by jest's own istanbul
 * instrumentation; e2e + storybook by monocart V8→istanbul). For the same source
 * file their statementMap / fnMap / branchMap geometry differs, so istanbul's structural
 * merge unions hit counts only when the maps are byte-identical; when they aren't
 * it stacks them side by side and the per-file totals DOUBLE — a file covered by
 * e2e but not unit then reads ~50% (one covered copy + one empty copy) instead of
 * 100%, most visibly on tiny files like src/app/loading.tsx (1 fn → 1/2).
 *
 * This cross-instrumenter mismatch is IRREDUCIBLE while the browser/server suites
 * use V8 coverage — verified empirically (2026-06-13): unit vs V8(e2e) maps
 * matched on 5/129 shared files; jest's own `coverageProvider: v8` matched 0/129
 * (a different v8-to-istanbul converter, degenerate fn/branch geometry); and the
 * only route to identical geometry — istanbul-instrumenting the build — is closed
 * because Turbopack ignores `experimental.swcPlugins` and would need the
 * deprecated `--webpack` builder. So we union by line ourselves rather than hand
 * two structures to a merger that can't reconcile them. See
 * dev/docs/coverage-by-suite-plan.md § "Why the global merge is a custom union".
 *
 * The union: per file, pick the suite map with the most statements as the
 * canonical structure, collect the set of source lines covered by ANY suite, and
 * mark covered anything the canonical map left at 0 whose line is in that set. All
 * suites instrument the SAME source, so 1-based line numbers are a shared
 * coordinate system. Statements/branches union on their START line (istanbul's own
 * line-coverage model); functions union on their full body RANGE, so a callback
 * whose declaration line rendered but whose body never ran is NOT credited. The
 * result is exactly one FileCoverage per file — nothing doubles — and the headline
 * is the intended "covered by ANY suite" at line granularity.
 *
 * Single-suite files pass through untouched (the union of one map is itself), so
 * this only changes files that appeared in more than one suite — the doubled ones.
 *
 * Limitation: across coarse (V8) vs fine (babel/SWC) maps the function/branch
 * union is approximate — line coverage is the reliable headline.
 */

const lineOf = (loc) => loc?.start?.line ?? null;
const stmtCount = (fc) => Object.keys(fc.statementMap || {}).length;

/** The line range to test a function against: full body if known, else its decl line. */
const fnLoc = (fn) =>
  fn?.loc ??
  fn?.decl ??
  (fn?.line != null ? { start: { line: fn.line }, end: { line: fn.line } } : null);

/** Does the union cover any source line inside [loc.start.line, loc.end.line]? */
function rangeCovered(loc, union) {
  const from = lineOf(loc);
  if (from == null) {
    return false;
  }
  const to = loc.end?.line ?? from;
  for (let l = from; l <= to; l++) {
    if (union.has(l)) {
      return true;
    }
  }
  return false;
}

// Per-map collectors of executed source lines (split out so coveredLines stays
// under the complexity gate). Each adds to the shared set in place.
function addStatementLines(fc, lines) {
  for (const [i, loc] of Object.entries(fc.statementMap || {})) {
    if ((fc.s?.[i] || 0) > 0) {
      lines.add(lineOf(loc));
    }
  }
}
function addFnLines(fc, lines) {
  for (const [i, fn] of Object.entries(fc.fnMap || {})) {
    if ((fc.f?.[i] || 0) > 0) {
      lines.add(lineOf(fn.decl ?? { start: { line: fn.line } }));
    }
  }
}
function addBranchLines(fc, lines) {
  for (const [i, br] of Object.entries(fc.branchMap || {})) {
    const counts = fc.b?.[i] || [];
    (br.locations || []).forEach((loc, j) => {
      if ((counts[j] || 0) > 0) {
        lines.add(lineOf(loc));
      }
    });
  }
}

/** Lines a single FileCoverage marks executed: covered statements + fn decls + branch arms. */
function coveredLines(fc) {
  const lines = new Set();
  addStatementLines(fc, lines);
  addFnLines(fc, lines);
  addBranchLines(fc, lines);
  lines.delete(null);
  return lines;
}

/** Bump anything the canonical map left at 0 whose source line ANY suite covered. */
function applyUnion(out, union) {
  for (const [i, loc] of Object.entries(out.statementMap || {})) {
    if (!out.s[i] && union.has(lineOf(loc))) {
      out.s[i] = 1;
    }
  }
  for (const [i, fn] of Object.entries(out.fnMap || {})) {
    if (!out.f[i] && rangeCovered(fnLoc(fn), union)) {
      out.f[i] = 1;
    }
  }
  for (const [i, br] of Object.entries(out.branchMap || {})) {
    const counts = out.b[i] || [];
    (br.locations || []).forEach((loc, j) => {
      if (!counts[j] && union.has(lineOf(loc))) {
        counts[j] = 1;
      }
    });
    out.b[i] = counts;
  }
}

/** Merge several FileCoverage maps of the SAME file into one (line-level union). */
function mergeFile(path, maps) {
  const union = new Set();
  for (const fc of maps) {
    for (const l of coveredLines(fc)) {
      union.add(l);
    }
  }
  // Canonical structure = richest map (most statements); first-wins → deterministic.
  const base = maps.reduce((a, b) => (stmtCount(b) > stmtCount(a) ? b : a), maps[0]);
  const out = JSON.parse(JSON.stringify(base));
  out.path = path;
  applyUnion(out, union);
  return out;
}

/**
 * @param {Array<Record<string, object>>} suites - canonicalized istanbul maps,
 *   one object per suite, keyed by the SAME canonical path (e.g. 'src/app/x.tsx').
 * @returns {Record<string, object>} one merged FileCoverage per path.
 */
export function mergeIstanbulSuites(suites) {
  const byPath = new Map();
  for (const data of suites) {
    for (const [p, fc] of Object.entries(data)) {
      if (!byPath.has(p)) {
        byPath.set(p, []);
      }
      byPath.get(p).push(fc);
    }
  }
  const out = {};
  for (const [p, maps] of byPath) {
    out[p] = maps.length === 1 ? maps[0] : mergeFile(p, maps);
  }
  return out;
}
