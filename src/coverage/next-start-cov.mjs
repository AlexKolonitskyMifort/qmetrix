#!/usr/bin/env node
/**
 * Launch `next start` in-process and flush V8 coverage on shutdown signals.
 *
 * NODE_V8_COVERAGE is only written on a CLEAN process exit. Playwright stops the
 * web server with SIGTERM — and on Windows that terminates the process WITHOUT
 * delivering a catchable signal, so a shutdown-only flush never runs and the
 * server-side coverage is lost. So we flush on a short interval: `v8.takeCoverage()`
 * writes the cumulative coverage to the NODE_V8_COVERAGE dir on demand, so the
 * latest snapshot survives even an abrupt kill. Signal/exit handlers add a final
 * flush where the platform allows it. Used only by the coverage:e2e web server
 * (see playwright.config.ts).
 */
import v8 from 'node:v8';

const flush = () => {
  try {
    v8.takeCoverage();
  } catch {
    // takeCoverage throws if NODE_V8_COVERAGE isn't set — nothing to flush then.
  }
};

// Periodic flush is the load-bearing one (survives Windows' non-graceful kill).
const timer = setInterval(flush, 1500);
timer.unref?.();

const shutdown = () => {
  flush();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('exit', flush);

// The Next CLI reads process.argv.slice(2); make it `start`.
process.argv.splice(2, process.argv.length, 'start');
await import('next/dist/bin/next');
