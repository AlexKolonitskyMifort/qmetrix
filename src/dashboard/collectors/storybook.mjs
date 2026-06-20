/**
 * Storybook — collect-only.
 *
 * Counts the story files in the source tree and checks whether a static Storybook has
 * been built next to the dashboard (dist/site/storybook). It never builds Storybook
 * itself; `npm run quality:dashboard` builds it first (or run `npm run build-storybook`).
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

import { SRC } from '../config.mjs';
import { walk } from '../utils/fs.mjs';

const STORY_RE = /\.stories\.(tsx|jsx|ts|js|mdx)$/;

/**
 * @param {string} outDir directory the dashboard html is written to (its `storybook/`
 *                        subfolder is where a built static Storybook is expected).
 */
export function collectStorybook(outDir) {
  const storyCount = walk(SRC).filter((f) => STORY_RE.test(f)).length;
  const builtIndex = path.join(outDir, 'storybook', 'index.html');
  const built = existsSync(builtIndex);
  return {
    available: true,
    storyCount,
    built,
    href: './storybook/',
    note: built
      ? null
      : 'Static Storybook not built next to the dashboard. Run `npm run quality:dashboard` (or `npm run build-storybook`).',
  };
}
