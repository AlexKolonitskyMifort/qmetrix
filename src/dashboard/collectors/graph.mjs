/** 5. File relationship graph — internal import edges + fan-in/out. */
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { SRC } from '../config.mjs';
import { rel, walk } from '../utils/fs.mjs';

export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

export function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) {
    base = path.join(SRC, spec.slice(2));
  } else if (spec.startsWith('.')) {
    base = path.resolve(path.dirname(fromFile), spec);
  } else {
    return null;
  } // external package
  const tries = [
    base,
    base + '.ts',
    base + '.tsx',
    base + '.js',
    base + '.jsx',
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
  ];
  for (const t of tries) {
    try {
      if (statSync(t).isFile()) {
        return t;
      }
    } catch {}
  }
  return null;
}

export function externalName(spec) {
  if (spec.startsWith('@/') || spec.startsWith('.')) {
    return null;
  }
  if (spec.startsWith('@')) {
    return spec.split('/').slice(0, 2).join('/');
  }
  return spec.split('/')[0];
}

export function collectGraph() {
  const files = walk(SRC).filter((f) => /\.(ts|tsx|js|jsx)$/.test(f) && !f.endsWith('.d.ts'));
  const set = new Set(files);
  const idOf = new Map(files.map((f, i) => [f, i]));
  const importRe =
    /(?:\bimport\b[\s\S]*?\bfrom\s*|\bexport\b[\s\S]*?\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;

  const nodes = files.map((f) => ({
    id: idOf.get(f),
    label: rel(f).replace(/^src\//, ''),
    group: rel(f).split('/')[1] || 'root',
    fanIn: 0,
    fanOut: 0,
  }));
  const edges = [];
  const externals = new Map();

  for (const f of files) {
    let code;
    try {
      code = stripComments(readFileSync(f, 'utf8'));
    } catch {
      continue;
    }
    const seen = new Set();
    let m;
    while ((m = importRe.exec(code))) {
      const spec = m[1];
      if (seen.has(spec)) {
        continue;
      }
      seen.add(spec);
      const ext = externalName(spec);
      if (ext) {
        externals.set(ext, (externals.get(ext) || 0) + 1);
        continue;
      }
      const target = resolveImport(spec, f);
      if (target && set.has(target) && target !== f) {
        edges.push({ source: idOf.get(f), target: idOf.get(target) });
        nodes[idOf.get(f)].fanOut++;
        nodes[idOf.get(target)].fanIn++;
      }
    }
  }

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    externalCount: externals.size,
    importedExternals: new Set(externals.keys()),
    graph: { nodes, edges },
  };
}
