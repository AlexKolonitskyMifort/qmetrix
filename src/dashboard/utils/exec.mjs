/** Shell-command execution + the progress logger. */
import { spawnSync } from 'node:child_process';

import { ROOT } from '../config.mjs';

/** Progress line printed while collectors run. */
export const log = (...a) => console.log('•', ...a);

/**
 * Run a shell command, returning {code, stdout, stderr, error} — never throws.
 * Defaults the working directory to the repository root so callers can stay
 * path-agnostic; pass `cwd` to override.
 */
export function exec(cmd, { cwd = ROOT, timeout = 600_000 } = {}) {
  const r = spawnSync(cmd, {
    cwd,
    shell: true,
    encoding: 'utf8',
    timeout,
    maxBuffer: 128 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    code: r.status ?? (r.error ? 1 : 0),
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    error: r.error || null,
  };
}
