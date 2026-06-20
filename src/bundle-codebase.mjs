#!/usr/bin/env node
/**
 * Bundle the codebase into a single, self-contained HTML file.
 *
 * Walks the project tree, collects source code, configs and generated reports,
 * groups them exactly as a file explorer would (nested folders, then files) and
 * renders each one inside a collapsible block prefixed with a one-sentence
 * description. The output is dependency-free HTML you can open in any browser.
 *
 * Usage:  node dev/scripts/bundle-codebase.mjs [outFile]
 * Default output: dist/reports/codebase-bundle.html
 *
 * Also importable: quality-dashboard.mjs calls bundleCodebase() to generate the
 * bundle next to the dashboard and link to it.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Anchored on the consuming repo's cwd — every verb runs from the app root.
// (fileURLToPath stays imported: the isMain guard below still needs import.meta.url.)
const ROOT = process.cwd();
let OUT; // resolved per run inside bundleCodebase()

/* ------------------------------------------------------------------ config */

// Directory names skipped anywhere in the tree (deps, build output, caches…).
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.swc',
  '.turbo',
  '.idea',
  '.vscode',
  '.codeql-bundle',
  '.codeql-db',
  '.vercel',
  '.husky/_',
  '_',
  'coverage',
  'dist',
  'build',
  'out',
  'test-results',
  'playwright-report',
]);

// Text extensions worth embedding.
const INCLUDE_EXT = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'json',
  'css',
  'scss',
  'sass',
  'md',
  'mdx',
  'yml',
  'yaml',
  'sql',
  'html',
  'txt',
  'sarif',
  'sh',
]);

// Extension-less / dotfiles that should still be embedded.
const INCLUDE_NAMES = new Set([
  '.gitignore',
  '.prettierrc',
  '.prettierignore',
  '.eslintrc.json',
  '.env.example',
  '.dependency-cruiser.js',
  'LICENSE',
  'pre-commit',
]);

// Never embed (secrets, binaries, generated noise) regardless of extension.
const BINARY_EXT = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'ico',
  'svg',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'eot',
  'pdf',
  'zip',
  'gz',
  'mp4',
  'webm',
]);
const SECRET_RE = /^\.env(\.|$)/; // matches .env, .env.bak.x, .env.local … (NOT .env.example, handled below)

const MAX_BYTES = 2_000_000; // truncate file bodies larger than this

/* --------------------------------------------------------------- walk tree */

/** @returns {Promise<string[]>} project-relative POSIX paths, sorted. */
async function collect(dir = ROOT, rel = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const relPath = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name) || IGNORE_DIRS.has(relPath)) {
        continue;
      }
      out.push(...(await collect(path.join(dir, e.name), relPath)));
    } else if (e.isFile() && shouldInclude(e.name, relPath, path.join(dir, e.name))) {
      out.push(relPath);
    }
  }
  return out.sort();
}

function shouldInclude(name, relPath, abs) {
  if (abs === OUT) {
    return false;
  } // never embed our own output
  if (name === '.env.example') {
    return true;
  } // explicitly safe
  if (SECRET_RE.test(name)) {
    return false;
  } // guard real secrets
  if (name.endsWith('.tsbuildinfo') || name.endsWith('.map') || name.endsWith('.log')) {
    return false;
  }
  if (INCLUDE_NAMES.has(name)) {
    return true;
  }
  const ext = ext_of(name);
  if (BINARY_EXT.has(ext)) {
    return false;
  }
  return INCLUDE_EXT.has(ext);
}

const ext_of = (n) => (n.includes('.') ? n.split('.').pop().toLowerCase() : '');

/* ----------------------------------------------------------- descriptions */

