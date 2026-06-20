/** 5d. Data model — tables/columns/buckets parsed from supabase/migrations/*.sql. */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { ROOT } from '../config.mjs';
import { walk } from '../utils/fs.mjs';

/** Split a CREATE TABLE body on top-level commas (ignoring nested parens). */
function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
    }
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) {
    parts.push(cur);
  }
  return parts;
}

function parseColumns(body) {
  const cols = [];
  for (const raw of splitTopLevel(body)) {
    const line = raw.trim().replace(/\s+/g, ' ');
    if (!line) {
      continue;
    }
    if (/^(PRIMARY|FOREIGN|CONSTRAINT|UNIQUE|CHECK)\b/i.test(line)) {
      continue;
    } // table-level
    const m = /^"?([a-zA-Z0-9_]+)"?\s+(.+)$/.exec(line);
    if (!m) {
      continue;
    }
    const name = m[1];
    const rest = m[2];
    const typeM = /^([a-zA-Z0-9_]+(?:\s*\([^)]*\))?(?:\s*\[])?)/.exec(rest);
    const type = (typeM ? typeM[1] : rest.split(' ')[0]).replace(/\s+/g, '');
    const pk = /\bPRIMARY\s+KEY\b/i.test(rest);
    const fkM = /\bREFERENCES\s+"?([a-zA-Z0-9_.]+)"?\s*(?:\(\s*"?([a-zA-Z0-9_]+)"?\s*\))?/i.exec(
      rest,
    );
    cols.push({
      name,
      type,
      pk,
      notnull: pk || /\bNOT\s+NULL\b/i.test(rest),
      fk: fkM ? { table: fkM[1].replace(/"/g, ''), col: fkM[2] || '' } : null,
    });
  }
  return cols;
}

/** Parse CREATE TABLE / ALTER TABLE / indexes / storage buckets from migrations. */
export function collectEntities() {
  const dir = path.join(ROOT, 'supabase', 'migrations');
  if (!existsSync(dir)) {
    return { available: false, tables: [], buckets: [] };
  }
  const files = walk(dir)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort();
  if (!files.length) {
    return { available: false, tables: [], buckets: [] };
  }

  const tables = new Map();
  const buckets = [];
  const ensure = (name) =>
    tables.get(name) || tables.set(name, { name, columns: [], rls: false, indexes: [] }).get(name);

  for (const f of files) {
    let sql;
    try {
      sql = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    const clean = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
    let m;

    const ctRe =
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-zA-Z0-9_.]+)"?\s*\(([\s\S]*?)\)\s*;/gi;
    while ((m = ctRe.exec(clean))) {
      const t = ensure(m[1].replace(/"/g, ''));
      for (const c of parseColumns(m[2])) {
        if (!t.columns.find((x) => x.name === c.name)) {
          t.columns.push(c);
        }
      }
    }

    const acRe =
      /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?"?([a-zA-Z0-9_.]+)"?\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-zA-Z0-9_]+)"?\s+([a-zA-Z0-9_]+(?:\s*\([^)]*\))?(?:\s*\[])?)/gi;
    while ((m = acRe.exec(clean))) {
      const t = ensure(m[1].replace(/"/g, ''));
      if (!t.columns.find((x) => x.name === m[2])) {
        t.columns.push({
          name: m[2],
          type: m[3].replace(/\s+/g, ''),
          pk: false,
          notnull: false,
          fk: null,
        });
      }
    }

    const rlsRe =
      /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?"?([a-zA-Z0-9_.]+)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
    while ((m = rlsRe.exec(clean))) {
      const t = tables.get(m[1].replace(/"/g, ''));
      if (t) {
        t.rls = true;
      }
    }

    const idxRe =
      /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-zA-Z0-9_]+)"?\s+ON\s+"?([a-zA-Z0-9_.]+)"?\s*\(([^)]*)\)/gi;
    while ((m = idxRe.exec(clean))) {
      const t = tables.get(m[2].replace(/"/g, ''));
      if (t) {
        t.indexes.push({ name: m[1], cols: m[3].trim().replace(/\s+/g, ' ') });
      }
    }

    const bkRe =
      /INSERT\s+INTO\s+storage\.buckets[\s\S]*?VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(true|false)/gi;
    while ((m = bkRe.exec(clean))) {
      if (!buckets.find((b) => b.id === m[1])) {
        buckets.push({ id: m[1], name: m[2], public: m[3] === 'true' });
      }
    }
  }

  return { available: true, tables: [...tables.values()], buckets };
}
