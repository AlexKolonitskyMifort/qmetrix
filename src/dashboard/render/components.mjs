/** Reusable HTML fragment builders (cards, gauges, expandable trees, ER boxes). */
import { esc, pct } from '../utils/format.mjs';

const SEV_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#0891b2',
  note: '#64748b',
};

export function sevBadges(sev) {
  return (
    Object.entries(SEV_COLORS)
      .filter(([k]) => (sev[k] || 0) > 0)
      .map(([k, c]) => `<span class="sev" style="--c:${c}">${sev[k]} ${k}</span>`)
      .join(' ') || '<span class="sev" style="--c:#16a34a">0 findings</span>'
  );
}

/** Per-finding "why it's flagged" list (Snyk/CodeQL/etc.), severity-led. */
function findingsList(reports) {
  const all = reports.flatMap((r) => r.findings || []);
  if (!all.length) {
    return '';
  }
  const rows = all
    .map((f) => {
      const c = SEV_COLORS[f.severity] || SEV_COLORS.note;
      const where = f.where ? ` <code>${esc(f.where)}</code>` : '';
      const detail = f.detail ? `<div class="fd muted">${esc(f.detail)}</div>` : '';
      return `<li><span class="sev" style="--c:${c}">${esc(f.severity)}</span> <span class="fr">${esc(f.reason || f.rule || '—')}</span>${where}${detail}</li>`;
    })
    .join('');
  return `<details open class="sec-findings"><summary>Why these are flagged (${all.length})</summary><ul class="findings">${rows}</ul></details>`;
}

export function scannerCard(s) {
  let status, body;
  if (s.reports && s.reports.length) {
    const totals = { critical: 0, high: 0, medium: 0, low: 0, note: 0 };
    let total = 0;
    for (const r of s.reports) {
      total += r.total || 0;
      for (const k of Object.keys(totals)) {
        totals[k] += r.sev?.[k] || 0;
      }
    }
    status = `<span class="badge ok">local report · ${total} findings</span>`;
    body = `
      <div class="sevrow">${sevBadges(totals)}</div>
      <table class="mini"><thead><tr><th>Artifact</th><th>Driver</th><th class="r">Findings</th></tr></thead><tbody>
      ${s.reports.map((r) => `<tr><td><code>${esc(r.file)}</code></td><td>${esc(r.driver || '—')}</td><td class="r">${r.total}</td></tr>`).join('')}
      </tbody></table>
      ${findingsList(s.reports)}`;
  } else if (s.report) {
    status = `<span class="badge ok">local scan</span>`;
    body = `<p class="muted">Project key <code>${esc(s.projectKey || '')}</code> — last local scan report found.</p>`;
  } else {
    status = `<span class="badge warn">configured · runs in CI</span>`;
    body = `<p class="muted">No local SARIF artifact. This scanner runs server-side in GitHub Actions${
      s.workflow ? '' : ' (workflow missing!)'
    } and publishes to its dashboard. Download a run artifact next to this script to surface findings here.</p>`;
  }
  const links = [
    s.ci ? `<a href="${s.ci}" target="_blank" rel="noopener">GitHub Security ↗</a>` : null,
    s.dashboard
      ? `<a href="${s.dashboard}" target="_blank" rel="noopener">Vendor dashboard ↗</a>`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return `
    <div class="card scanner">
      <div class="card-h"><h3>${esc(s.name)}</h3>${status}</div>
      <p class="tool">${esc(s.tool)}</p>
      ${body}
      <div class="links">${links}</div>
    </div>`;
}

export function bar(label, value) {
  const v = value == null ? 0 : value;
  const c = v >= 80 ? '#16a34a' : v >= 50 ? '#d97706' : '#dc2626';
  return `
    <div class="gauge">
      <div class="gauge-h"><span>${label}</span><strong>${pct(value)}</strong></div>
      <div class="track"><div class="fill" style="width:${v}%;background:${c}"></div></div>
    </div>`;
}

/* ── file relationship tree (grouped by folder, expandable) ── */
export function fileTreeHtml(graphData) {
  const { nodes, edges } = graphData;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const importsOf = new Map();
  const importedByOf = new Map();
  const push = (map, k, v) => (map.get(k) || map.set(k, []).get(k)).push(v);
  for (const e of edges) {
    push(importsOf, e.source, e.target);
    push(importedByOf, e.target, e.source);
  }

  const root = { dirs: new Map(), files: [] };
  for (const n of nodes) {
    const parts = n.label.split('/');
    parts.pop();
    let cur = root;
    for (const p of parts) {
      if (!cur.dirs.has(p)) {
        cur.dirs.set(p, { dirs: new Map(), files: [] });
      }
      cur = cur.dirs.get(p);
    }
    cur.files.push(n);
  }
  const count = (node) => {
    let c = node.files.length;
    for (const d of node.dirs.values()) {
      c += count(d);
    }
    return c;
  };
  const labels = (ids) =>
    (ids || [])
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label));
  const fileRow = (n) => {
    const fname = n.label.split('/').pop();
    const badges = `<span class="fan in" title="imported by ${n.fanIn} module(s)">in ${n.fanIn}</span><span class="fan out" title="imports ${n.fanOut} module(s)">out ${n.fanOut}</span>`;
    const imps = labels(importsOf.get(n.id));
    const impd = labels(importedByOf.get(n.id));
    if (!imps.length && !impd.length) {
      return `<div class="tree-file"><span class="ico">📄</span><code>${esc(fname)}</code> ${badges}</div>`;
    }
    const rel = (head, arr) =>
      arr.length
        ? `<div class="rel"><span class="muted">${head}</span> ${arr.map((x) => `<code>${esc(x.label)}</code>`).join(' ')}</div>`
        : '';
    return `<details class="tree-file det"><summary><span class="ico">📄</span><code>${esc(fname)}</code> ${badges}</summary><div class="tree-body">${rel('imports →', imps)}${rel('imported by ←', impd)}</div></details>`;
  };
  const dirRow = (node, name, depth) => {
    const inner =
      [...node.dirs.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([dn, dnode]) => dirRow(dnode, dn, depth + 1))
        .join('') +
      node.files
        .sort((a, b) => a.label.localeCompare(b.label))
        .map(fileRow)
        .join('');
    if (name == null) {
      return inner;
    }
    return `<details class="tree-dir"${depth < 1 ? ' open' : ''}><summary><span class="ico">📁</span>${esc(name)} <span class="muted">(${count(node)})</span></summary><div class="tree-body">${inner}</div></details>`;
  };
  return dirRow(root, null, 0);
}

