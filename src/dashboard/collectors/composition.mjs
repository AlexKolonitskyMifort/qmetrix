/**
 * 6. Component composition — an app-rooted containment tree of feature widgets.
 *
 * The dashboard draws this as nested rectangles: one box per app-router root
 * (page.tsx / layout.tsx) with every feature component it renders nested inside,
 * recursively, following "renders" relationships (a JSX <Tag>, a Next default
 * re-export, or a `dynamic()`/`lazy()` import whose binding is a component).
 * Design-system widgets from src/common are deliberately NOT shown — this view is
 * about how the *features* compose, not the shared UI kit.
 *
 * Each box carries the metadata the renderer prints next to it (description,
 * props, state, events, public API) — see collectors/composition-meta.mjs for the
 * extraction. Feature barrels (`@/features/x` → index.ts) are followed through to
 * the concrete component file. Cycles are broken per branch; a component rendered
 * by several parents is intentionally duplicated under each (containment tree, not
 * a DAG). Feature components never reached from a page are surfaced in a separate
 * "unattached" list so dead/unused components are not silently dropped.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { SRC } from '../config.mjs';
import { resolveImport } from './graph.mjs';
import { rel, walk } from '../utils/fs.mjs';
import {
  extractDescription,
  extractEvents,
  extractExports,
  extractProps,
  extractState,
  isComponentFile,
  parseBindings,
  primaryName,
  stripComments,
  usedJsxTags,
} from './composition-meta.mjs';
import { buildTransitions, siteHost } from './composition-transitions.mjs';

const APP_DIR = path.join(SRC, 'app');
const FEATURES_DIR = path.join(SRC, 'features');
const COMMON_DIR = path.join(SRC, 'common');

const CODE_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const EXCLUDE_RE = /\.(test|spec|stories)\.[jt]sx?$/;
const APP_ROOT_RE = /(^|\/)(page|layout)\.[jt]sx?$/;
const INDEX_RE = /(^|\/)index\.tsx?$/;
const MAX_DEPTH = 9;

function layerOf(abs) {
  if (abs === APP_DIR || abs.startsWith(APP_DIR + path.sep)) {
    return 'app';
  }
  if (abs.startsWith(FEATURES_DIR + path.sep)) {
    return 'feature';
  }
  if (abs.startsWith(COMMON_DIR + path.sep)) {
    return 'common';
  }
  return 'other';
}

const featureOf = (relPath) => relPath.match(/^src\/features\/([^/]+)\//)?.[1] ?? null;
const appKind = (relPath) => (/(^|\/)layout\.[jt]sx?$/.test(relPath) ? 'layout' : 'page');
const routeOf = (relPath) => {
  const r = relPath.replace(/^src\/app/, '').replace(/\/(page|layout)\.[jt]sx?$/, '');
  return r === '' ? '/' : r;
};

/** Index every (production) code file under app / features / common. */
function indexFiles() {
  const fileByAbs = new Map();
  for (const dir of [APP_DIR, FEATURES_DIR, COMMON_DIR]) {
    for (const abs of walk(dir)) {
      if (!CODE_RE.test(abs) || abs.endsWith('.d.ts') || EXCLUDE_RE.test(abs)) {
        continue;
      }
      let raw = '';
      try {
        raw = readFileSync(abs, 'utf8');
      } catch {
        raw = '';
      }
      fileByAbs.set(abs, {
        abs,
        rel: rel(abs),
        layer: layerOf(abs),
        raw,
        code: stripComments(raw),
      });
    }
  }
  return fileByAbs;
}

/** feature → Set of names it re-exports through index.ts (its public API). */
function computePublicNames(fileByAbs) {
  const map = new Map();
  for (const f of fileByAbs.values()) {
    if (f.layer === 'feature' && /\/index\.ts$/.test(f.rel)) {
      const feat = f.rel.match(/^src\/features\/([^/]+)\//)?.[1];
      if (feat) {
        map.set(feat, new Set(extractExports(f.code)));
      }
    }
  }
  return map;
}

/** The component names a file "renders": JSX tags + default re-export + lazy. */
function renderedNames(code) {
  const names = usedJsxTags(code);
  const def = code.match(/export\s+default\s+([A-Za-z_]\w*)\s*;/);
  if (def) {
    names.add(def[1]);
  }
  let m;
  const asDefaultRe = /export\s*\{([^}]*)\}/g;
  while ((m = asDefaultRe.exec(code))) {
    for (const part of m[1].split(',')) {
      const as = part.trim().match(/^([A-Za-z_]\w*)\s+as\s+default$/);
      if (as) {
        names.add(as[1]);
      }
    }
  }
  return names;
}

