/** Filesystem walking helpers shared by the collectors. */
import { readdirSync } from 'node:fs';
import path from 'node:path';

import { ROOT } from '../config.mjs';

/** Directories never descended into when scanning the tree. */
export const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.vercel',
  '.turbo',
  'coverage',
  'reports',
  'dist',
  'build',
  'out',
  'playwright-report',
  'test-results',
]);

/** Recursively collect every file under `dir`, skipping IGNORE_DIRS and dotfiles. */
export function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.github') {
      continue;
    }
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) {
        continue;
      }
      walk(full, files);
    } else if (e.isFile()) {
      files.push(full);
    }
  }
  return files;
}

/** Project-root-relative POSIX path for display. */
export const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
