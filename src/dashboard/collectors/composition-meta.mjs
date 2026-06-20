/**
 * Component-composition static analysis — the per-file parsing the composition
 * collector leans on (kept separate so collectComposition stays orchestration).
 *
 * Everything here is regex/string scanning over comment-stripped source: it never
 * executes the code. The exported `extract*` helpers pull out exactly the fields
 * the dashboard prints in each box (description / props / state / events / API);
 * the binding/JSX helpers feed the collector's "renders" edge detection.
 */

export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** JSX-bearing .tsx/.jsx file → treat as a React component module. */
export function isComponentFile(file, code) {
  if (!/\.(tsx|jsx)$/.test(file)) {
    return false;
  }
  return /<\/[A-Za-z][\w.]*>/.test(code) || /<[A-Za-z][\w.]*[^>]*\/>/.test(code) || /<>/.test(code);
}

/** Local binding names introduced by an `import <clause> from …` statement. */
export function parseBindings(clause) {
  const names = [];
  const ns = clause.match(/\*\s*as\s+([A-Za-z_$][\w$]*)/);
  if (ns) {
    names.push(ns[1]);
  }
  const braced = clause.match(/\{([^}]*)}/);
  if (braced) {
    for (const part of braced[1].split(',')) {
      const seg = part.trim();
      if (!seg) {
        continue;
      }
      const m = seg.match(/[\w$]+\s+as\s+([A-Za-z_$][\w$]*)/) || seg.match(/^([A-Za-z_$][\w$]*)/);
      if (m) {
        names.push(m[1]);
      }
    }
  }
  const head = clause.replace(/\{[^}]*}/g, '').replace(/\*\s*as\s+[\w$]+/g, '');
  const def = head.match(/^[\s,]*([A-Za-z_$][\w$]*)/);
  if (def) {
    names.push(def[1]);
  }
  return names;
}

/** Capitalised JSX tag roots actually used in the file (<Foo …> and <NS.Foo …>). */
export function usedJsxTags(code) {
  const set = new Set();
  const re = /<([A-Z][A-Za-z0-9_]*)[\s/>.]/g;
  let m;
  while ((m = re.exec(code))) {
    set.add(m[1]);
  }
  return set;
}

/** Substring between the matching delimiters, starting at the opener at `open`. */
function sliceBalanced(s, open, oc, cc) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === oc) {
      depth++;
    } else if (c === cc) {
      depth--;
      if (depth === 0) {
        return s.slice(open + 1, i);
      }
    }
  }
  return '';
}

/** Exported component name (first PascalCase export), else the file basename. */
export function primaryName(code, relPath) {
  const fn = code.match(/export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Z]\w*)/);
  if (fn) {
    return fn[1];
  }
  const cn = code.match(/export\s+const\s+([A-Z]\w*)\s*[:=]/);
  if (cn) {
    return cn[1];
  }
  return relPath
    .split('/')
    .pop()
    .replace(/\.[jt]sx?$/, '');
}

function cleanDoc(s) {
  const t = s
    .replace(/^\s*\*\s?/gm, ' ')
    .replace(/\{@link\s+([^}|]+)(?:\|[^}]+)?}/g, '$1')
    .replace(/@\w+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) {
    return '';
  }
  const twoSentences = t
    .split(/(?<=\.)\s/)
    .slice(0, 2)
    .join(' ');
  const out = twoSentences || t;
  return out.length > 200 ? out.slice(0, 197).trimEnd() + '…' : out;
}

