/** Pure string/number formatting helpers shared by the renderers. */

/** HTML-escape a value for safe interpolation into the report. */
export const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/** Format a percentage (one decimal), or em-dash when missing/non-numeric. */
export const pct = (n) => (typeof n === 'number' && Number.isFinite(n) ? `${n.toFixed(1)}%` : '—');

/** Format an integer with thousands separators, or em-dash when missing/non-numeric. */
export const num = (n) => {
  const v = Number(n);
  return n == null || Number.isNaN(v) ? '—' : v.toLocaleString('en-US');
};

/** Format a byte count as B / KB / MB, or em-dash when missing/non-numeric. */
export const bytes = (n) => {
  const v = Number(n);
  if (n == null || Number.isNaN(v)) {
    return '—';
  }
  if (v < 1024) {
    return `${v} B`;
  }
  if (v < 1024 * 1024) {
    return `${(v / 1024).toFixed(1)} KB`;
  }
  return `${(v / 1024 / 1024).toFixed(2)} MB`;
};
