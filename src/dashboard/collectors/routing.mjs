/** 5b. Routing — Next.js App Router tree with resolved URLs. */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { SRC } from '../config.mjs';
import { IGNORE_DIRS } from '../utils/fs.mjs';

const ROUTE_FILE_KINDS = new Set([
  'page',
  'layout',
  'route',
  'loading',
  'error',
  'global-error',
  'not-found',
  'template',
  'default',
]);

function routeFileKind(name) {
  const base = name.replace(/\.(tsx|ts|jsx|js)$/, '');
  return ROUTE_FILE_KINDS.has(base) ? base : null;
}

/** Walk src/app and build an expandable route tree with URL paths. */
export function collectRouting() {
  const appDir = path.join(SRC, 'app');
  if (!existsSync(appDir)) {
    return { available: false };
  }

  const build = (dir, seg) => {
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {}
    const node = {
      seg,
      dynamic: /^\[.+]$/.test(seg),
      group: /^\(.+\)$/.test(seg),
      kinds: [],
      children: [],
    };
    for (const e of entries) {
      if (e.isFile()) {
        const k = routeFileKind(e.name);
        if (k && !node.kinds.includes(k)) {
          node.kinds.push(k);
        }
      }
    }
    for (const e of entries) {
      if (e.isDirectory() && !IGNORE_DIRS.has(e.name)) {
        node.children.push(build(path.join(dir, e.name), e.name));
      }
    }
    node.kinds.sort();
    node.children.sort((a, b) => a.seg.localeCompare(b.seg));
    return node;
  };

  const root = build(appDir, '');
  let pageCount = 0;
  let routeCount = 0;
  // Compute the URL each segment maps to (route groups don't appear in the URL).
  const urlize = (node, parts) => {
    const next = node.seg && !node.group ? [...parts, node.seg] : parts;
    node.url = '/' + next.filter(Boolean).join('/');
    if (node.kinds.includes('page')) {
      pageCount++;
    }
    if (node.kinds.includes('route')) {
      routeCount++;
    }
    for (const c of node.children) {
      urlize(c, next);
    }
  };
  urlize(root, []);

  return { available: true, root, pageCount, routeCount };
}
