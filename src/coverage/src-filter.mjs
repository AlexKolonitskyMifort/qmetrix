/**
 * Shared source filter for the coverage reports (report-suite.mjs, report-global.mjs).
 *
 * Mirrors jest's collectCoverageFrom (.config/jest.config.mjs): the project's own
 * src/**\/*.{ts,tsx} minus stories, tests, e2e specs and .d.ts, so all four suites
 * share one file universe.
 *
 * The on-disk existence check is load-bearing: bundled third-party packages
 * (lucide-react, @heroui/*) ship source maps whose `sources` are bare `src/…` /
 * `shared/src/…` paths with NO node_modules prefix, so a plain `/src/` match would
 * fold ~230 vendor files into the totals. Resolving the tail against <root>/src and
 * requiring it to exist keeps only the app's real source files.
 *
 * Vendor maps that DO keep the `node_modules/` prefix (e.g.
 * `node_modules/@opentelemetry/instrumentation/src/instrumentation.ts`) would still
 * slip through when their tail collides with a real file name (we have
 * `src/instrumentation.ts`), so reject anything under node_modules outright first.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.join(process.cwd(), 'src');

export function inSrc(sourcePath) {
  const s = String(sourcePath).replace(/\\/g, '/');
  if (s.includes('node_modules/')) {
    return false;
  }
  const i = s.lastIndexOf('/src/');
  const rel = i >= 0 ? s.slice(i + 5) : s.startsWith('src/') ? s.slice(4) : null;
  if (rel == null) {
    return false;
  }
  if (!/\.(ts|tsx)$/.test(rel)) {
    return false;
  }
  if (/\.stories\.tsx$/.test(rel)) {
    return false;
  }
  if (/\.test\.(ts|tsx)$/.test(rel)) {
    return false;
  }
  if (/\.(e2e|storybook)\.spec\.ts$/.test(rel)) {
    return false;
  }
  if (/\.d\.ts$/.test(rel)) {
    return false;
  }
  return existsSync(path.join(SRC_ROOT, rel));
}
