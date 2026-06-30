# QMetriX demo site

A one-command, offline showcase of what QMetriX produces. It **dogfoods QMetriX against
this repository** and assembles a self-contained, GitHub-Pages-ready site under
`dist/site/`.

```bash
npm run demo          # build + serve at http://localhost:8080
npm run demo:build    # build only (writes dist/site/, runs the smoke check) — no server
```

`npm run demo` flags (pass after `node dev/demo/run.mjs`):

| Flag | Effect |
| --- | --- |
| `--no-serve` | Build `dist/site/` and exit (what `demo:build` uses). |
| `--port <n>` | Preferred port (default `8080`, or `$QMETRIX_DEMO_PORT`); auto-increments if busy. |
| `--host <h>` | Bind host (default `127.0.0.1`). |
| `--open` | Open the served URL in the default browser. |

## What it produces

```
dist/site/
  index.html            landing page (links every artifact + the data notice)
  dashboard.html         qmetrix-quality-dashboard output
  dashboard.json         the dashboard's raw collected data
  codebase-bundle.html   qmetrix-bundle-codebase output (whole repo, one browsable page)
  jsinspect.json         structural-duplication report
```

The directory is **self-contained** — only relative links and inlined assets — so it works
from `file://` and uploads to **GitHub Pages** unchanged (including under a project
sub-path like `/<repo>/`). To publish, point Pages at the contents of `dist/site/`.

## Live vs. sample data

QMetriX is a build-less ESM package with no test suite and no security toolchain, so a pure
dogfood run would leave several dashboard panels empty. The demo runs a **hybrid**:

| Signal | Source |
| --- | --- |
| Code overview, languages, file graph, dependency inventory | **live** — computed from this repo |
| Codebase bundle | **live** — `qmetrix-bundle-codebase` |
| Coverage, security (Snyk/CodeQL), npm audit/outdated | **sample** — `dev/demo/fixtures/reports/` |
| Structural duplication | **live for `.js`/`.ts` consumers**; here it falls back to a **sample** (see below) |

The sample inputs live in `dev/demo/fixtures/` and are seeded into `dist/reports/` before the
dashboard runs. The landing page and dashboard label sample-backed panels accordingly — **do
not read coverage/security numbers as QMetriX's real metrics.**

### Why duplication falls back to a sample

`qmetrix-audit-structure` uses `jsinspect-plus`, which only scans `.js/.jsx/.ts/.tsx`.
QMetriX's own source is all `.mjs`, so the live audit finds no files and writes no report.
The runner detects the missing report and substitutes
`dev/demo/fixtures/jsinspect.sample.json` (clearly labelled). A consumer whose sources are
`.js`/`.ts` gets the **live** duplication report instead.

## Boundaries

- Everything here lives under `dev/` and is **excluded from the npm tarball** (`files: ["src"]`).
- No runtime dependency is added — the static server is `node:http`.
- The bins are invoked from the repo root (`process.cwd()`), preserving the cwd contract.
- Offline & credential-free: the demo never runs `qmetrix-security-scan`'s networked path,
  `npm audit`, or anything needing auth.

## Related

- Task: `dev/tasks/1-demo-site/` (requirements → design → plan → implementation).
- Synergy with **#2 (dogfood-self-metrics)**: that task owns producing QMetriX's *real*
  metrics; this demo owns *assembling + serving* and uses samples where real data doesn't
  exist yet. If #2 later adds an `npm run metrics`, the demo can consume it.
