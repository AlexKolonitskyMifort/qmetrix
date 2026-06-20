/**
 * Component composition — browser-window pages + nested-rectangle containment.
 *
 * Three coordinated views from collectComposition():
 *   1. Page flow — a compact layered graph of the app's pages (mini browser
 *      windows keyed by URL) with arrows for the content navigation between them
 *      (drawn client-side by COMPOSITION_FLOW_SCRIPT from the injected edge data).
 *   2. Page composition — every page as a real browser window (chrome + address
 *      bar) whose feature components are *physically* nested inside it, box-in-box.
 *   3. Unattached — feature components no page reaches.
 *
 * The name + one-line description show always; props / state / events / public API
 * live inside a <details> the visitor expands. Design-system widgets from
 * src/common are not shown — see the collector header.
 */
import { esc, num } from '../utils/format.mjs';

const ROLE_LABEL = {
  page: 'page',
  layout: 'layout',
  app: 'app',
  public: 'public',
  internal: 'internal',
};

const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const locLabel = (d) =>
  d.layer === 'app' ? d.rel.replace(/^src\//, '') : `features/${d.feature} · ${d.file}`;

const LOCK = `<svg class="comp-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;

function metaHtml(d) {
  const props = d.props.length
    ? d.props
        .map(
          (p) =>
            `<code>${esc(p.name)}</code>${p.type ? `<span class="comp-ty">: ${esc(trunc(p.type, 44))}</span>` : ''}`,
        )
        .join('<span class="comp-sep">,</span> ')
    : '<span class="muted">none</span>';

  const state = d.state.length
    ? d.state
        .map((s) => `<code>${esc(s.name)}</code><span class="comp-hk">${esc(s.hook)}</span>`)
        .join(' ')
    : '<span class="muted">stateless</span>';

  const evParts = [
    ...d.events.callbacks.map((c) => `<code>${esc(c)}</code>`),
    ...d.events.tracked.map((t) => `<span class="comp-ev">${esc(t)}</span>`),
  ];
  const events = evParts.length ? evParts.join(' ') : '<span class="muted">none</span>';

  let api;
  if (d.layer === 'app') {
    api = '<span class="muted">route · default export</span>';
  } else {
    const tag = d.public
      ? '<span class="comp-ev">public · index.ts</span>'
      : '<span class="muted">internal</span>';
    const ex = d.exports.filter((e) => e !== 'default' && e !== d.name);
    api = `${tag}${ex.length ? ` <span class="comp-ty">+ ${ex.map(esc).join(', ')}</span>` : ''}`;
  }

  const row = (k, v) =>
    `<div class="comp-mrow"><span class="comp-mk">${k}</span><span class="comp-mv">${v}</span></div>`;
  return `<div class="comp-meta">${row('Props', props)}${row('State', state)}${row('Events', events)}${row('Public&nbsp;API', api)}</div>`;
}

/**
 * Compact page-flow graph: only the pages that take part in a transition are laid
 * out as layered mini browser windows (BFS distance from `/`); pages no content
 * link reaches are listed compactly below instead of stretching an empty row.
 * Render order == DOM order of `.cflow-node` == the edge indices in the JSON data.
 */
function flowHtml(t, host) {
  if (!t || !t.edges.length) {
    return '';
  }
  const graphNodes = t.nodes.filter((n) => n.inCount + n.outCount > 0);
  const orphans = t.nodes.filter((n) => n.inCount + n.outCount === 0);
  const idToIdx = new Map(graphNodes.map((n, i) => [n.id, i]));
  const layers = [];
  graphNodes.forEach((n) => {
    (layers[n.layer] ||= []).push(n);
  });
  const url = (route) => `${esc(host)}${esc(route === '/' ? '/' : route)}`;
  const node = (n, i) =>
    `<div class="cflow-node" data-idx="${i}">
      <div class="cflow-chrome"><span class="cflow-dots"><i></i><i></i><i></i></span><span class="cflow-url">${url(n.route)}</span></div>
      <div class="cflow-meta"><span class="cflow-comp">${esc(n.component)}</span><span class="cflow-deg">in ${n.inCount} · out ${n.outCount}</span></div>
    </div>`;
  const rows = layers
    .filter(Boolean)
    .map(
      (row) =>
        `<div class="cflow-row">${row.map((n) => node(n, idToIdx.get(n.id))).join('')}</div>`,
    )
    .join('');
  const pairs = t.edges
    .map((e) => [idToIdx.get(e.from), idToIdx.get(e.to)])
    .filter((p) => p[0] != null && p[1] != null);
  const data = JSON.stringify(pairs).replace(/</g, '\\u003c');
  const svg = `<svg class="cflow-svg" id="cflow-svg" xmlns="http://www.w3.org/2000/svg"><defs><marker id="cflow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#3f6fb0"/></marker></defs></svg>`;
  const orphanHtml = orphans.length
    ? `<div class="cflow-orphans"><span class="muted">${orphans.length} page(s) with no content links (reached via global nav only):</span> ${orphans.map((n) => `<span class="cflow-orphan">${url(n.route)}</span>`).join('')}</div>`
    : '';
  return `<h3 class="comp-subh">Page flow <span class="muted">— ${t.edges.length} content transition(s)</span></h3>
    <div class="cflow-wrap"><div class="cflow" id="cflow">${svg}<div class="cflow-layers">${rows}</div></div></div>
    ${orphanHtml}
    <script id="comp-flow-data" type="application/json">${data}</script>`;
}

export function compositionGraphHtml(comp) {
  if (!comp || !comp.available) {
    return `<p class="muted">No app routes or feature components found.</p>`;
  }
  const C = comp.components;
  const host = comp.host || '';

  const linksHtml = (d) =>
    d.links && d.links.length
      ? `<span class="comp-links">${d.links.map((l) => `<span class="comp-link">${esc(l)}</span>`).join('')}</span>`
      : '';

  const cardHtml = (d) => `<details class="comp-card">
      <summary class="comp-sum">
        <span class="comp-name">${esc(d.component || d.name)}</span>
        <span class="comp-badge role-${esc(d.role)}">${ROLE_LABEL[d.role] || d.role}</span>
        <span class="comp-loc">${esc(locLabel(d))}</span>
        ${d.description ? `<span class="comp-desc">${esc(d.description)}</span>` : ''}
        ${linksHtml(d)}
      </summary>
      ${metaHtml(d)}
    </details>`;

  // A page root → a browser window; its rendered components nest inside the body.
  const winBox = (d, nest) => {
    const url = `${host}${d.name === '/' ? '/' : d.name}`;
    return `<div class="comp-box role-page comp-win" data-rid="${esc(d.id)}">
      <div class="comp-winbar">
        <span class="comp-dots"><i></i><i></i><i></i></span>
        <span class="comp-addr">${LOCK}<span class="comp-addr-url">${esc(url)}</span></span>
      </div>
      <div class="comp-winbody">${cardHtml(d)}${nest}</div>
    </div>`;
  };

  const box = (node) => {
    const d = C[node.id];
    if (!d) {
      return '';
    }
    if (node.cycle) {
      return `<div class="comp-box role-${esc(d.role)} is-cycle"><div class="comp-cyc"><span class="comp-name">${esc(d.component || d.name)}</span><span class="comp-tag">↺ shown above</span></div></div>`;
    }
    const kids = (node.children || []).map(box).join('');
    const nest = kids ? `<div class="comp-nest">${kids}</div>` : '';
    if (d.kind === 'page') {
      return winBox(d, nest);
    }
    return `<div class="comp-box role-${esc(d.role)}">${cardHtml(d)}${nest}</div>`;
  };

  const s = comp.stats;
  const summary = `<p class="muted">${s.pages} page(s) shown as browser windows, each physically nesting the feature components it renders (box-in-box) across ${s.features.length} feature(s) · ${num(s.boxes)} box(es). Arrows in <strong>Page flow</strong> trace content navigation between pages. Click a box for its props, state, events &amp; public API. Design-system widgets from <code>src/common</code> are omitted.</p>`;

  const legend = `<div class="comp-legend">
    <span class="sw"><i class="role-page"></i>page · browser window</span>
    <span class="sw"><i class="role-layout"></i>layout</span>
    <span class="sw"><i class="role-public"></i>feature public API</span>
    <span class="sw"><i class="role-internal"></i>feature internal</span>
    <span class="sw"><b class="comp-leg-arrow">→</b> page transition</span>
  </div>`;

  const controls = `<div class="comp-controls">
    <button type="button" data-comp-toggle="open">Expand all</button>
    <button type="button" data-comp-toggle="close">Collapse all</button>
  </div>`;

  const flow = flowHtml(comp.transitions, host);

  const tree = `<h3 class="comp-subh">Page composition</h3><div class="comp-scroll"><div class="comp-tree">${comp.roots.map(box).join('')}</div></div>`;

  const unattached = comp.unattached.length
    ? `<details class="comp-unattached"><summary>${comp.unattached.length} feature component(s) not reached from any page</summary>
       <div class="comp-scroll"><div class="comp-tree">${comp.unattached.map(box).join('')}</div></div></details>`
    : '';

  return `${summary}${legend}${flow}${controls}${tree}${unattached}`;
}