/** Leading JSDoc block that precedes the named component (else the last block). */
export function extractDescription(raw, name) {
  const blocks = [...raw.matchAll(/\/\*\*([\s\S]*?)\*\//g)];
  if (!blocks.length) {
    return '';
  }
  const nameRe = new RegExp('(?:function|const)\\s+' + name + '\\b');
  for (const b of blocks) {
    const after = raw.slice(b.index + b[0].length, b.index + b[0].length + 140);
    if (nameRe.test(after) || /^\s*export\s+default/.test(after)) {
      return cleanDoc(b[1]);
    }
  }
  return cleanDoc(blocks[blocks.length - 1][1]);
}

/** Parse a TS object/interface body into [{ name, type }]. */
function parseTypeBody(body) {
  const out = [];
  for (const raw of body.split(';')) {
    const seg = raw.trim();
    if (!seg || seg.startsWith('//')) {
      continue;
    }
    const m = seg.match(/^(?:readonly\s+)?([A-Za-z_]\w*)\s*\??\s*:\s*([\s\S]+)$/);
    if (m) {
      out.push({ name: m[1], type: m[2].replace(/\s+/g, ' ').trim() });
    }
  }
  return out;
}

function propsFromNamedType(code, typeName) {
  const iface = new RegExp('interface\\s+' + typeName + '\\s*(?:extends[^{]+)?\\{').exec(code);
  if (iface) {
    return parseTypeBody(sliceBalanced(code, iface.index + iface[0].length - 1, '{', '}'));
  }
  const ty = new RegExp('type\\s+' + typeName + '\\s*=\\s*\\{').exec(code);
  if (ty) {
    return parseTypeBody(sliceBalanced(code, ty.index + ty[0].length - 1, '{', '}'));
  }
  return [];
}

/** Best-effort prop types for the destructured names from a component signature. */
function typesForParams(code, params, destrLen) {
  const inlineObj = params.match(/}\s*:\s*\{([\s\S]*)\}\s*$/);
  if (inlineObj) {
    return Object.fromEntries(parseTypeBody(inlineObj[1]).map((p) => [p.name, p.type]));
  }
  const named = params.slice(destrLen).match(/^\s*:\s*([A-Za-z_]\w*)/);
  if (named) {
    return Object.fromEntries(propsFromNamedType(code, named[1]).map((p) => [p.name, p.type]));
  }
  return {};
}

/** The component's props (interface) — destructured names + best-effort types. */
export function extractProps(code, name) {
  let open = -1;
  const fn = new RegExp('function\\s+' + name + '\\s*\\(').exec(code);
  if (fn) {
    open = fn.index + fn[0].length - 1;
  } else {
    const arrow = new RegExp(
      'const\\s+' + name + '\\s*(?::\\s*[\\w.]+(?:<[^>]*>)?)?\\s*=\\s*(?:async\\s*)?\\(',
    ).exec(code);
    if (arrow) {
      open = arrow.index + arrow[0].length - 1;
    } else {
      const generic = new RegExp('const\\s+' + name + '\\s*:\\s*[\\w.]+<\\s*([A-Za-z_]\\w*)').exec(
        code,
      );
      return generic ? propsFromNamedType(code, generic[1]) : [];
    }
  }
  const params = sliceBalanced(code, open, '(', ')').trim();
  if (!params) {
    return [];
  }
  const destr = params.match(/^\{([\s\S]*?)\}\s*(?::|$)/);
  if (destr) {
    const names = destr[1]
      .split(',')
      .map((s) => s.trim().split(/[:=]/)[0].trim())
      .filter((n) => /^(?:\.\.\.)?[A-Za-z_]/.test(n))
      .map((n) => n.replace(/^\.\.\./, '…'));
    const types = typesForParams(code, params, destr[0].length);
    return names.map((n) => ({ name: n, type: types[n] || '' }));
  }
  const named = params.match(/:\s*([A-Za-z_]\w*)\s*$/);
  return named ? propsFromNamedType(code, named[1]) : [];
}

export function extractState(code) {
  const out = [];
  const seen = new Set();
  const push = (nm, hook) => {
    if (nm && !seen.has(nm)) {
      seen.add(nm);
      out.push({ name: nm, hook });
    }
  };
  let m;
  const stateRe = /const\s*\[\s*([A-Za-z_]\w*)\s*,[^\]]*\]\s*=\s*(useState|useReducer)\b/g;
  while ((m = stateRe.exec(code))) {
    push(m[1], m[2]);
  }
  const otherRe = /const\s+([A-Za-z_]\w*)\s*=\s*(useRef|useContext)\b/g;
  while ((m = otherRe.exec(code))) {
    push(m[1], m[2]);
  }
  return out;
}

export function extractEvents(code, props) {
  const callbacks = props.map((p) => p.name).filter((n) => /^on[A-Z]/.test(n));
  const tracked = [];
  const seen = new Set();
  let m;
  const re = /trackEvent\(\s*['"]([^'"]+)['"]/g;
  while ((m = re.exec(code))) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      tracked.push(m[1]);
    }
  }
  return { callbacks, tracked };
}

/**
 * Same-origin navigation targets a file points at — the raw path-ish strings from
 * `href="/…"`, `href={'/…'}`, `href={`/…`}` and `router.push/replace('/…')` /
 * `redirect('/…')`. Query/hash are stripped; external (http/mailto/tel), protocol-
 * relative (`//`) and pure-hash links are dropped (they are not page→page hops).
 * Template interpolations (`${…}`) are kept verbatim — the collector turns them
 * into a wildcard segment when matching against dynamic routes.
 */
export function extractNavHrefs(code) {
  const out = new Set();
  const add = (raw) => {
    const s = String(raw).trim().split('#')[0].split('?')[0];
    if (s.startsWith('/') && !s.startsWith('//')) {
      out.add(s);
    }
  };
  let m;
  const hrefRe = /\bhref\s*=\s*\{?\s*(['"`])([^'"`]*)\1/g;
  while ((m = hrefRe.exec(code))) {
    add(m[2]);
  }
  const navRe = /\b(?:router\s*\.\s*(?:push|replace)|redirect)\s*\(\s*(['"`])([^'"`]*)\1/g;
  while ((m = navRe.exec(code))) {
    add(m[2]);
  }
  return [...out];
}

export function extractExports(code) {
  const names = new Set();
  let m;
  const declRe = /export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_]\w*)/g;
  while ((m = declRe.exec(code))) {
    names.add(m[1]);
  }
  const braceRe = /export\s*(?:type\s*)?\{([^}]*)\}/g;
  while ((m = braceRe.exec(code))) {
    for (const part of m[1].split(',')) {
      const seg = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        .trim();
      if (/^[A-Za-z_]\w*$/.test(seg)) {
        names.add(seg);
      }
    }
  }
  if (/export\s+default/.test(code)) {
    names.add('default');
  }
  return [...names];
}
