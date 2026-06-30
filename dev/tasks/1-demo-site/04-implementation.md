# Implementation: Add runnable demo site showcasing QMetriX capabilities
> Task: 1-demo-site | Issue: #1 | Branch: feature/1-demo-site | Date: 2026-06-30 | Fixed-in: 1.0.0

## What Was Done
A `dev/demo/` orchestrator behind `npm run demo` that dogfoods QMetriX against this repo and
assembles a self-contained, GitHub-Pages-ready `dist/site/`, served over `node:http`.

| Subtask | Status | Commit | Notes |
| --- | --- | --- | --- |
| **T1** Sample report fixtures | ✅ | `570693a` | `dev/demo/fixtures/reports/`: 3 Istanbul `coverage-summary.json` (unit/e2e/global), `qmetrix-codeql.sarif`, `snyk-deps.sarif`, `npm-audit.json`, `npm-outdated.json` — shapes matched to the collectors. |
| **T2** Static server | ✅ | `570693a` | `dev/demo/serve.mjs` — `node:http`, MIME map, dir→`index.html`, path-traversal guard, port auto-increment. Zero deps. |
| **T3** Landing generator | ✅ | `570693a` | `dev/demo/landing.mjs` — intro, **sample-data disclaimer**, live-stats strip, artifact link cards with live/sample badges. |
| **T4** Orchestrator | ✅ | `570693a` | `dev/demo/run.mjs` — clean → seed → run `audit-structure` + `quality-dashboard` (via `process.execPath`, `cwd=ROOT`) → assemble landing → serve. CLI `--no-serve/--port/--host/--open`. |
| **T5** npm scripts | ✅ | `8ccdd53`, `94fd179` | `scripts.demo` + `scripts.demo:build` (latter chains the smoke check). |
| **T6** Docs | ✅ | `8e374d9` | `dev/demo/README.md`, `CLAUDE.md` (§3 layout row + §8 commands), `README.md` (Demo section). |
| **T7** Verify + packaging guard | ✅ | `94fd179` | `dev/demo/check.mjs` — asserts the 5 artifacts exist and the emitted pages have no escaping links; wired into `demo:build`. Full verification gate run (below). |

