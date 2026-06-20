/**
 * Client-side scripts embedded verbatim into the report.
 *
 * These run in the browser, not in Node — they are exported as plain strings and
 * dropped inside <script> tags by the template. Keep them self-contained (no
 * server-side interpolation); the only data they read is the #graph-data JSON
 * the template injects separately.
 */

/** Force-directed file-graph canvas (interactive: drag nodes, hover for path). */
export const GRAPH_SCRIPT = `(function(){
  const data = JSON.parse(document.getElementById('graph-data').textContent);
  const canvas = document.getElementById('graph');
  const dpr = window.devicePixelRatio || 1;
  function size(){ canvas.width = canvas.clientWidth*dpr; canvas.height = canvas.clientHeight*dpr; }
  size(); window.addEventListener('resize', size);
  // The canvas lives inside a collapsed <details>; clientWidth is 0 until opened.
  // Re-measure (and re-seed node positions once) the first time it's revealed.
  (function(){ const det = canvas.closest('details'); if(!det) return;
    let seeded=false;
    det.addEventListener('toggle', ()=>{ if(!det.open) return; size();
      if(seeded) return; seeded=true;
      const cw=canvas.clientWidth||640;
      for(let i=0;i<nodes.length;i++){ nodes[i].x=Math.cos(i/nodes.length*2*Math.PI)*220+cw/2; nodes[i].y=Math.sin(i/nodes.length*2*Math.PI)*180+230; nodes[i].vx=nodes[i].vy=0; }
    });
  })();
  const ctx = canvas.getContext('2d');
  const palette = ['#1377FE','#22c55e','#f59e0b','#a855f7','#ec4899','#06b6d4','#ef4444','#84cc16','#eab308'];
  const groups = [...new Set(data.nodes.map(n=>n.group))];
  const colorOf = g => palette[groups.indexOf(g)%palette.length];
  document.getElementById('legend').innerHTML = groups.map(g=>'<span><i style="--c:'+colorOf(g)+'"></i>'+g+'</span>').join('');

  const N = data.nodes.length;
  const nodes = data.nodes.map((n,i)=>({...n,
    x: Math.cos(i/N*2*Math.PI)*220 + (canvas.clientWidth/2),
    y: Math.sin(i/N*2*Math.PI)*180 + 230, vx:0, vy:0,
    r: 4 + Math.min(8, (n.fanIn||0))}));
  const edges = data.edges;
  let drag=null, mouse={x:0,y:0}, hover=null;

  function tick(){
    const cx=canvas.clientWidth/2, cy=230;
    for(let i=0;i<N;i++){
      const a=nodes[i]; a.vx += (cx-a.x)*0.0008; a.vy += (cy-a.y)*0.0008;
      for(let j=i+1;j<N;j++){
        const b=nodes[j]; let dx=a.x-b.x, dy=a.y-b.y; let d2=dx*dx+dy*dy||0.01;
        const f=380/d2; const d=Math.sqrt(d2);
        dx/=d; dy/=d; a.vx+=dx*f; a.vy+=dy*f; b.vx-=dx*f; b.vy-=dy*f;
      }
    }
    for(const e of edges){
      const a=nodes[e.source], b=nodes[e.target];
      let dx=b.x-a.x, dy=b.y-a.y; const d=Math.sqrt(dx*dx+dy*dy)||0.01;
      const f=(d-70)*0.01; dx/=d; dy/=d;
      a.vx+=dx*f; a.vy+=dy*f; b.vx-=dx*f; b.vy-=dy*f;
    }
    for(const n of nodes){ if(n===drag)continue; n.vx*=0.86; n.vy*=0.86; n.x+=n.vx; n.y+=n.vy; }
  }
  function draw(){
    ctx.save(); ctx.scale(dpr,dpr); ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);
    ctx.lineWidth=0.6; ctx.strokeStyle='rgba(120,150,200,0.18)';
    for(const e of edges){ const a=nodes[e.source], b=nodes[e.target];
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
    for(const n of nodes){
      ctx.beginPath(); ctx.fillStyle=colorOf(n.group); ctx.globalAlpha = hover&&hover!==n?0.5:1;
      ctx.arc(n.x,n.y,n.r,0,7); ctx.fill(); ctx.globalAlpha=1;
    }
    if(hover){ ctx.fillStyle='#e6edf7'; ctx.font='12px ui-monospace,monospace';
      const t=hover.label+'  (in '+hover.fanIn+' / out '+hover.fanOut+')';
      const w=ctx.measureText(t).width+12; let tx=hover.x+10, ty=hover.y-10;
      if(tx+w>canvas.clientWidth) tx=hover.x-w-10;
      ctx.fillStyle='rgba(10,18,36,.92)'; ctx.fillRect(tx,ty-13,w,18);
      ctx.fillStyle='#e6edf7'; ctx.fillText(t,tx+6,ty); }
    ctx.restore();
  }
  function loop(){ tick(); draw(); requestAnimationFrame(loop); } loop();

  function at(mx,my){ let best=null,bd=144; for(const n of nodes){ const d=(n.x-mx)**2+(n.y-my)**2; if(d<bd){bd=d;best=n;} } return best; }
  canvas.addEventListener('mousemove',ev=>{ const r=canvas.getBoundingClientRect(); mouse={x:ev.clientX-r.left,y:ev.clientY-r.top};
    if(drag){ drag.x=mouse.x; drag.y=mouse.y; drag.vx=drag.vy=0; } else hover=at(mouse.x,mouse.y); });
  canvas.addEventListener('mousedown',ev=>{ const r=canvas.getBoundingClientRect(); drag=at(ev.clientX-r.left,ev.clientY-r.top); canvas.style.cursor='grabbing'; });
  window.addEventListener('mouseup',()=>{ drag=null; canvas.style.cursor='grab'; });
})();`;