export function collectComposition() {
  const fileByAbs = indexFiles();
  const publicNames = computePublicNames(fileByAbs);
  const components = {}; // id (rel path) → serialisable descriptor
  const descCache = new Map();
  const barrelCache = new Map();
  const childCache = new Map();

  // ── Component descriptors (cached by abs path) ──
  function descriptorFor(abs) {
    if (descCache.has(abs)) {
      return descCache.get(abs);
    }
    const f = fileByAbs.get(abs);
    if (!f) {
      return null;
    }
    const cname = primaryName(f.code, f.rel);
    const props = extractProps(f.code, cname);
    const feature = f.layer === 'feature' ? featureOf(f.rel) : null;
    const isPublic = f.layer === 'feature' && (publicNames.get(feature)?.has(cname) ?? false);
    // App-layer files split into route roots (page/layout) and plain helpers
    // (providers.tsx, error.tsx …) that happen to be rendered by a root.
    const isAppRoot = f.layer === 'app' && APP_ROOT_RE.test(f.rel);
    const role =
      f.layer === 'app' ? (isAppRoot ? appKind(f.rel) : 'app') : isPublic ? 'public' : 'internal';
    const d = {
      id: f.rel,
      name: f.layer === 'app' ? (isAppRoot ? routeOf(f.rel) : cname) : cname,
      component: cname,
      file: f.rel.split('/').pop(),
      rel: f.rel,
      layer: f.layer,
      feature,
      kind: f.layer === 'app' ? (isAppRoot ? appKind(f.rel) : 'component') : 'component',
      role,
      public: isPublic,
      description: extractDescription(f.raw, cname),
      props,
      state: extractState(f.code),
      events: extractEvents(f.code, props),
      exports: extractExports(f.code),
    };
    descCache.set(abs, d);
    components[d.id] = d;
    return d;
  }

  // ── Feature barrel: exported name → concrete source file ──
  function barrelReexports(indexAbs) {
    if (barrelCache.has(indexAbs)) {
      return barrelCache.get(indexAbs);
    }
    const map = new Map();
    const f = fileByAbs.get(indexAbs);
    if (f) {
      const re = /export\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = re.exec(f.code))) {
        const target = resolveImport(m[2], indexAbs);
        if (!target) {
          continue;
        }
        for (const part of m[1].split(',')) {
          const seg = part.trim();
          const as = seg.match(/\s+as\s+([A-Za-z_]\w*)/);
          const exported = as ? as[1] : seg.split(/\s/)[0];
          if (exported) {
            map.set(exported, target);
          }
        }
      }
    }
    barrelCache.set(indexAbs, map);
    return map;
  }

  // ── "Renders" edges: a rendered binding → its concrete component file ──
  function childTargets(abs) {
    if (childCache.has(abs)) {
      return childCache.get(abs);
    }
    const f = fileByAbs.get(abs);
    const out = [];
    if (f && /\.(tsx|jsx)$/.test(f.rel)) {
      const rendered = renderedNames(f.code);
      if (rendered.size) {
        const seen = new Set();
        // Resolve a binding against an import spec (following barrels), then keep
        // it iff it's a shown app/feature component (common widgets are omitted).
        const consider = (b, spec) => {
          let real = resolveImport(spec, abs);
          if (real && fileByAbs.has(real) && INDEX_RE.test(fileByAbs.get(real).rel)) {
            real = barrelReexports(real).get(b);
          }
          if (!real || !fileByAbs.has(real) || real === abs || seen.has(real)) {
            return;
          }
          const layer = fileByAbs.get(real).layer;
          if (layer === 'common' || layer === 'other') {
            return;
          }
          seen.add(real);
          out.push(real);
        };

        let m;
        const fromRe = /\bimport\s+(type\s+)?([^;]*?)\s+from\s*["']([^"']+)["']/g;
        while ((m = fromRe.exec(f.code))) {
          if (m[1]) {
            continue; // type-only import — never a render
          }
          for (const b of parseBindings(m[2])) {
            if (rendered.has(b)) {
              consider(b, m[3]);
            }
          }
        }
        const dynRe =
          /(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:[\w.]*\.)?(?:dynamic|lazy)\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*import\(\s*["']([^"']+)["']/g;
        while ((m = dynRe.exec(f.code))) {
          if (rendered.has(m[1])) {
            consider(m[1], m[2]);
          }
        }
      }
    }
    childCache.set(abs, out);
    return out;
  }

  // ── Build one containment tree (cycles broken per branch) ──
  function buildTree(abs, ancestry) {
    const d = descriptorFor(abs);
    if (!d) {
      return null;
    }
    const node = { id: d.id, children: [] };
    if (ancestry.size >= MAX_DEPTH) {
      return node;
    }
    const next = new Set(ancestry).add(abs);
    for (const childAbs of childTargets(abs)) {
      if (ancestry.has(childAbs) || childAbs === abs) {
        const cd = descriptorFor(childAbs);
        if (cd) {
          node.children.push({ id: cd.id, children: [], cycle: true });
        }
        continue;
      }
      const sub = buildTree(childAbs, next);
      if (sub) {
        node.children.push(sub);
      }
    }
    return node;
  }

  // ── The forest, rooted at app pages/layouts ──
  const roots = [...fileByAbs.values()]
    .filter((f) => f.layer === 'app' && APP_ROOT_RE.test(f.rel))
    .sort((a, b) => {
      const ra = routeOf(a.rel);
      const rb = routeOf(b.rel);
      return ra === rb ? appKind(a.rel).localeCompare(appKind(b.rel)) : ra.localeCompare(rb);
    })
    .map((f) => buildTree(f.abs, new Set()))
    .filter(Boolean);

  const reached = new Set();
  const collectIds = (node) => {
    reached.add(node.id);
    (node.children || []).forEach(collectIds);
  };
  roots.forEach(collectIds);

  const unattached = findUnattached(fileByAbs, reached, buildTree, collectIds);
  const fileByRel = new Map([...fileByAbs.values()].map((f) => [f.rel, f]));
  const transitions = buildTransitions(components, roots, fileByRel);
  return {
    available: roots.length > 0 || unattached.length > 0,
    components,
    roots,
    unattached,
    transitions,
    host: siteHost(),
    stats: stats(components, roots, unattached),
  };
}

