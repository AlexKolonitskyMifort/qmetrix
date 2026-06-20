/** Dashboard CSS — the full <style> body, kept apart from the markup builders. */

/** Primary brand colour, used as the CSS accent variable. */
export const BRAND = '#1377FE';

export const STYLES = `
  :root{--brand:${BRAND};--bg:#0b1120;--panel:#111a2e;--panel2:#0e1626;--line:#1e2a44;--ink:#e6edf7;--muted:#8aa0c2;--ok:#16a34a;--warn:#d97706;--bad:#dc2626}
  *{box-sizing:border-box}
  body{margin:0;font:14px/1.55 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:var(--bg);color:var(--ink)}
  a{color:#5ea2ff;text-decoration:none}a:hover{text-decoration:underline}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;color:#bcd2f5;background:#0c1424;padding:1px 5px;border-radius:5px}
  pre{background:#0c1424;border:1px solid var(--line);border-radius:8px;padding:10px;overflow:auto;font-size:12px;color:#cdd9ee}
  header{padding:28px 32px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#0e1730,#0b1120)}
  header h1{margin:0 0 4px;font-size:22px}
  header .sub{color:var(--muted);font-size:13px}
  .wrap{max-width:1180px;margin:0 auto;padding:24px 32px 60px}
  .chips{display:flex;flex-wrap:wrap;gap:12px;margin:22px 0 6px}
  .chip{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 16px;min-width:120px}
  .chip span{display:block;font-size:24px;font-weight:700;line-height:1.1}
  .chip label{display:block;color:var(--muted);font-size:12px;margin-top:2px}
  .chip.good span{color:#4ade80}.chip.bad span{color:#f87171}.chip.warn span{color:#fbbf24}
  h2{font-size:15px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:34px 0 12px;border-bottom:1px solid var(--line);padding-bottom:8px}
  .grid{display:grid;gap:16px}
  .grid.two{grid-template-columns:1fr 1fr}
  .grid.three{grid-template-columns:1fr 1fr 1fr}
  .grid.scanners{grid-template-columns:1fr 1fr 1fr}
  @media(max-width:980px){.grid.three{grid-template-columns:1fr}}
  @media(max-width:820px){.grid.two,.grid.scanners{grid-template-columns:1fr}}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
  .card-h{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .card h3{margin:0;font-size:15px}
  .tool{color:var(--muted);font-size:12px;margin:2px 0 12px}
  table.mini{width:100%;border-collapse:collapse;margin-top:8px;font-size:12.5px}
  table.mini th{ text-align:left;color:var(--muted);font-weight:600;border-bottom:1px solid var(--line);padding:6px 8px}
  table.mini td{padding:5px 8px;border-bottom:1px solid #16203a}
  table.mini td.r,table.mini th.r{text-align:right}
  .muted{color:var(--muted)}
  .ok-msg{color:#4ade80;font-weight:600}.bad-msg{color:#f87171;font-weight:600}
  .sevrow{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
  .sev{background:color-mix(in srgb,var(--c) 18%,transparent);color:var(--c);border:1px solid color-mix(in srgb,var(--c) 40%,transparent);border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600}
  .badge{font-size:11px;font-weight:700;border-radius:999px;padding:3px 10px;white-space:nowrap}
  .badge.ok{background:rgba(22,163,74,.18);color:#4ade80;border:1px solid rgba(22,163,74,.4)}
  .badge.warn{background:rgba(217,119,6,.16);color:#fbbf24;border:1px solid rgba(217,119,6,.4)}
  /* security scanner — per-finding "why it's flagged" list */
  .sec-findings{margin-top:10px}
  .sec-findings>summary{color:var(--muted)}
  ul.findings{list-style:none;margin:8px 0 0;padding:0;font-size:12.5px}
  ul.findings li{padding:6px 0;border-top:1px solid #16203a;display:flex;flex-wrap:wrap;align-items:center;gap:6px}
  ul.findings li:first-child{border-top:0}
  ul.findings .fr{color:#dbe6f8}
  ul.findings .fd{flex-basis:100%;font-size:11.5px;margin-top:1px}
  .gauge{margin:10px 0}
  .gauge-h{display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px}
  .track{height:9px;background:#0c1424;border-radius:999px;overflow:hidden}
  .fill{height:100%;border-radius:999px;transition:width .6s}
  details{margin-top:10px}summary{cursor:pointer;color:var(--muted);font-size:12.5px}
  .links{margin-top:12px;font-size:12.5px;color:var(--muted)}
  /* coverage section — compact, ~1/3 width */
  .cov-card{max-width:380px}
  /* eslint problem detail */
  .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}
  .dot.e{background:var(--bad)}.dot.w{background:var(--warn)}
  table.problems td.msg{color:#cdd9ee;white-space:normal}
  table.problems td:first-child{white-space:nowrap}
  /* dependency table + filters */
  .filters{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-bottom:12px;font-size:12.5px}
  .filters .seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
  .filters .seg button{background:transparent;color:var(--ink);border:0;border-right:1px solid var(--line);padding:5px 12px;cursor:pointer;font:inherit}
  .filters .seg button:last-child{border-right:0}
  .filters .seg button.on{background:var(--brand);color:#fff}
  .filters label{display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none}
  .filters input[type=search]{background:#0c1424;border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:5px 10px;font:inherit;min-width:160px}
  #dep-count{margin-left:auto}
  .tablewrap{overflow-x:auto}
  table.deps td{vertical-align:top}
  table.deps td.desc{color:var(--muted);max-width:300px;white-space:normal}
  table.deps td.why{max-width:280px;white-space:normal}
  table.deps td.when,table.deps td.ver{white-space:nowrap}
  .tag{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;border-radius:5px;padding:1px 6px;vertical-align:middle}
  .tag.prod{background:rgba(19,119,254,.16);color:#7db4ff;border:1px solid rgba(19,119,254,.4)}
  .tag.dev{background:rgba(168,85,247,.16);color:#c89bf5;border:1px solid rgba(168,85,247,.4)}
  .tag.task{background:rgba(100,116,139,.18);color:#a7b6cf;border:1px solid rgba(100,116,139,.4);text-transform:none;font-weight:600}
  .imp{font-size:10px;color:#4ade80;border:1px solid rgba(22,163,74,.4);border-radius:5px;padding:1px 5px}
  .upd{color:#fbbf24;font-weight:600}
  .ok-dot{color:#4ade80}
  #graph{width:100%;height:460px;background:var(--panel2);border:1px solid var(--line);border-radius:14px;display:block;cursor:grab}
  .legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;font-size:12px;color:var(--muted)}
  .legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:middle;background:var(--c)}
  /* expandable trees: file graph, routing, composition */
  .tree{font-size:12.5px;margin-top:6px}
  .tree details,.tree-dir,.rt-dir,.tree-file.det{margin-top:0}
  .tree-dir>summary,.rt-dir>summary,.tree-file.det>summary{list-style:none;cursor:pointer;color:var(--ink);font-size:12.5px;padding:3px 6px;border-radius:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .tree-dir>summary::-webkit-details-marker,.rt-dir>summary::-webkit-details-marker,.tree-file.det>summary::-webkit-details-marker{display:none}
  .tree-dir>summary:hover,.rt-dir>summary:hover,.tree-file.det>summary:hover{background:#0e1830}
  .tree-dir>summary::before,.rt-dir>summary::before,.tree-file.det>summary::before{content:'▸';color:var(--muted);font-size:10px;display:inline-block;width:9px;transition:transform .15s}
  .tree-dir[open]>summary::before,.rt-dir[open]>summary::before,.tree-file.det[open]>summary::before{transform:rotate(90deg)}
  .tree-body{margin-left:15px;border-left:1px solid var(--line);padding-left:10px}
  .tree-file{padding:3px 6px 3px 21px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .ico{font-size:12px;filter:grayscale(.2)}
  .fan{font-size:10px;border-radius:5px;padding:0 5px;border:1px solid var(--line);color:var(--muted);white-space:nowrap}
  .fan.in{color:#7db4ff}.fan.out{color:#4ade80}
  .rel{font-size:12px;margin:3px 0;line-height:1.8}
  .rel code{margin:1px 2px}
  /* routing badges */
  .rt{font-size:10px;font-weight:700;text-transform:uppercase;border-radius:5px;padding:1px 6px;color:var(--c);background:color-mix(in srgb,var(--c) 16%,transparent);border:1px solid color-mix(in srgb,var(--c) 40%,transparent)}
  .seg{font-weight:600}
  .seg.dyn{color:#fbbf24}.seg.group{color:#c89bf5}
  .url{background:#0c1424;color:#9fb8e6}
  .rt-leaf{padding:3px 6px 3px 21px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  /* ER / data-model diagram */
  .er-canvas{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;margin-top:6px}
  .er-table{background:var(--panel2);border:1px solid var(--line);border-radius:10px;min-width:240px;overflow:hidden;box-shadow:0 1px 0 rgba(0,0,0,.2)}
  .er-h{background:linear-gradient(180deg,#16223e,#101a30);padding:8px 12px;font-weight:700;border-bottom:2px solid var(--brand);display:flex;align-items:center;gap:8px}
  .er-cols{width:100%;border-collapse:collapse;font-size:12.5px}
  .er-cols td{padding:4px 10px;border-bottom:1px solid #16203a;vertical-align:top}
  .er-cols tr:last-child td{border-bottom:0}
  .er-k{width:30px}
  .er-c{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#cfe0fb}
  .er-t{color:var(--muted);text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;white-space:nowrap}
  .req{color:#f87171;margin-left:2px}
  .kb{font-size:9px;font-weight:800;border-radius:4px;padding:1px 4px}
  .kb.pk{background:rgba(234,179,8,.18);color:#facc15;border:1px solid rgba(234,179,8,.5)}
  .kb.fk{background:rgba(168,85,247,.18);color:#c89bf5;border:1px solid rgba(168,85,247,.5)}
  .er-rls{font-size:9px;font-weight:700;border-radius:5px;padding:1px 6px;background:rgba(22,163,74,.18);color:#4ade80;border:1px solid rgba(22,163,74,.4);margin-left:auto}
  .er-rls.pub{background:rgba(217,119,6,.16);color:#fbbf24;border-color:rgba(217,119,6,.4)}
  .er-idx{padding:6px 10px;font-size:11px;color:var(--muted);border-top:1px solid #16203a;display:flex;flex-wrap:wrap;gap:8px}
  .er-bk{padding:8px 12px;font-size:12px;color:var(--muted)}
  .er-rels{margin-top:14px;font-size:12.5px}
  .er-table.bucket{min-width:200px}
  /* ── component composition (browser windows + physical nesting) ── */
  .comp-subh{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:18px 0 9px}
  .comp-legend{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin:10px 0 8px;font-size:12px;color:var(--muted)}
  .comp-legend .sw{display:inline-flex;align-items:center;gap:6px}
  .comp-legend i{width:12px;height:12px;border-radius:4px;display:inline-block;border:1px solid rgba(255,255,255,.14)}
  .comp-legend i.role-page{background:#86efac}
  .comp-legend i.role-layout{background:#7dd3fc}
  .comp-legend i.role-app{background:#a5b4fc}
  .comp-legend i.role-public{background:#22c55e}
  .comp-legend i.role-internal{background:#2b3a57}
  .comp-leg-arrow{color:#5e9bff;font-weight:800;font-size:14px;line-height:1}
  .comp-controls{display:flex;gap:8px;margin:0 0 10px}
  .comp-controls button{font:inherit;font-size:12px;cursor:pointer;color:var(--muted);background:var(--panel2);border:1px solid var(--line);border-radius:7px;padding:4px 11px}
  .comp-controls button:hover{color:#e6edf7;border-color:#3a4a66}
  /* page-flow graph */
  .cflow-wrap{overflow:auto;border:1px solid var(--line);border-radius:12px;background:var(--panel2);padding:16px 14px;margin:0 0 6px}
  .cflow{position:relative;min-width:max-content;margin:0 auto}
  .cflow-svg{position:absolute;top:0;left:0;overflow:visible;pointer-events:none;z-index:0}
  .cflow-edge{fill:none;stroke:#3f6fb0;stroke-width:1.6;opacity:.8}
  .cflow-layers{position:relative;z-index:1;display:flex;flex-direction:column;gap:40px}
  .cflow-row{display:flex;justify-content:center;flex-wrap:wrap;gap:26px}
  .cflow-node{background:#0b1322;border:1px solid #2b3b5b;border-radius:9px;min-width:158px;box-shadow:0 3px 12px rgba(0,0,0,.32)}
  .cflow-chrome{display:flex;align-items:center;gap:7px;padding:5px 9px;background:linear-gradient(180deg,#1b2540,#131c30);border-bottom:1px solid #243150;border-radius:9px 9px 0 0}
  .cflow-dots{display:inline-flex;gap:4px;flex:0 0 auto}
  .cflow-dots i{width:8px;height:8px;border-radius:50%;display:inline-block}
  .cflow-dots i:nth-child(1){background:#ff5f57}.cflow-dots i:nth-child(2){background:#febc2e}.cflow-dots i:nth-child(3){background:#28c840}
  .cflow-url{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:#9fb8e6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cflow-meta{padding:6px 10px;display:flex;flex-direction:column;gap:2px}
  .cflow-comp{font-size:11.5px;color:#dbe6f8;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .cflow-deg{font-size:10px;color:var(--muted)}
  .cflow-orphans{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 6px;font-size:11.5px}
  .cflow-orphan{color:#8aa0c2;background:#0c1424;border:1px solid var(--line);border-radius:6px;padding:1px 8px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}
  /* nested-rectangle tree */
  .comp-scroll{overflow:auto;max-height:900px;border:1px solid var(--line);border-radius:12px;background:var(--panel2);padding:12px}
  .comp-tree>.comp-box:first-child{margin-top:0}
  .comp-box{margin:7px 0;border:1px solid var(--line);border-left-width:3px;border-radius:9px;background:#0e1830}
  .comp-nest{padding:2px 9px 8px}
  .comp-card{background:transparent;border:0}
  .comp-card>summary{list-style:none;cursor:pointer;padding:8px 12px;display:flex;flex-wrap:wrap;align-items:center;gap:5px 9px}
  .comp-card>summary::-webkit-details-marker{display:none}
  .comp-card>summary::before{content:'▸';color:var(--muted);font-size:11px;line-height:1;transition:transform .12s}
  .comp-card[open]>summary::before{transform:rotate(90deg)}
  .comp-name{font-weight:700;font-size:13.5px;color:#e6edf7;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .comp-loc{font-size:11px;color:var(--muted);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .comp-tag{font-size:11.5px;color:var(--muted);font-style:italic}
  .comp-desc{flex-basis:100%;margin:1px 0 0;font-size:12.5px;color:#9fb2d4;line-height:1.45}
  .comp-links{flex-basis:100%;display:flex;flex-wrap:wrap;gap:5px;margin-top:4px}
  .comp-link{font-size:10.5px;color:#7db4ff;background:#0c1a30;border:1px solid #1e3a5f;border-radius:999px;padding:1px 8px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .comp-link::before{content:'→ ';opacity:.65}
  .comp-badge{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;padding:1px 7px;border-radius:999px}
  .comp-badge.role-page{background:#86efac;color:#052e16}
  .comp-badge.role-layout{background:#7dd3fc;color:#062436}
  .comp-badge.role-app{background:#a5b4fc;color:#1e1b4b}
  .comp-badge.role-public{background:#15803d;color:#dcfce7}
  .comp-badge.role-internal{background:#243049;color:#c7d4ea}
  .comp-box.role-page{border-left-color:#86efac}
  .comp-box.role-layout{border-left-color:#7dd3fc}
  .comp-box.role-app{border-left-color:#a5b4fc}
  .comp-box.role-public{border-left-color:#22c55e}
  .comp-box.role-internal{border-left-color:#33425f}
  .comp-meta{padding:8px 12px 11px;display:grid;gap:5px;border-top:1px solid var(--line)}
  .comp-mrow{display:flex;gap:10px;font-size:12px;line-height:1.5}
  .comp-mk{flex:0 0 78px;color:var(--muted);font-weight:600}
  .comp-mv{flex:1;min-width:0;color:#c7d4ea}
  .comp-mv code{background:#1a2742;border-radius:4px;padding:0 5px;font-size:11.5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .comp-ty{color:#7d8cad}
  .comp-sep{color:#54618a}
  .comp-hk{color:#6f7fa3;font-size:10.5px;margin-left:3px}
  .comp-ev{background:#23314e;border-radius:4px;padding:0 6px;font-size:11px;color:#a9c2ef}
  /* page = browser window */
  .comp-win{border-left-width:1px;border-color:#2b3b5b;background:#0b1322;box-shadow:0 8px 26px rgba(0,0,0,.42);overflow:hidden}
  .comp-winbar{display:flex;align-items:center;gap:10px;padding:7px 11px;background:linear-gradient(180deg,#1b2540,#131c30);border-bottom:1px solid #243150}
  .comp-dots{display:inline-flex;gap:6px;flex:0 0 auto}
  .comp-dots i{width:11px;height:11px;border-radius:50%;display:inline-block;background:#3a4a66}
  .comp-dots i:nth-child(1){background:#ff5f57}.comp-dots i:nth-child(2){background:#febc2e}.comp-dots i:nth-child(3){background:#28c840}
  .comp-addr{flex:1;min-width:0;display:flex;align-items:center;gap:7px;background:#0b1322;border:1px solid #243150;border-radius:7px;padding:4px 11px;color:#9fb8e6;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}
  .comp-addr-url{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .comp-lock{width:11px;height:11px;flex:0 0 auto;opacity:.55}
  .comp-winbody{padding:10px 11px 12px}
  .comp-winbody>.comp-nest{padding:6px 0 0}
  .comp-cyc{padding:8px 12px;display:flex;align-items:center;gap:9px}
  .comp-box.is-cycle{opacity:.6;border-style:dashed}
  .comp-unattached{margin-top:14px}
  .comp-unattached>summary{cursor:pointer;color:var(--muted);font-size:12.5px;margin-bottom:8px}
  /* storybook card */
  .sb-link{font-size:13px;margin:6px 0}
  footer{color:var(--muted);font-size:12px;text-align:center;padding:24px}
`;