## Deviations from Design
| What | Why | Impact |
| --- | --- | --- |
| **Duplication is sample-backed here, not live** — added `dev/demo/fixtures/jsinspect.sample.json` + a live-vs-sample fallback in `run.mjs` (new file, not in the design inventory). | Dogfooding surfaced a real limitation: `jsinspect-plus` only scans `.js/.jsx/.ts/.tsx`, but QMetriX's source is all `.mjs`, so `qmetrix-audit-structure` finds no files and writes no report. | Duplication panel/report shows a labelled **sample** for this `.mjs` repo; a real `.js/.ts` consumer still gets the **live** report. Honestly labelled in the UI + `dev/demo/README.md`. Candidate follow-up: teach `audit-structure`/jsinspect to scan `.mjs` (benefits #2). |
| **AC-2 served bundle path** = `dist/site/codebase-bundle.html` (the dashboard's internal bundle), not `dist/reports/codebase-bundle.html`. | Avoid bundling the whole tree twice; the dashboard already emits a self-contained bundle into the served dir. | Pre-flagged in design; AC-2 wording updated accordingly below. |
| **`check.mjs` link-scan scoped to `index.html` + `dashboard.html`** (excludes `codebase-bundle.html`). | The bundle embeds the whole repo's source as display text, so it legitimately contains strings like `href="../"` (e.g. these task docs) → false positives. | Self-containment of the pages we emit is still enforced; the bundle is a single self-contained file by the bin's contract. |

No design contracts, scope, or public surface changed. All new code is under `dev/`; `files`,
`dependencies`, and `engines` are untouched.

## AC Verification
| AC | How verified | Result |
| --- | --- | --- |
| AC-1 `npm run demo` binds + prints URL | Spawned `dev/demo/run.mjs --port 8077`; captured `serving at http://127.0.0.1:8077`; `GET /` → 200 | ✅ |
| AC-2 live bins produced artifacts | `dist/site/{dashboard.html,dashboard.json,codebase-bundle.html}` + `jsinspect.json` present after run | ✅ (bundle in `dist/site/`, per refinement) |
| AC-3 coverage & security populated + labelled | Dashboard report inventory shows 7/12 artifacts (coverage unit/e2e/global, npm audit/outdated, Snyk, CodeQL); landing carries "Demo data notice" disclaimer | ✅ |
| AC-4 URL serves dashboard; links resolve | `fetch` of `/`, `/dashboard.html`, `/codebase-bundle.html`, `/jsinspect.json`, `/dashboard.json` → all 200 with correct content-type | ✅ |
| AC-5 opens from filesystem & under sub-path | `check.mjs` greps emitted pages for `../` / `file://` / `localhost` / drive-absolute / root-absolute links → none found | ✅ |
| AC-6 offline / no creds | Executed path runs only `audit-structure` + `quality-dashboard` (local file reads + local `git`); `npm audit`/`security-scan`/Snyk/CodeQL networked paths are **not** invoked; ran with no tokens present | ✅ (by construction) |
| AC-7 every artifact reachable from root | Landing `index.html` links dashboard, bundle, `jsinspect.json`, `dashboard.json`; all fetch 200 | ✅ |
| AC-8 idempotent re-run | Built twice from a clean `dist/`; `find dist/site -type f` identical both runs | ✅ |
| AC-9 tarball only `src/` | `npm pack --dry-run` → 38 files, all under `src/` + `package.json`/`README`/`LICENSE`; no `dev/`, `.claude/`, `dist/` | ✅ |
| AC-10 deps unchanged / dev-only | `git diff main -- package.json` → only `scripts` added; no dependency lines changed; server uses `node:http` | ✅ |

## Test & Verify Results
*(no lint/test framework is wired in this repo — CLAUDE.md §8; verification is bin-run + packaging, per the design Test Strategy)*

```
$ npm run demo:build
… Report inventory — 7/12 artifacts found (collect-only) …
✅  Dashboard:  dist/site/dashboard.html
[demo] Demo site ready → dist\site/index.html
✓ demo check: 5 artifacts present; 2 emitted pages self-contained.        (exit 0)

$ # serve + fetch
printed URL: http://127.0.0.1:8077
GET / -> 200 text/html
landing has sample-data disclaimer: true                                  (AC-1/3/4 OK)

$ # static server fetch matrix
200 text/html        /
200 text/html        /dashboard.html
200 text/html        /codebase-bundle.html
200 application/json  /jsinspect.json
200 application/json  /dashboard.json
404                   /../../package.json   (traversal blocked)            (SERVE OK)

$ # idempotency (build twice from clean dist/)
diff run1 run2 → IDENTICAL — no stale files                                (AC-8 OK)

$ npm pack --dry-run  → total files: 38 ; non-src leak: NONE              (AC-9 OK)
$ git diff main -- package.json → no dependency lines changed             (AC-10 OK)
```

## How to Verify Manually
1. `npm ci` on a clean checkout.
2. `npm run demo` → open the printed `http://localhost:8080`.
3. Landing page: confirm the **Demo data notice** disclaimer, the stats strip, and four artifact
   cards (Dashboard `sample/live` badges, Codebase bundle, Structural-duplication, Raw data).
4. Click into the dashboard: Coverage and Security panels are populated (sample); Code/Deps/Graph
   are real.
5. `npm run demo:build` → confirm `✓ demo check` passes and `dist/site/` contains the 5 files.
6. Open `dist/site/index.html` directly from the filesystem — links still resolve (self-contained).
7. `npm pack --dry-run` → only `src/` (+ package.json/README/LICENSE) is listed.

---
**Stage report:** 7/7 subtasks complete across 4 commits · 3 deviations (all recorded, none changing
contracts) · 10/10 ACs verified · packaging boundary & deps unchanged. Next: `/task-code-review 1-demo-site`.