/** Feature components never reached from a page → flat roots (absorbing nests). */
function findUnattached(fileByAbs, reached, buildTree, collectIds) {
  const candidates = [...fileByAbs.values()]
    .filter(
      (f) =>
        f.layer === 'feature' &&
        !INDEX_RE.test(f.rel) &&
        isComponentFile(f.rel, f.code) &&
        !reached.has(f.rel),
    )
    .sort((a, b) => a.rel.localeCompare(b.rel));
  const unattached = [];
  const claimed = new Set(reached);
  for (const f of candidates) {
    if (claimed.has(f.rel)) {
      continue;
    }
    const tree = buildTree(f.abs, new Set());
    if (tree) {
      collectIds(tree);
      const mark = (n) => {
        claimed.add(n.id);
        (n.children || []).forEach(mark);
      };
      mark(tree);
      unattached.push(tree);
    }
  }
  return unattached;
}

function stats(components, roots, unattached) {
  const countBoxes = (nodes) => nodes.reduce((acc, n) => acc + 1 + countBoxes(n.children || []), 0);
  const featureDescs = Object.values(components).filter((c) => c.layer === 'feature');
  return {
    pages: roots.filter((r) => components[r.id]?.kind === 'page').length,
    layouts: roots.filter((r) => components[r.id]?.kind === 'layout').length,
    featureComponents: featureDescs.length,
    features: [...new Set(featureDescs.map((c) => c.feature))].filter(Boolean).sort(),
    boxes: countBoxes(roots) + countBoxes(unattached),
  };
}