// Curated fallbacks for well-known files that carry no useful inline prose.
const CURATED = {
  'package.json': 'npm manifest: scripts, dependencies and project metadata.',
  'package-lock.json': 'npm lockfile pinning the exact resolved version of every dependency.',
  'tsconfig.json': 'TypeScript compiler configuration.',
  'next.config.mjs': 'Next.js build and runtime configuration (wrapped with Sentry).',
  'next-env.d.ts': 'Next.js auto-generated ambient TypeScript types (do not edit).',
  'jest.config.mjs': 'Jest unit-test runner configuration.',
  'jest.setup.ts': 'Global setup executed before every Jest test file.',
  'playwright.config.ts': 'Playwright end-to-end test configuration.',
  'tailwind.config.ts': 'Tailwind CSS theme, plugins and content configuration.',
  'postcss.config.js': 'PostCSS plugin pipeline (Tailwind + autoprefixer).',
  '.eslintrc.json': 'ESLint linting rules.',
  '.prettierrc': 'Prettier code-formatting options.',
  '.prettierignore': 'Paths excluded from Prettier formatting.',
  '.gitignore': 'Files and directories excluded from Git.',
  '.dependency-cruiser.js': 'dependency-cruiser rules enforcing module dependency boundaries.',
  '.env.example': 'Template of the environment variables the app expects (no secrets).',
  'instrumentation-client.ts': 'Client-side Sentry instrumentation bootstrap.',
  'sentry.server.config.ts': 'Sentry initialisation for the Node.js server runtime.',
  'sentry.edge.config.ts': 'Sentry initialisation for the Edge runtime.',
  'pre-commit': 'Husky Git pre-commit hook.',
  LICENSE: 'Project software license.',
  'quality-dashboard.html':
    'Generated HTML quality dashboard (security, coverage and lint metrics).',
  'quality-dashboard.json': 'Generated quality-dashboard data consumed to build the HTML report.',
  'README.md': 'Project overview and getting-started documentation.',
  'SETUP.md': 'Environment and tooling setup instructions.',
};

const TYPE_TAG_RE = /^@\w+/; // JSDoc tag-only lines like "@type {...}" carry no prose

/** Produce a single-sentence description for a file. */
function describe(relPath, name, raw) {
  const ext = ext_of(name);

  if (ext === 'md' || ext === 'mdx') {
    const d = fromMarkdown(raw);
    if (d) {
      return d;
    }
  }
  if (name === 'package.json') {
    const d = jsonField(raw, 'description');
    if (d) {
      return d;
    }
  }
  if (ext === 'sarif') {
    const d = fromSarif(raw);
    if (d) {
      return d;
    }
  }

  const prose = leadingComment(raw, ext);
  if (prose) {
    return prose;
  }

  if (CURATED[name]) {
    return CURATED[name];
  }

  const code = fromCode(relPath, name, ext, raw);
  if (code) {
    return code;
  }

  return humanize(relPath, ext);
}

function firstSentence(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) {
    return '';
  }
  const m = clean.match(/^(.+?[.!?])(\s|$)/);
  let s = (m ? m[1] : clean).trim();
  if (s.length > 200) {
    s = s.slice(0, 197).trimEnd() + '…';
  }
  return s;
}

