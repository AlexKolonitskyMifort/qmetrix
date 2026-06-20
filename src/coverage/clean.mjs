#!/usr/bin/env node
/**
 * Remove a coverage suite's outputs before a fresh run.
 *
 * MCR's own coverage cache lives under <report-dir>/.cache and is cleared by MCR
 * on generate, so removing the report dir covers it. NODE_V8_COVERAGE server
 * dumps live separately under .raw/<suite>-server/ and must be cleared here so a
 * rerun doesn't fold in last run's dumps.
 *
 *   node dev/scripts/coverage/clean.mjs <e2e|storybook|global>
 */
import { rmSync } from 'node:fs';
import path from 'node:path';

const suite = process.argv[2];
if (!suite) {
  console.error('usage: node dev/scripts/coverage/clean.mjs <e2e|storybook|global>');
  process.exit(1);
}

const ROOT = process.cwd();
const COV = path.join(ROOT, 'dist', 'reports', 'coverage');

const targets = [path.join(COV, suite)];
if (suite !== 'global') {
  targets.push(path.join(COV, '.raw', `${suite}-server`));
}

for (const dir of targets) {
  rmSync(dir, { recursive: true, force: true });
  console.log(`[coverage:clean] removed ${path.relative(ROOT, dir) || dir}`);
}
