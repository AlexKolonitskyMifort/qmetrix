#!/usr/bin/env node
/**
 * Guards the e2e suite against a stale `next start` server and a poisoned
 * prerender cache on the Playwright port.
 *
 * The PW config reuses an existing server locally (reuseExistingServer), so a
 * server started BEFORE the latest `next build` keeps serving HTML that
 * references chunk files which no longer exist on disk — JS fails to load,
 * React never hydrates, and every interaction-dependent test times out.
 * Worse, while such a server runs, its ISR revalidations WRITE old-build HTML
 * into the new build's prerender cache (.next/server/app), so even a freshly
 * started server then serves broken pages for those routes (Next serves the
 * stale cache entry first and only re-renders in the background).
 *
 * Two modes:
 *  - default: health-check a running server by fetching the home page and
 *    requesting the /_next/static assets it references (a fresh server serves
 *    its own assets; a stale one 404/500s them), then scan the prerender cache
 *    for entries referencing assets missing from .next/static and purge them.
 *  - --pre-build: a `next build` is about to run, which makes ANY currently
 *    running local server stale-after-build (and lets it poison the new
 *    build's cache via ISR). Kill it unconditionally.
 *
 * Outcomes (both modes): exit 0 when the port is safe for Playwright, exit 1
 * with instructions when the port is held by something unrecognized. Runs from
 * the npm scripts (test:e2e, coverage:e2e); invoking `playwright test`
 * directly bypasses it. Skipped when PW_BASE_URL targets a remote site.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT ?? 3000);
const BASE = `http://localhost:${PORT}`;
const MAX_ASSETS = 10;
const PRE_BUILD = process.argv.includes('--pre-build');
// Anchored on the consuming repo's cwd — every verb runs from the app root.
const rootDir = process.cwd();
const log = (msg) => console.log(`[e2e-server-guard] ${msg}`);

if (process.env.PW_BASE_URL) {
  log(`PW_BASE_URL is set (${process.env.PW_BASE_URL}) - remote run, nothing to guard.`);
  process.exit(0);
}

const isConnRefused = (err) => err?.cause?.code === 'ECONNREFUSED' || err?.code === 'ECONNREFUSED';

async function probeHome() {
  try {
    const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return { state: 'stale', reason: `GET / returned HTTP ${res.status}` };
    }
    return { state: 'up', html: await res.text() };
  } catch (err) {
    if (isConnRefused(err)) {
      return { state: 'free' };
    }
    return { state: 'stale', reason: `GET / failed (${err.cause?.code ?? err.name})` };
  }
}

async function findBrokenAssets(html) {
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\\ )?#]+\.(?:js|css)/g) ?? [])];
  if (assets.length === 0) {
    return [`no /_next/static assets found in the served HTML - not this app's Next server?`];
  }
  const broken = [];
  for (const asset of assets.slice(0, MAX_ASSETS)) {
    try {
      const res = await fetch(BASE + asset, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        broken.push(`${asset} -> HTTP ${res.status}`);
      }
    } catch (err) {
      broken.push(`${asset} -> ${err.cause?.code ?? err.name}`);
    }
  }
  return broken;
}

function findListeningPids() {
  if (process.platform === 'win32') {
    const out = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
    const re = new RegExp(`TCP\\s+\\S*:${PORT}\\s+\\S+\\s+LISTENING\\s+(\\d+)`, 'g');
    return [...new Set([...out.matchAll(re)].map((m) => Number(m[1])))];
  }
  try {
    const out = execFileSync('lsof', ['-ti', `tcp:${PORT}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
    return [...new Set(out.split('\n').filter(Boolean).map(Number))];
  } catch {
    return []; // lsof exits non-zero when nothing matches
  }
}

function commandLineOf(pid) {
  try {
    if (process.platform === 'win32') {
      return execFileSync(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`,
        ],
        { encoding: 'utf8' },
      ).trim();
    }
    return execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function killPid(pid) {
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    process.kill(pid, 'SIGTERM');
  }
}

async function waitForPortFree() {
  for (let i = 0; i < 20; i++) {
    try {
      await fetch(`${BASE}/`, { signal: AbortSignal.timeout(1000) });
    } catch (err) {
      if (isConnRefused(err)) {
        return true;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function killListeningServer(reason) {
  log(`killing server on :${PORT}: ${reason}`);
  const pids = findListeningPids();
  if (pids.length === 0) {
    log('could not find the owning process; free the port manually and retry.');
    process.exit(1);
  }
  for (const pid of pids) {
    const cmd = commandLineOf(pid);
    // Only kill processes that are recognizably this stack's dev/prod server.
    if (!/next|node/i.test(cmd)) {
      log(
        `port :${PORT} is held by PID ${pid} (${cmd || 'unknown command'}) - not a Next/Node server, refusing to kill it.`,
      );
      log('stop it manually (or set PW_BASE_URL to target it intentionally) and retry.');
      process.exit(1);
    }
    log(`killing PID ${pid} (${cmd})`);
    killPid(pid);
  }
}

// --- prerender-cache integrity ------------------------------------------------
// A stale server's ISR writes leave .next/server/app entries whose HTML/RSC
// reference assets from the previous build. Detect them by checking every
// /_next/static (or flight-payload "static/...") reference against the files
// actually present in .next/static, and purge the whole route entry
// (.html/.rsc/.meta/.segments) so the fresh server re-renders it on demand.

function* walkFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(p);
    } else {
      yield p;
    }
  }
}

function staticRefsOf(text) {
  const refs = new Set();
  for (const m of text.match(/\/_next\/static\/[^"'\\ )?#]+/g) ?? []) {
    refs.add(m.slice('/_next/static/'.length));
  }
  for (const m of text.match(/\bstatic\/(?:chunks|css|media)\/[^"'\\ )?#]+/g) ?? []) {
    refs.add(m.slice('static/'.length));
  }
  return refs;
}

function purgePoisonedPrerenders() {
  const appDir = path.join(rootDir, '.next', 'server', 'app');
  const staticDir = path.join(rootDir, '.next', 'static');
  const poisoned = new Set();
  if (!existsSync(appDir) || !existsSync(staticDir)) {
    return poisoned;
  }
  const segMarker = `.segments${path.sep}`;
  for (const file of walkFiles(appDir)) {
    if (!/\.(html|rsc)$/.test(file)) {
      continue;
    }
    // Files inside <route>.segments/ belong to that route; purge at route level.
    const base = file.includes(segMarker)
      ? file.slice(0, file.indexOf(segMarker))
      : file.replace(/\.(prefetch\.rsc|rsc|html)$/, '');
    if (poisoned.has(base)) {
      continue;
    }
    for (const ref of staticRefsOf(readFileSync(file, 'utf8'))) {
      if (!existsSync(path.join(staticDir, ref))) {
        poisoned.add(base);
        log(`poisoned prerender: ${path.relative(rootDir, file)} references missing static/${ref}`);
        break;
      }
    }
  }
  for (const base of poisoned) {
    for (const suffix of ['.html', '.rsc', '.prefetch.rsc', '.meta']) {
      rmSync(base + suffix, { force: true });
    }
    rmSync(base + '.segments', { recursive: true, force: true });
    log(`purged stale prerender entry: ${path.relative(rootDir, base)}.* (re-rendered on demand)`);
  }
  if (poisoned.size === 0) {
    log('prerender cache is consistent with .next/static.');
  }
  return poisoned;
}

// --- main ----------------------------------------------------------------------

if (PRE_BUILD) {
  // A rebuild is imminent: any running local server WILL be stale afterwards
  // and would poison the new build's prerender cache via ISR writes.
  if (findListeningPids().length === 0) {
    log(`nothing listening on :${PORT} - safe to build.`);
  } else {
    killListeningServer('a new build is about to replace .next under it');
    if (!(await waitForPortFree())) {
      log(`port :${PORT} is still busy after kill; free it manually and retry.`);
      process.exit(1);
    }
    log('server killed - safe to build.');
  }
  process.exit(0);
}

const probe = await probeHome();
let needsKill = null;
if (probe.state === 'stale') {
  needsKill = probe.reason;
} else if (probe.state === 'up') {
  const broken = await findBrokenAssets(probe.html);
  if (broken.length > 0) {
    needsKill = `serves assets that fail to load:\n  ${broken.join('\n  ')}`;
  }
}

if (needsKill) {
  killListeningServer(needsKill);
  if (!(await waitForPortFree())) {
    log(`port :${PORT} is still busy after kill; free it manually and retry.`);
    process.exit(1);
  }
  log('stale server killed - Playwright will start a fresh one.');
  purgePoisonedPrerenders();
} else if (probe.state === 'free') {
  log(`nothing listening on :${PORT} - Playwright will start a fresh server.`);
  purgePoisonedPrerenders();
} else {
  // Server looks healthy, but if the on-disk prerender cache held poisoned
  // entries the server would still serve them (and may have them in memory) —
  // in that case restart it on top of the purged cache.
  const poisoned = purgePoisonedPrerenders();
  if (poisoned.size > 0) {
    killListeningServer('its in-memory cache may hold the purged poisoned entries');
    if (!(await waitForPortFree())) {
      log(`port :${PORT} is still busy after kill; free it manually and retry.`);
      process.exit(1);
    }
    log('server restart forced - Playwright will start a fresh one on the purged cache.');
  } else {
    log(`server on :${PORT} serves its own assets - safe to reuse.`);
  }
}