/* ── Next.js routing tree (expandable) ── */
export function routingHtml(routing) {
  if (!routing.available) {
    return `<p class="muted">No <code>src/app</code> directory found.</p>`;
  }
  const kindColor = {
    page: '#22c55e',
    layout: '#1377FE',
    route: '#a855f7',
    loading: '#06b6d4',
    error: '#ef4444',
    'global-error': '#ef4444',
    'not-found': '#f59e0b',
    template: '#64748b',
    default: '#64748b',
  };
  const node = (n, depth, isRoot) => {
    const segHtml = isRoot
      ? `<span class="seg">app</span> <code class="url">/</code>`
      : n.group
        ? `<span class="seg group">${esc(n.seg)}</span>`
        : n.dynamic
          ? `<span class="seg dyn">${esc(n.seg)}</span>`
          : `<span class="seg">${esc(n.seg)}</span>`;
    const urlChip =
      !isRoot && (n.kinds.includes('page') || n.kinds.includes('route'))
        ? ` <code class="url">${esc(n.url || '/')}</code>`
        : '';
    const badges = n.kinds
      .map((k) => `<span class="rt" style="--c:${kindColor[k] || '#64748b'}">${k}</span>`)
      .join(' ');
    const head = `${segHtml}${urlChip} ${badges}`;
    if (!n.children.length) {
      return `<div class="rt-leaf">${head}</div>`;
    }
    return `<details class="rt-dir"${depth < 2 ? ' open' : ''}><summary>${head}</summary><div class="tree-body">${n.children.map((c) => node(c, depth + 1, false)).join('')}</div></details>`;
  };
  return node(routing.root, 0, true);
}

/* ── data model / ER diagram ── */
export function entitiesHtml(entities) {
  if (!entities.available || (!entities.tables.length && !entities.buckets.length)) {
    return `<p class="muted">No SQL migrations found under <code>supabase/migrations</code>.</p>`;
  }
  const keyBadge = (c) =>
    c.pk
      ? `<span class="kb pk" title="primary key">PK</span>`
      : c.fk
        ? `<span class="kb fk" title="references ${esc(c.fk.table)}">FK</span>`
        : '';
  const tableBox = (t) => `
    <div class="er-table">
      <div class="er-h">${esc(t.name)}${t.rls ? `<span class="er-rls" title="row level security enabled">RLS</span>` : ''}</div>
      <table class="er-cols"><tbody>
      ${t.columns
        .map(
          (c) => `<tr>
        <td class="er-k">${keyBadge(c)}</td>
        <td class="er-c">${esc(c.name)}${c.notnull && !c.pk ? '<span class="req" title="NOT NULL">*</span>' : ''}</td>
        <td class="er-t">${esc(c.type)}</td>
      </tr>`,
        )
        .join('')}
      </tbody></table>
      ${t.indexes.length ? `<div class="er-idx">${t.indexes.map((i) => `<span title="(${esc(i.cols)})">⚲ ${esc(i.name)}</span>`).join(' ')}</div>` : ''}
    </div>`;
  const bucketBox = (b) => `
    <div class="er-table bucket">
      <div class="er-h">🗄 ${esc(b.name)}<span class="er-rls ${b.public ? 'pub' : ''}">${b.public ? 'public' : 'private'}</span></div>
      <div class="er-bk">storage bucket</div>
    </div>`;
  const rels = entities.tables.flatMap((t) =>
    t.columns
      .filter((c) => c.fk)
      .map(
        (c) =>
          `<code>${esc(t.name)}.${esc(c.name)}</code> → <code>${esc(c.fk.table)}${c.fk.col ? '.' + esc(c.fk.col) : ''}</code>`,
      ),
  );
  return `
    <div class="er-canvas">
      ${entities.tables.map(tableBox).join('')}
      ${entities.buckets.map(bucketBox).join('')}
    </div>
    ${rels.length ? `<div class="er-rels"><span class="muted">Relationships:</span> ${rels.join(' · ')}</div>` : ''}`;
}
