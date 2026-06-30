/**
 * Landing page for the QMetriX demo site.
 *
 * Renders `dist/site/index.html` — the entry point a visitor (or GitHub Pages) lands
 * on. It introduces QMetriX, carries the **illustrative-sample-data disclaimer**, shows
 * a small live-stats strip read from the dashboard's own JSON dump, and links to every
 * served artifact (dashboard, codebase bundle, structural-duplication report, raw data).
 *
 * Self-contained: inline CSS, relative links only — so the emitted directory works both
 * from `file://` and under a Pages project sub-path. Consumes data produced by
 * dev/demo/run.mjs; no dependency on the published `src/` tree.
 */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const num = (n) => (typeof n === 'number' && isFinite(n) ? n.toLocaleString('en-US') : '—');
const pct = (n) => (typeof n === 'number' && isFinite(n) ? `${n.toFixed(1)}%` : '—');

/** Join a list into prose: "a", "a and b", "a, b and c". Inputs are trusted static strings. */
const humanList = (arr) =>
  arr.length <= 1
    ? arr.join('')
    : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`;

/** Total finding count across all security tools present in the dashboard data. */
function securityCount(security) {
  if (!security) {
    return null;
  }
  const tools = [security.snyk, security.codeql, security.checkmarx].filter(Boolean);
  const reports = tools.flatMap((t) => t.reports || []);
  if (!reports.length) {
    return null;
  }
  return reports.reduce((a, r) => a + (r.total || 0), 0);
}

function tile(label, value, sub) {
  return `<div class="tile"><div class="tv">${esc(value)}</div><div class="tl">${esc(label)}</div>${
    sub ? `<div class="ts">${esc(sub)}</div>` : ''
  }</div>`;
}

/** Provenance badge. `live`: true → live, false → sample, 'mixed' → both (e.g. the dashboard). */
function badge(live) {
  if (live === 'mixed') {
    return '<span class="badge mixed">live + sample</span>';
  }
  return `<span class="badge ${live ? 'live' : 'sample'}">${live ? 'live' : 'sample data'}</span>`;
}

function card({ href, icon, title, desc, live }) {
  return `<a class="card" href="${esc(href)}">
    <div class="ci">${icon}</div>
    <div class="cc">
      <div class="ct">${esc(title)} ${badge(live)}</div>
      <div class="cd">${esc(desc)}</div>
    </div>
    <div class="ca">→</div>
  </a>`;
}

/**
 * @param {object} data
 * @param {object} data.meta       dashboard meta { name, version, generated, repo, branch }
 * @param {object} data.code       code collector output { codeLines, totalFiles, languages, ... }
 * @param {object} [data.coverage] coverage collector output (headline lines pct) — sample
 * @param {object} [data.security] security collector output — sample
 * @param {object} [data.bundle]   bundle info { fileCount, totalBytes }
 * @param {number} [data.duplicationMatches] structural-duplication match count (live)
 * @returns {string} full HTML document
 */
export function renderLanding(data = {}) {
  const meta = data.meta || {};
  const code = data.code || {};
  const bundle = data.bundle || {};
  const topLang = code.languages?.[0]?.name || '—';
  const kloc = typeof code.codeLines === 'number' ? (code.codeLines / 1000).toFixed(1) : null;
  const sec = securityCount(data.security);
  const repoUrl = meta.repo ? `https://github.com/${meta.repo.owner}/${meta.repo.name}` : null;

  // Honest provenance split for the disclaimer. Coverage, security and the dependency
  // audit/outdated columns are always seeded samples; structural duplication is live only
  // for a .js/.ts consumer (here, a .mjs repo, it falls back to a sample — see run.mjs).
  const dupLive = !!data.duplicationLive;
  const sampleSignals = ['Coverage', 'Security (Snyk / CodeQL)', 'dependency audit / outdated'];
  const realSignals = [
    'the code overview and languages',
    'the dependency inventory (names, versions, usage)',
    'the file graph',
    'the codebase bundle',
  ];
  (dupLive ? realSignals : sampleSignals).push(
    dupLive ? 'the structural-duplication audit' : 'structural duplication',
  );

  const strip = [
    tile('Lines of code', kloc ? `${kloc}K` : '—', `${num(code.codeFiles)} source files`),
    tile('Files scanned', num(code.totalFiles), 'across the repo'),
    tile('Top language', topLang, code.languages?.[0] ? `${num(code.languages[0].lines)} lines` : ''),
    tile('Coverage', pct(data.coverage?.lines), 'sample data'),
    tile('Security findings', sec == null ? '—' : num(sec), 'sample data'),
    tile(
      'Duplication',
      num(data.duplicationMatches),
      `structural clones (${data.duplicationLive ? 'live' : 'sample data'})`,
    ),
  ].join('');

  const cards = [
    card({
      href: 'dashboard.html',
      icon: '📊',
      title: 'Quality dashboard',
      desc: 'Code overview, coverage, dependencies, security, file graph and more — one self-contained page.',
      live: 'mixed',
    }),
    card({
      href: 'codebase-bundle.html',
      icon: '📦',
      title: 'Codebase bundle',
      desc: `Every source file in one browsable, filterable page${
        bundle.fileCount ? ` — ${num(bundle.fileCount)} files embedded` : ''
      }.`,
      live: true,
    }),
    card({
      href: 'jsinspect.json',
      icon: '🧬',
      title: 'Structural-duplication report',
      desc: `Raw jsinspect-plus findings — ${num(data.duplicationMatches)} structural clone group(s) in src/.`,
      live: data.duplicationLive,
    }),
    card({
      href: 'dashboard.json',
      icon: '🗂️',
      title: 'Raw dashboard data',
      desc: 'The full collected dataset behind the dashboard, as JSON — for programmatic use.',
      live: 'mixed',
    }),
  ].join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>QMetriX — demo</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font: 15px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: #0d1117; color: #e6edf3; padding: 0 16px 64px;
  }
  .wrap { max-width: 960px; margin: 0 auto; }
  header { padding: 56px 0 24px; }
  h1 { font-size: 34px; margin: 0 0 8px; letter-spacing: -0.5px; }
  h1 .x { color: #58a6ff; }
  .tagline { color: #8b949e; font-size: 16px; margin: 0; }
  .meta { color: #6e7681; font-size: 13px; margin-top: 10px; }
  .meta a { color: #58a6ff; text-decoration: none; }
  .disclaimer {
    border: 1px solid #9e6a03; background: #1c1505; color: #e3b341;
    border-radius: 8px; padding: 14px 16px; margin: 8px 0 28px; font-size: 13.5px; line-height: 1.55;
  }
  .disclaimer strong { color: #f0c674; }
  .strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 32px; }
  .tile { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 14px; }
  .tv { font-size: 22px; font-weight: 650; }
  .tl { color: #8b949e; font-size: 12px; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.4px; }
  .ts { color: #6e7681; font-size: 11.5px; margin-top: 3px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.6px; color: #8b949e; margin: 0 0 12px; }
  .cards { display: grid; gap: 12px; }
  .card {
    display: flex; align-items: center; gap: 16px; text-decoration: none; color: inherit;
    background: #161b22; border: 1px solid #21262d; border-radius: 10px; padding: 16px 18px;
    transition: border-color .15s, transform .15s;
  }
  .card:hover { border-color: #58a6ff; transform: translateY(-1px); }
  .ci { font-size: 26px; }
  .cc { flex: 1; }
  .ct { font-size: 16px; font-weight: 600; }
  .cd { color: #8b949e; font-size: 13px; margin-top: 2px; }
  .ca { color: #58a6ff; font-size: 20px; }
  .badge { font-size: 10.5px; font-weight: 600; padding: 2px 7px; border-radius: 999px; vertical-align: middle; margin-left: 6px; text-transform: uppercase; letter-spacing: 0.3px; }
  .badge.live { background: #12331f; color: #3fb950; border: 1px solid #238636; }
  .badge.sample { background: #2d2200; color: #e3b341; border: 1px solid #9e6a03; }
  .badge.mixed { background: #11202e; color: #58a6ff; border: 1px solid #1f6feb; }
  footer { color: #6e7681; font-size: 12.5px; margin-top: 40px; border-top: 1px solid #21262d; padding-top: 16px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>QMetri<span class="x">X</span> <span style="font-size:18px;color:#8b949e;font-weight:400">demo</span></h1>
    <p class="tagline">Quality signals for any repository — this site is QMetriX run against its own source.</p>
    <div class="meta">
      ${esc(meta.name || 'project')} v${esc(meta.version || '0.0.0')}${
        meta.branch ? ` · branch <code>${esc(meta.branch)}</code>` : ''
      }${repoUrl ? ` · <a href="${esc(repoUrl)}" target="_blank" rel="noopener">${esc(meta.repo.owner)}/${esc(meta.repo.name)}</a>` : ''}${
        meta.generated ? ` · generated ${esc(meta.generated)}` : ''
      }
    </div>
  </header>

  <div class="disclaimer">
    <strong>⚠ Demo data notice.</strong> The ${humanList(sampleSignals)} ${
      sampleSignals.length > 1 ? 'panels are' : 'panel is'
    } populated from <em>illustrative sample reports</em> committed under
    <code>dev/demo/fixtures/</code> — they are <em>not</em> QMetriX's real metrics (a build-less ESM
    package has no test suite or security toolchain). Everything else — ${humanList(realSignals)} — is
    <strong>real</strong>, generated live from this repository.
  </div>

  <div class="strip">${strip}</div>

  <h2>Explore the artifacts</h2>
  <div class="cards">${cards}</div>

  <footer>
    Built by <code>npm run demo</code> · served locally and publishable as a static site to GitHub
    Pages · QMetriX is consumed via <code>qmetrix-*</code> bin executables.
  </footer>
</div>
</body>
</html>
`;
}
