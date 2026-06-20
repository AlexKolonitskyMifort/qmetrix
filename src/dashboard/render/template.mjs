/** Assembles the final self-contained HTML page from the collected data. */
import { bytes, esc, num, pct } from '../utils/format.mjs';
import {
  COMPOSITION_FLOW_SCRIPT,
  COMPOSITION_SCRIPT,
  DEP_FILTER_SCRIPT,
  GRAPH_SCRIPT,
} from './client.mjs';
import { compositionGraphHtml } from './composition.mjs';
import {
  bar,
  entitiesHtml,
  fileTreeHtml,
  routingHtml,
  scannerCard,
  sevBadges,
} from './components.mjs';
import { STYLES } from './styles.mjs';

export function render(d) {
  const { meta, code, coverage, lint, deps, graph, security, routing, composition, entities } = d;
  const bundle = d.bundle || { available: false, note: 'Codebase bundle not generated.' };
  const storybook = d.storybook || { available: false, storyCount: 0, built: false };

  const chip = (label, value, tone = '') =>
    `<div class="chip ${tone}"><span>${value}</span><label>${label}</label></div>`;

  const lintTone =
    lint.eslint?.available && lint.eslint.errors === 0 && lint.tsc?.ok
      ? 'good'
      : lint.eslint?.errors
        ? 'bad'
        : 'warn';
  const auditTone = !deps.audit.available
    ? ''
    : deps.audit.high + deps.audit.critical > 0
      ? 'bad'
      : deps.audit.total > 0
        ? 'warn'
        : 'good';

  // Per-suite breakdown: unit / e2e / storybook / global side by side. Suites that
  // haven't been run yet show em-dashes rather than a misleading 0%.
  const suiteRows = (coverage.suites || [])
    .map((s) => {
      const cell = (v) => (s.available ? `<td class="r">${pct(v)}</td>` : `<td class="r">—</td>`);
      const files = s.available ? num(s.fileCount) : '—';
      const report = s.reportHref
        ? `<a href="${esc(s.reportHref)}" target="_blank" rel="noopener">open ↗</a>`
        : '<span class="muted">—</span>';
      return `<tr><td>${esc(s.label)}</td>${cell(s.lines)}${cell(s.statements)}${cell(s.branches)}${cell(s.functions)}<td class="r">${files}</td><td class="r">${report}</td></tr>`;
    })
    .join('');
  const suiteTable = `<table class="mini"><thead><tr><th>Suite</th><th class="r">Lines</th><th class="r">Stmts</th><th class="r">Branch</th><th class="r">Funcs</th><th class="r">Files</th><th class="r">Report</th></tr></thead><tbody>${suiteRows}</tbody></table>`;

  const covReportLink = coverage.reportHref
    ? `<p class="muted">📂 <a href="${esc(coverage.reportHref)}" target="_blank" rel="noopener">Open the full ${esc(coverage.headLabel || '')} coverage report ↗</a> — drill down file-by-file / folder-by-folder.</p>`
    : '';
  const covBody = coverage.available
    ? `${suiteTable}
       <p class="muted">Gauges + per-file below reflect <strong>${esc(coverage.headLabel || 'Unit')}</strong> (the widest available suite).</p>
       ${covReportLink}
       ${bar('Statements', coverage.statements)}${bar('Branches', coverage.branches)}${bar('Functions', coverage.functions)}${bar('Lines', coverage.lines)}
       <details><summary>Per-file (lowest first, ${coverage.files.length})</summary>
       <table class="mini"><thead><tr><th>File</th><th class="r">Lines %</th></tr></thead><tbody>
       ${coverage.files.map((f) => `<tr><td><code>${esc(f.file)}</code></td><td class="r">${pct(f.lines)}</td></tr>`).join('')}
       </tbody></table></details>`
    : `<p class="muted">${esc(coverage.note || 'Coverage not available.')}</p>`;

  let lintBody;
  if (lint.eslint?.available) {
    const clean = lint.eslint.errors === 0 && lint.eslint.warnings === 0;
    if (clean) {
      lintBody = `<p class="ok-msg">✓ No ESLint problems — the codebase is clean.</p>`;
    } else {
      const problems = lint.eslint.problems || [];
      const shown = problems.slice(0, lint.eslint.problemsShown || problems.length);
      const sevDot = (s) => `<span class="dot ${s === 'error' ? 'e' : 'w'}" title="${s}"></span>`;
      // Compact: filename (basename) instead of relative path; the rule id moves
      // to the row title so the dedicated Rule column can be dropped.
      const problemRows = shown
        .map((p) => {
          const fname = p.file.split('/').pop();
          return `<tr title="${esc(p.file)} · ${esc(p.rule)}"><td>${sevDot(p.severity)}<code>${esc(fname)}</code><span class="muted">:${p.line}:${p.column}</span></td><td class="msg">${esc(p.message)}</td></tr>`;
        })
        .join('');
      const moreNote =
        problems.length > shown.length
          ? `<p class="muted">… and ${problems.length - shown.length} more (showing first ${shown.length}).</p>`
          : '';
      lintBody = `<div class="sevrow">
           <span class="sev" style="--c:#dc2626">${lint.eslint.errors} errors</span>
           <span class="sev" style="--c:#d97706">${lint.eslint.warnings} warnings</span>
         </div>
         <table class="mini problems"><thead><tr><th>File:line:col</th><th>What</th></tr></thead><tbody>
         ${problemRows}
         </tbody></table>
         ${moreNote}`;
    }
  } else {
    lintBody = `<p class="muted">${esc(lint.eslint?.note || 'ESLint not run.')}</p>`;
  }
  const tscBody = lint.tsc?.available
    ? lint.tsc.ok
      ? `<p class="ok-msg">✓ tsc --noEmit passed — 0 type errors.</p>`
      : `<p class="bad-msg">✗ ${lint.tsc.errors} type error(s).</p><pre>${esc(lint.tsc.sample.join('\n'))}</pre>`
    : `<p class="muted">${esc(lint.tsc?.note || '')}</p>`;

  const auditBody = deps.audit.available
    ? `<div class="sevrow">${sevBadges({ critical: deps.audit.critical, high: deps.audit.high, medium: deps.audit.moderate, low: deps.audit.low, note: deps.audit.info })}</div>
       <p class="muted">${num(deps.audit.deps)} resolved dependencies · ${deps.audit.total} known advisories (npm audit baseline; Snyk adds licence + reachability).</p>`
    : `<p class="muted">${esc(deps.audit.note || 'npm audit not available.')}</p>`;

  const vulnColor = (s) =>
    ({ critical: '#dc2626', high: '#ea580c', moderate: '#d97706', low: '#0891b2' })[s] || '#64748b';

  const depRows = deps.packages
    .map((p) => {
      const verCell = p.needsUpdate
        ? `${esc(p.version)} <span class="muted">→</span> <span class="upd">${esc(p.outdated.latest)}</span>`
        : esc(p.version);
      const statusCell = p.vuln
        ? `<span class="sev" style="--c:${vulnColor(p.vuln)}">${esc(p.vuln)}</span>`
        : p.needsUpdate
          ? `<span class="muted">outdated</span>`
          : `<span class="ok-dot">●</span>`;
      const why =
        (p.reason ? esc(p.reason) : '<span class="muted">—</span>') +
        (p.task ? ` <span class="tag task">${esc(p.task)}</span>` : '');
      const added = p.added
        ? `${esc(p.added)}${p.addedHash ? ` <span class="muted">${esc(p.addedHash)}</span>` : ''}`
        : '<span class="muted">—</span>';
      return `<tr data-type="${p.type}" data-outdated="${p.needsUpdate ? 1 : 0}" data-vuln="${p.vuln ? 1 : 0}" data-name="${esc(p.name.toLowerCase())}">
        <td class="pkg"><code>${esc(p.name)}</code> <span class="tag ${p.type}">${p.type}</span>${p.imported ? ' <span class="imp" title="imported in source">imported</span>' : ''}</td>
        <td class="desc">${p.description ? esc(p.description) : '<span class="muted">—</span>'}</td>
        <td class="why">${why}</td>
        <td class="when">${added}</td>
        <td class="ver">${verCell}</td>
        <td class="r">${statusCell}</td>
      </tr>`;
    })
    .join('');

  const depFilters = `
    <div id="dep-filters" class="filters">
      <div class="seg">
        <button data-ftype="all" class="on">All <span class="muted">${deps.prodCount + deps.devCount}</span></button>
        <button data-ftype="prod">prod <span class="muted">${deps.prodCount}</span></button>
        <button data-ftype="dev">dev <span class="muted">${deps.devCount}</span></button>
      </div>
      <label${deps.outdatedAvailable ? '' : ` title="${esc(deps.outdatedNote || '')}"`}><input type="checkbox" id="f-outdated"${deps.outdatedAvailable ? '' : ' disabled'}> needs update <span class="muted">(${deps.outdatedAvailable ? deps.outdatedCount : 'n/a'})</span></label>
      <label title="Direct dependencies flagged by npm audit — a subset of the ${deps.audit.available ? deps.audit.total : '—'} total advisories, which also count transitive packages."><input type="checkbox" id="f-vuln"> vulnerable <span class="muted">(${deps.vulnCount})</span></label>
      <input id="f-q" type="search" placeholder="filter by name…">
      <span class="muted" id="dep-count"></span>
    </div>`;

  const outdatedNote = deps.outdatedAvailable
    ? ''
    : `<p class="muted" style="margin:0 0 10px">⚠ <strong>Needs-update</strong> is unavailable — ${esc(deps.outdatedNote || '')}</p>`;

  const depTableHtml = `
    ${outdatedNote}
    ${depFilters}
    <div class="tablewrap">
    <table class="mini deps" id="dep-rows"><thead><tr>
      <th>Package</th><th>What it is</th><th>Why / task it was added for</th><th>Added</th><th>Version</th><th class="r">Status</th>
    </tr></thead><tbody>${depRows}</tbody></table>
    </div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Quality Dashboard — ${esc(meta.name)}</title>
<style>${STYLES}</style>
</head>
<body>
<header>
  <h1>Quality Dashboard · ${esc(meta.name)} <span class="muted">v${esc(meta.version)}</span></h1>
  <div class="sub">Generated ${esc(meta.generated)}${meta.repo ? ` · <a href="https://github.com/${esc(meta.repo.owner)}/${esc(meta.repo.name)}" target="_blank" rel="noopener">${esc(meta.repo.owner)}/${esc(meta.repo.name)}</a>` : ''} · branch <code>${esc(meta.branch)}</code></div>
</header>
<div class="wrap">

  <div class="chips">
    ${chip('Code lines', num(code.codeLines))}
    ${chip('Source files', num(code.codeFiles))}
    ${chip('Coverage (lines)', coverage.available ? pct(coverage.lines) : '—', coverage.available ? (coverage.lines >= 80 ? 'good' : coverage.lines >= 50 ? 'warn' : 'bad') : '')}
    ${chip('Lint errors', lint.eslint?.available ? lint.eslint.errors : '—', lintTone === 'good' ? 'good' : lintTone === 'bad' ? 'bad' : 'warn')}
    ${chip('Type errors', lint.tsc?.available ? lint.tsc.errors : '—', lint.tsc?.ok ? 'good' : 'bad')}
    ${chip('Dependencies', num(deps.prodCount + deps.devCount))}
    ${chip('Audit advisories', deps.audit.available ? deps.audit.total : '—', auditTone)}
    ${chip('Modules / imports', `${graph.nodeCount}/${graph.edgeCount}`)}
    ${chip('Routes', routing.available ? routing.pageCount + routing.routeCount : '—')}
    ${chip('DB tables', entities.available ? entities.tables.length : '—')}
    ${chip('Stories', storybook.available ? storybook.storyCount : '—')}
  </div>

  <h2>1 · Tests, lint &amp; types</h2>
  <div class="grid three">
    <div class="card"><div class="card-h"><h3>Test coverage</h3></div>${covBody}</div>
    <div class="card"><div class="card-h"><h3>Linter (ESLint)</h3></div>${lintBody}</div>
    <div class="card"><div class="card-h"><h3>TypeScript</h3></div>${tscBody}</div>
  </div>

  <h2>2 · Security scanners</h2>
  <p class="muted" style="margin-top:-4px">Snyk, CodeQL and Checkmarx run in GitHub Actions and publish to the Security tab / vendor dashboards. Findings below are parsed from local SARIF artifacts when present.${security.ghSecurity ? ` · <a href="${security.ghSecurity}" target="_blank" rel="noopener">Open GitHub code scanning ↗</a>` : ''}</p>
  <div class="grid scanners">
    ${scannerCard(security.snyk)}
    ${scannerCard(security.codeql)}
    ${scannerCard(security.checkmarx)}
  </div>

  <h2>3 · Dependencies</h2>
  <div class="card">${auditBody}</div>
  <div class="card" style="margin-top:16px">${depTableHtml}</div>

  <h2>4 · File graph &amp; relationships</h2>
  <div class="card">
    <p class="muted">${graph.nodeCount} internal modules · ${graph.edgeCount} import edges · ${graph.externalCount} external packages. Browse by folder; expand a file to see what it imports and what imports it.</p>
    <div class="tree">${fileTreeHtml(graph.graph)}</div>
    <details style="margin-top:14px"><summary>Force-directed view (drag nodes, hover for path)</summary>
      <canvas id="graph"></canvas>
      <div class="legend" id="legend"></div>
    </details>
  </div>

  <h2>5 · Routing</h2>
  <div class="card">
    <p class="muted">Next.js App Router${routing.available ? ` — ${routing.pageCount} page(s) · ${routing.routeCount} API route(s)` : ''}. Expand a segment to see nested routes; dynamic <span class="seg dyn">[param]</span> segments and route <span class="seg group">(groups)</span> are highlighted.</p>
    <div class="tree">${routingHtml(routing)}</div>
  </div>

  <h2>6 · Component composition</h2>
  <div class="card">
    ${compositionGraphHtml(composition)}
  </div>

  <h2>7 · Data model</h2>
  <div class="card">
    <p class="muted">Entities parsed from <code>supabase/migrations/*.sql</code>${entities.available ? ` — ${entities.tables.length} table(s)${entities.buckets.length ? ` · ${entities.buckets.length} storage bucket(s)` : ''}` : ''}. <span class="kb pk">PK</span> primary key · <span class="kb fk">FK</span> foreign key · <span class="req">*</span> NOT NULL.</p>
    ${entitiesHtml(entities)}
  </div>

  <h2>8 · Storybook</h2>
  <div class="card">
    ${
      storybook.built
        ? `<p class="sb-link">📕 <a href="${esc(storybook.href)}" target="_blank" rel="noopener">Open Storybook ↗</a> — the component workshop (design-system widgets &amp; features), built as a static site next to this dashboard.</p>
    <p class="muted">${num(storybook.storyCount)} story file(s) in the source tree.</p>`
        : `<p class="muted">${num(storybook.storyCount)} story file(s) in the source tree. ${esc(storybook.note || 'Static Storybook not built next to the dashboard.')}</p>`
    }
  </div>

  <h2>9 · Codebase bundle</h2>
  <div class="card">
    ${
      bundle.available
        ? `<p>📦 <a href="${esc(bundle.file)}" target="_blank" rel="noopener">Open the codebase bundle ↗</a> — every source file, config and report in one browsable, self-contained page (collapsible tree, full-text filter).</p>
    <p class="muted">${num(bundle.fileCount)} files embedded · ${bytes(bundle.totalBytes)} of source · ${bytes(bundle.htmlBytes)} HTML · regenerate alone with <code>npm run bundle:report</code>.</p>`
        : `<p class="muted">${esc(bundle.note || 'Codebase bundle not generated.')} Run <code>npm run bundle:report</code> to generate it separately.</p>`
    }
  </div>

  <footer>Generated by <code>dev/scripts/quality-dashboard.mjs</code> · ${esc(meta.generated)}</footer>
</div>

<script id="graph-data" type="application/json">${JSON.stringify(graph.graph).replace(/</g, '\\u003c')}</script>
<script>
${GRAPH_SCRIPT}
</script>
<script>
${COMPOSITION_SCRIPT}
</script>
<script>
${COMPOSITION_FLOW_SCRIPT}
</script>
<script>
${DEP_FILTER_SCRIPT}
</script>
</body>
</html>`;
}