function fromMarkdown(raw) {
  // YAML frontmatter: prefer a human tagline / description / title.
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fm) {
    for (const key of ['tagline', 'description', 'summary', 'name', 'title']) {
      const m = fm[1].match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
      if (m) {
        const v = m[1]
          .trim()
          .replace(/^['"]|['"]$/g, '')
          .trim();
        if (v) {
          return firstSentence(v);
        }
      }
    }
  }
  const body = fm ? raw.slice(fm[0].length) : raw;
  const h1 = body.match(/^#\s+(.+)$/m);
  const para = body
    .replace(/^#{1,6}\s+.*$/gm, '')
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .find((p) => p && !p.startsWith('<') && !p.startsWith('|') && !p.startsWith('```'));
  if (h1 && para) {
    return firstSentence(`${h1[1]} — ${para}`);
  }
  if (para) {
    return firstSentence(para);
  }
  if (h1) {
    return firstSentence(h1[1]);
  }
  return '';
}

function leadingComment(raw, ext) {
  let s = raw.replace(/^﻿/, '');
  if (s.startsWith('#!')) {
    s = s.slice(s.indexOf('\n') + 1);
  } // drop shebang
  s = s.replace(/^\s+/, '');

  let text = '';
  if (s.startsWith('/*')) {
    const end = s.indexOf('*/');
    if (end === -1) {
      return '';
    }
    text = s
      .slice(2, end)
      .replace(/^\*+/, '')
      .replace(/^\s*\*[ \t]?/gm, '');
  } else if (s.startsWith('//')) {
    const lines = [];
    for (const line of s.split(/\r?\n/)) {
      const t = line.trim();
      if (t.startsWith('//')) {
        lines.push(t.replace(/^\/\/+\s?/, ''));
      } else {
        break;
      }
    }
    text = lines.join(' ');
  } else if ((ext === 'html' || ext === 'md') && s.startsWith('<!--')) {
    const end = s.indexOf('-->');
    if (end !== -1) {
      text = s.slice(4, end);
    }
  } else if (['yml', 'yaml', 'sh'].includes(ext) && s.startsWith('#')) {
    const lines = [];
    for (const line of s.split(/\r?\n/)) {
      const t = line.trim();
      if (t.startsWith('#')) {
        lines.push(t.replace(/^#+\s?/, ''));
      } else {
        break;
      }
    }
    text = lines.join(' ');
  }

  // Drop JSDoc tag-only lines (@type, @param …) — they aren't a description.
  const prose = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !TYPE_TAG_RE.test(l))
    .join(' ');
  return prose ? firstSentence(prose) : '';
}

function fromSarif(raw) {
  try {
    const j = JSON.parse(raw);
    const run = j.runs?.[0];
    const tool = run?.tool?.driver?.name ?? 'unknown tool';
    const n = run?.results?.length ?? 0;
    return `SARIF static-analysis report from ${tool} — ${n} result${n === 1 ? '' : 's'}.`;
  } catch {
    return 'SARIF static-analysis report.';
  }
}

function jsonField(raw, field) {
  try {
    const v = JSON.parse(raw)[field];
    return typeof v === 'string' ? firstSentence(v) : '';
  } catch {
    return '';
  }
}

function fromCode(relPath, name, ext, raw) {
  if (!['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
    return '';
  }
  const base = name.replace(/\.\w+$/, '');

  if (/\/app\/api\/.*\/route\.tsx?$/.test(relPath) || name === 'route.ts') {
    const verbs = [
      ...raw.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/g),
    ].map((m) => m[1]);
    return `API route handler${verbs.length ? ` (${[...new Set(verbs)].join(', ')})` : ''}.`;
  }
  if (name === 'page.tsx') {
    return `Next.js page for the ${path.dirname(relPath).split('/').pop()} route.`;
  }
  if (name === 'layout.tsx') {
    return 'Next.js layout wrapper for its route segment.';
  }
  if (ext === 'test.ts' || /\.(test|spec)\.[jt]sx?$/.test(name)) {
    return `Test suite for ${base.replace(/\.(test|spec)$/, '')}.`;
  }

  const exp =
    raw.match(/export\s+default\s+function\s+(\w+)/)?.[1] ||
    raw.match(/export\s+(?:async\s+)?function\s+(\w+)/)?.[1] ||
    raw.match(/export\s+const\s+(\w+)\s*[:=]/)?.[1] ||
    raw.match(/export\s+(?:abstract\s+)?class\s+(\w+)/)?.[1];

  if (ext === 'tsx' || ext === 'jsx') {
    const dir = path.dirname(relPath).split('/').pop();
    return `React ${dir && dir !== 'components' ? `${dir} ` : ''}component${exp ? ` \`${exp}\`` : ` \`${base}\``}.`;
  }
  if (exp) {
    return `Defines \`${exp}\`.`;
  }
  return '';
}

function humanize(relPath, ext) {
  const parent = path
    .dirname(relPath)
    .split('/')
    .filter((p) => p && p !== '.')
    .pop();
  const kind = ext === 'json' ? 'data/config' : ext === 'css' ? 'stylesheet' : ext || 'file';
  return parent ? `${kind} in ${parent}/.` : `${kind} file.`;
}

/* ------------------------------------------------------------------ render */

const LANG = {
  ts: 'TypeScript',
  tsx: 'TSX',
  js: 'JavaScript',
  jsx: 'JSX',
  mjs: 'ESM',
  cjs: 'CommonJS',
  json: 'JSON',
  css: 'CSS',
  scss: 'SCSS',
  md: 'Markdown',
  mdx: 'MDX',
  yml: 'YAML',
  yaml: 'YAML',
  sql: 'SQL',
  html: 'HTML',
  txt: 'Text',
  sarif: 'SARIF',
  sh: 'Shell',
};

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

function fmtBytes(n) {
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const slug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Build a nested {dirs, files} tree from flat relative paths. */
function buildTree(files) {
  const root = { dirs: new Map(), files: [] };
  for (const rel of files) {
    const parts = rel.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.dirs.has(parts[i])) {
        node.dirs.set(parts[i], { dirs: new Map(), files: [] });
      }
      node = node.dirs.get(parts[i]);
    }
    node.files.push({ name: parts[parts.length - 1], rel });
  }
  return root;
}

function countFiles(node) {
  let n = node.files.length;
  for (const child of node.dirs.values()) {
    n += countFiles(child);
  }
  return n;
}

function renderNode(node, meta, depth = 0) {
  let html = '';
  const dirNames = [...node.dirs.keys()].sort();
  for (const dn of dirNames) {
    const child = node.dirs.get(dn);
    html +=
      `<details class="dir" ${depth < 1 ? 'open' : ''}>` +
      `<summary><span class="folder">📁 ${esc(dn)}</span>` +
      `<span class="count">${countFiles(child)}</span></summary>` +
      `<div class="dir-body">${renderNode(child, meta, depth + 1)}</div></details>`;
  }
  for (const f of node.files.sort((a, b) => a.name.localeCompare(b.name))) {
    const m = meta.get(f.rel);
    html +=
      `<details class="file" id="${slug(f.rel)}" data-path="${esc(f.rel.toLowerCase())}" data-desc="${esc(m.desc.toLowerCase())}">` +
      `<summary><span class="fname">${esc(f.name)}</span>` +
      `<span class="fdesc">${esc(m.desc)}</span>` +
      `<span class="badge">${LANG[ext_of(f.name)] ?? ext_of(f.name) ?? 'file'}</span>` +
      `<span class="size">${fmtBytes(m.bytes)}</span></summary>` +
      `<pre><code>${m.body}</code></pre></details>`;
  }
  return html;
}

/* -------------------------------------------------------------------- main */

/**
 * Generate the bundle and return its stats.
 * @param {string} [outFile] output path, relative to the repo root or absolute.
 * @returns {Promise<{outFile: string, fileCount: number, totalBytes: number, htmlBytes: number}>}
 */
export async function bundleCodebase(outFile = 'dist/reports/codebase-bundle.html') {
  OUT = path.resolve(ROOT, outFile);
  const files = await collect();
  const meta = new Map();
  let totalBytes = 0;

  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    let raw = await fs.readFile(abs, 'utf8');
    const bytes = Buffer.byteLength(raw, 'utf8');
    totalBytes += bytes;
    const desc = describe(rel, path.basename(rel), raw);
    let truncated = false;
    if (raw.length > MAX_BYTES) {
      raw = raw.slice(0, MAX_BYTES);
      truncated = true;
    }
    const body = esc(raw) + (truncated ? '\n\n… [truncated — file exceeds display limit] …' : '');
    meta.set(rel, { desc, bytes, body });
  }

  const tree = buildTree(files);
  const generated = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const projectName =
    JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8')).name ?? 'project';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(projectName)} — codebase bundle</title>
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#1f2328; --muted:#656d76; --line:#d0d7de;
    --code-bg:#f6f8fa; --accent:#0969da; --badge:#ddf4ff; --badge-fg:#0969da; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0d1117; --fg:#e6edf3; --muted:#8b949e; --line:#30363d;
      --code-bg:#161b22; --accent:#58a6ff; --badge:#10243e; --badge-fg:#58a6ff; } }
  * { box-sizing: border-box; }
  body { margin:0; font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    color:var(--fg); background:var(--bg); }
  header { position:sticky; top:0; z-index:5; background:var(--bg); border-bottom:1px solid var(--line);
    padding:14px 20px; display:flex; flex-wrap:wrap; gap:12px; align-items:center; }
  header h1 { font-size:16px; margin:0; }
  header .stats { color:var(--muted); font-size:12px; }
  header .spacer { flex:1; }
  #q { padding:6px 10px; border:1px solid var(--line); border-radius:6px; background:var(--code-bg);
    color:var(--fg); width:240px; }
  button { padding:6px 10px; border:1px solid var(--line); border-radius:6px; background:var(--code-bg);
    color:var(--fg); cursor:pointer; }
  button:hover { border-color:var(--accent); }
  main { padding:16px 20px 80px; }
  details.dir { margin:2px 0; }
  details.dir > summary { font-weight:600; cursor:pointer; padding:3px 4px; border-radius:6px; }
  details.dir > summary:hover { background:var(--code-bg); }
  .dir-body { margin-left:18px; border-left:1px solid var(--line); padding-left:10px; }
  .count { color:var(--muted); font-weight:400; font-size:11px; margin-left:8px;
    background:var(--code-bg); padding:0 6px; border-radius:10px; }
  details.file { margin:1px 0; }
  details.file > summary { cursor:pointer; padding:4px 6px; border-radius:6px; display:flex;
    gap:10px; align-items:baseline; list-style:none; }
  details.file > summary::-webkit-details-marker { display:none; }
  details.file > summary:hover { background:var(--code-bg); }
  .fname { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--accent); white-space:nowrap; }
  .fdesc { color:var(--muted); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .badge { font-size:11px; background:var(--badge); color:var(--badge-fg); padding:0 6px;
    border-radius:10px; white-space:nowrap; }
  .size { font-size:11px; color:var(--muted); white-space:nowrap; }
  pre { background:var(--code-bg); border:1px solid var(--line); border-radius:8px; padding:12px;
    overflow:auto; margin:4px 0 10px; }
  code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12.5px; white-space:pre; }
  .hidden { display:none !important; }
