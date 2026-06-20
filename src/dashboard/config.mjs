/**
 * Shared paths for the quality-dashboard modules.
 *
 * These were previously a global closure inside quality-dashboard.mjs. Exporting
 * them from one place keeps the collectors/utils free of `import.meta.url` math
 * and gives every layer a single source of truth for where the project lives.
 */
import path from 'node:path';

/** Repository root — the consuming repo's cwd (every QMetriX verb runs from the app root). */
export const ROOT = process.cwd();
/** Application source root. */
export const SRC = path.join(ROOT, 'src');
/** Optional curated dependency-notes.json location (app-side; absent → notes default to {}). */
export const SCRIPTS_DIR = path.join(ROOT, 'dev', 'scripts');
