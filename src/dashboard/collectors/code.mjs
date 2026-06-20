/** 1. Code overview — file/line counts grouped by language. */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ROOT } from '../config.mjs';
import { walk } from '../utils/fs.mjs';

// Extensions we treat as text and count lines for.
const TEXT_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.scss',
  '.md',
  '.mdx',
  '.yml',
  '.yaml',
  '.html',
  '.txt',
  '.svg',
]);
// Subset considered "source code" (not config/docs/assets).
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.scss']);

const LANG_NAME = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript (JSX)',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript (JSX)',
  '.mjs': 'ES Modules',
  '.cjs': 'CommonJS',
  '.json': 'JSON',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.md': 'Markdown',
  '.mdx': 'MDX',
  '.yml': 'YAML',
  '.yaml': 'YAML',
  '.html': 'HTML',
  '.svg': 'SVG',
  '.txt': 'Text',
};

export function collectCode() {
  const files = walk(ROOT);
  const byExt = {};
  let totalFiles = 0,
    totalLines = 0,
    codeFiles = 0,
    codeLines = 0;
  let blank = 0,
    comment = 0;

  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    if (!TEXT_EXT.has(ext)) {
      continue;
    }
    let content;
    try {
      content = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    const lines = content.length ? content.split(/\r?\n/) : [];
    const e = (byExt[ext] ||= { files: 0, lines: 0 });
    e.files++;
    e.lines += lines.length;
    totalFiles++;
    totalLines += lines.length;
    if (CODE_EXT.has(ext)) {
      codeFiles++;
      codeLines += lines.length;
      for (const ln of lines) {
        const t = ln.trim();
        if (!t) {
          blank++;
        } else if (/^(\/\/|\/\*|\*|\*\/|<!--|#)/.test(t)) {
          comment++;
        }
      }
    }
  }

  const languages = Object.entries(byExt)
    .map(([ext, v]) => ({ ext, name: LANG_NAME[ext] || ext, files: v.files, lines: v.lines }))
    .sort((a, b) => b.lines - a.lines);

  return {
    totalFiles,
    totalLines,
    codeFiles,
    codeLines,
    blank,
    comment,
    codeOnly: Math.max(0, codeLines - blank - comment),
    languages,
  };
}