</style>
</head>
<body>
<header>
  <h1>📦 ${esc(projectName)}</h1>
  <span class="stats">${files.length} files · ${fmtBytes(totalBytes)} · ${generated}</span>
  <span class="spacer"></span>
  <input id="q" type="search" placeholder="filter by path or description…" autocomplete="off">
  <button id="expand">Expand all</button>
  <button id="collapse">Collapse all</button>
</header>
<main id="tree">
${renderNode(tree, meta)}
</main>
<script>
  const q = document.getElementById('q');
  const files = [...document.querySelectorAll('details.file')];
  const dirs = [...document.querySelectorAll('details.dir')];
  q.addEventListener('input', () => {
    const term = q.value.trim().toLowerCase();
    for (const f of files) {
      const hit = !term || f.dataset.path.includes(term) || f.dataset.desc.includes(term);
      f.classList.toggle('hidden', !hit);
    }
    for (const d of dirs) {
      const anyVisible = [...d.querySelectorAll('details.file')].some((f) => !f.classList.contains('hidden'));
      d.classList.toggle('hidden', term && !anyVisible);
      if (term && anyVisible) d.open = true;
    }
  });
  document.getElementById('expand').onclick = () => document.querySelectorAll('details').forEach((d) => (d.open = true));
  document.getElementById('collapse').onclick = () =>
    document.querySelectorAll('details.file, details.dir').forEach((d) => (d.open = false));
</script>
</body>
</html>`;

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, html, 'utf8');
  return {
    outFile: OUT,
    fileCount: files.length,
    totalBytes,
    htmlBytes: Buffer.byteLength(html),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  bundleCodebase(process.argv[2])
    .then((r) => {
      console.log(
        `✓ Wrote ${path.relative(ROOT, r.outFile)} — ${r.fileCount} files, ${fmtBytes(r.htmlBytes)}`,
      );
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