/**
 * Component composition — expand/collapse-all for the nested-rectangle view.
 * The boxes themselves are static HTML (<details> per box); this only wires the
 * two "Expand all / Collapse all" buttons to flip every box's metadata panel.
 */
export const COMPOSITION_SCRIPT = `(function(){
  const btns = document.querySelectorAll('[data-comp-toggle]');
  if(!btns.length) return;
  btns.forEach(function(btn){
    btn.addEventListener('click', function(){
      const open = btn.getAttribute('data-comp-toggle') === 'open';
      document.querySelectorAll('.comp-tree details.comp-card').forEach(function(d){ d.open = open; });
    });
  });
})();`;

/**
 * Component composition — page-flow arrows. Draws an SVG cubic-bezier between the
 * mini browser windows for every transition edge (indices into the .cflow-node
 * list, injected as #comp-flow-data). Coordinates are taken from live layout
 * (getBoundingClientRect relative to the #cflow box) and recomputed on resize, so
 * the arrows stay glued to the nodes regardless of wrapping.
 */
export const COMPOSITION_FLOW_SCRIPT = `(function(){
  const cflow = document.getElementById('cflow');
  const svg = document.getElementById('cflow-svg');
  const dataEl = document.getElementById('comp-flow-data');
  if(!cflow || !svg || !dataEl) return;
  let edges = [];
  try { edges = JSON.parse(dataEl.textContent) || []; } catch(e){ return; }
  const nodes = cflow.querySelectorAll('.cflow-node');
  const NS = 'http://www.w3.org/2000/svg';
  function draw(){
    [].slice.call(svg.querySelectorAll('path.cflow-edge')).forEach(function(p){ p.remove(); });
    const base = cflow.getBoundingClientRect();
    svg.setAttribute('width', cflow.scrollWidth);
    svg.setAttribute('height', cflow.scrollHeight);
    edges.forEach(function(e){
      const a = nodes[e[0]], b = nodes[e[1]];
      if(!a || !b) return;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const x1 = ra.left - base.left + ra.width/2;
      const x2 = rb.left - base.left + rb.width/2;
      let y1, y2, d;
      const dy = Math.max(26, Math.abs((rb.top+rb.bottom)/2 - (ra.top+ra.bottom)/2)/2);
      if(rb.top >= ra.bottom - 1){            // forward edge: bottom of a → top of b
        y1 = ra.bottom - base.top; y2 = rb.top - base.top;
        d = 'M'+x1+','+y1+' C'+x1+','+(y1+dy)+' '+x2+','+(y2-dy)+' '+x2+','+y2;
      } else {                                 // back / same-layer edge: route around the side
        y1 = ra.top - base.top; y2 = rb.bottom - base.top;
        const bend = x2 >= x1 ? 70 : -70;
        d = 'M'+x1+','+y1+' C'+(x1+bend)+','+(y1-dy)+' '+(x2+bend)+','+(y2+dy)+' '+x2+','+y2;
      }
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'cflow-edge');
      path.setAttribute('marker-end', 'url(#cflow-arrow)');
      svg.appendChild(path);
    });
  }
  draw();
  window.addEventListener('resize', draw);
  setTimeout(draw, 80);
})();`;

/** Dependency-table filter (segment buttons + checkboxes + search). */
export const DEP_FILTER_SCRIPT = `(function(){
  const table = document.getElementById('dep-rows');
  if(!table) return;
  const rows = [...table.querySelectorAll('tbody tr')];
  const state = { type:'all', outdated:false, vuln:false, q:'' };
  const count = document.getElementById('dep-count');
  function apply(){
    let shown=0;
    for(const r of rows){
      const ok = (state.type==='all' || r.dataset.type===state.type)
        && (!state.outdated || r.dataset.outdated==='1')
        && (!state.vuln || r.dataset.vuln==='1')
        && (!state.q || r.dataset.name.includes(state.q));
      r.style.display = ok ? '' : 'none';
      if(ok) shown++;
    }
    if(count) count.textContent = 'showing '+shown+' of '+rows.length;
  }
  document.querySelectorAll('#dep-filters [data-ftype]').forEach(b=>b.addEventListener('click',()=>{
    state.type=b.dataset.ftype;
    document.querySelectorAll('#dep-filters [data-ftype]').forEach(x=>x.classList.toggle('on',x===b));
    apply();
  }));
  const bind=(id,key)=>{ const e=document.getElementById(id); if(e) e.addEventListener('change',()=>{ state[key]=e.checked; apply(); }); };
  bind('f-outdated','outdated'); bind('f-vuln','vuln');
  const q=document.getElementById('f-q'); if(q) q.addEventListener('input',()=>{ state.q=q.value.trim().toLowerCase(); apply(); });
  apply();
})();`;
