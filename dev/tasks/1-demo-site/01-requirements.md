# Requirements: Add runnable demo site showcasing QMetriX capabilities
> Task: 1-demo-site | Issue: #1 | Date: 2026-06-30 | Status: draft

## Summary
QMetriX produces rich quality artifacts (quality dashboard, codebase bundle, coverage,
structural-duplication audit, security scan) but there is no way to see them without installing the
package into a host repo. This task adds a **runnable, offline demo** that runs the QMetriX bins
against **this repo itself** (dogfooding), assembles a self-contained `dist/site/`, and serves it
locally via `npm run demo` — with the output structured so it can be published to GitHub Pages as-is.
It targets prospective users evaluating the package and maintainers previewing changes.

## Context & Goal
- **Goal:** make QMetriX's capabilities visible in one command, without cloning a consumer repo or
  installing the package as a devDependency elsewhere.
- **Decisions taken at requirements stage** (via stakeholder Q&A):
  1. **Source = dogfood.** The demo runs the bins against this repo (`process.cwd()` = repo root),
     not against a separate fixture app.
  2. **Execution = hybrid.** Bins that run offline with no credentials are invoked **live**
     (`qmetrix-quality-dashboard`, `qmetrix-bundle-codebase`, `qmetrix-audit-structure`). Signals that
     require external tools/auth (`qmetrix-security-scan` SARIF, full coverage) are **pre-seeded** from
     committed **illustrative sample reports** so the dashboard sections render populated.
  3. **Delivery = local + Pages-ready.** `npm run demo` builds and serves locally; `dist/site/` is a
     self-contained, GitHub-Pages-publishable static bundle. **No CI/Pages workflow** in this task.
- **Where the code lives:** demo runner + sample reports under `dev/` (e.g. `dev/demo/`); output under
  the consumer's (= this repo's) `dist/` — both git-ignored / unpublished. See
  [CLAUDE.md](../../../CLAUDE.md) §2 (cwd contract), §3 (`dev/` not shipped), §6 (tiny deps).
- **Current outputs that already exist** (from a prior dogfood run, git-ignored): `dist/site/index.html`,
  `dist/site/index.json`, `dist/site/codebase-bundle.html`, `dist/reports/codebase-bundle.html`,
  `dist/reports/npm-audit.json`, `dist/reports/npm-outdated.json`.

## Actors & User Stories
- **Evaluator (prospective user):** "As someone deciding whether to adopt QMetriX, I want to open a
  live demo and see real sample output — the dashboard, the codebase bundle, coverage/audit/security
  sections — so I understand what the package produces without installing it."
- **Maintainer / contributor:** "As a QMetriX contributor, I want `npm run demo` to regenerate and
  serve the demo locally so I can preview the effect of a change before publishing."
- **(Indirect) CI / Pages, future:** consumes the static `dist/site/` produced here — out of scope to
  wire, but the output contract must support it.

## Functional Requirements

**FR-1 — `npm run demo` entry point.** `package.json` gains a `scripts.demo` (and may add supporting
sub-scripts) that runs the whole demo end-to-end with no arguments: seed sample reports → live-run the
offline bins → assemble `dist/site/` → serve locally and print the URL.

**FR-2 — Live-run the offline bins against this repo.** The demo invokes, anchored on
`process.cwd()` = repo root: `qmetrix-quality-dashboard` (→ `dist/site/index.html`, `index.json`,
`codebase-bundle.html`), `qmetrix-bundle-codebase` (→ `dist/reports/codebase-bundle.html`), and
`qmetrix-audit-structure` (→ `dist/reports/jsinspect.json`). No credentials or network required.

**FR-3 — Pre-seed illustrative sample reports.** Before the dashboard runs, the demo copies committed
sample reports from `dev/demo/` into `dist/reports/` so the dashboard's **coverage** and **security**
sections render populated: at minimum `dist/reports/coverage/<suite>/coverage-summary.json` and
`dist/reports/*.sarif`. These are clearly labelled in the demo as **illustrative sample data**, not
QMetriX's real metrics.

**FR-4 — Serve the assembled site locally.** The demo starts a local static HTTP server rooted at
`dist/site/`, prints the served URL (e.g. `http://localhost:8080`), and serves `index.html`
(dashboard), `codebase-bundle.html`, and any reports linked from the dashboard.

**FR-5 — Self-contained, Pages-ready static output.** After a demo run, `dist/site/` is openable
offline (assets inlined or referenced by **relative** paths — no `localhost`/absolute URLs, no
file-system-absolute paths) such that the same directory can be uploaded to GitHub Pages (including a
project sub-path like `/<repo>/`) and work unchanged.

**FR-6 — Fully offline, no secrets.** A complete demo run performs **zero network egress** and requires
**no credentials/tokens** (no Snyk auth, no CodeQL download). The credentialed/live path of
`qmetrix-security-scan` is **not** invoked; its section is populated from the sample SARIF only.

**FR-7 — Navigable artifact index.** A visitor can reach every showcased artifact from the served root:
the dashboard, the codebase bundle, and the coverage/audit/security views. (The dashboard already links
the codebase bundle; the demo ensures coverage/audit/security are reachable — via the dashboard or a
minimal landing index emitted into `dist/site/`.)

**FR-8 — Repeatable / idempotent.** `npm run demo` can be re-run on a dirty `dist/`; it cleans or
overwrites prior demo output so no stale files survive, and produces the same site structure each run.

## Non-Functional Requirements

**NFR-1 — Packaging boundary unchanged.** Demo runner and sample reports live under `dev/`; `files`
stays `["src"]`. `npm pack --dry-run` shows **no** `dev/`, `.claude/`, or `dist/` entries in the tarball.

**NFR-2 — No new runtime dependency.** Nothing is added to `dependencies`. The local static server uses
the Node standard library (`node:http`) by preference; any unavoidable demo tooling goes in
`devDependencies` only, with a stated justification (CLAUDE.md §6).

**NFR-3 — cwd contract preserved.** Bins are invoked with the repo root as `process.cwd()`; the runner
does not anchor consumer paths on `import.meta.url`/`__dirname` and hardcodes no absolute paths.

**NFR-4 — Clean-checkout reproducible.** The demo runs after `npm ci` with no further manual setup;
it does not depend on a developer's pre-existing `dist/` state.

**NFR-5 — Node 22.x only.** Runs on the closed `engines.node` `"22.x"` range; uses no API outside the
Node 22 feature set; no transpile/build step is introduced.

**NFR-6 — Cross-platform (incl. Windows).** The runner uses `node:path` for path handling and avoids
Unix-only shell constructs, so `npm run demo` works on Windows as well as Linux/macOS.

**NFR-7 — Soft-fail on missing inputs.** If a sample report is absent or a live bin produces nothing,
the affected dashboard section degrades to its existing "not configured / run this" state rather than
crashing the demo (matches collectors' soft-fail behaviour, CLAUDE.md §5).

## Current System Mapping
| Requirement | Current behavior | Gap |
| --- | --- | --- |
| FR-1 `npm run demo` | `package.json` has **no `scripts` section** at all | **New** — add `scripts.demo` (+ helpers) |
| FR-2 live-run offline bins | Bins exist, are `process.cwd()`-anchored, write `dist/site/` + `dist/reports/` | **New orchestration** — a `dev/demo/` runner that calls them in order |
| FR-3 pre-seed sample reports | Collectors read `dist/reports/coverage/*` & `dist/reports/*.sarif`; **none exist** for this repo (no tests/security toolchain) | **New** — committed sample reports under `dev/demo/` + a copy step |
| FR-4 local server | No server, no scripts | **New** — `node:http` static server (or dev-dep) |
| FR-5 Pages-ready static | Dashboard is a self-contained single HTML (inline CSS/JS); bundle similar | **Partial** — verify relative-only links / sub-path safety; add landing index if needed |
| FR-6 offline/no-creds | `quality-dashboard`/`bundle-codebase`/`audit-structure` are offline; `security-scan` needs Snyk auth/CodeQL download | **Satisfied by design** — security-scan live path not invoked |
| FR-7 artifact index | Dashboard links codebase-bundle; coverage/security shown inside dashboard | **Partial** — ensure all reachable from served root |
| FR-8 idempotent | n/a | **New** — clean/regenerate step |
| NFR-1 packaging | `files: ["src"]`; `dev/`, `dist/` excluded/ignored | **Satisfied** — keep demo under `dev/`; verify with `npm pack` |
| NFR-2 no runtime dep | 3 runtime deps; no dev deps | **Satisfied** if server uses `node:http` |

## Out of Scope
- **Task #2's real metrics pipeline.** Wiring genuine coverage/security/CI metric *production* for
  QMetriX is **#2 (dogfood-self-metrics)**. This task **consumes/serves** output and uses *sample*
  reports where real ones don't exist; it does **not** stand up a test/coverage/security toolchain.
- **A separate fixture/sample app** (the rejected "fixture" option). Source is this repo only.
- **GitHub Actions / Pages auto-deploy workflow.** Output is made Pages-*ready*; the deploy workflow is
  a follow-up.
- **Lighting up app-only collectors** (routing, storybook, entities, composition, supabase): QMetriX
  has none of those inputs; those sections stay "not configured" unless trivially sample-seeded.
- **Running `optimize-images`, `e2e-server-guard`, `test-outline`, `coverage-*` live** as part of the
  demo — outside the named showcase set; may be mentioned, not executed.
- **Any redesign of the dashboard UI/layout** — that is task **#9**.
- **Changing any bin's behaviour, output path, or flags** — the demo orchestrates existing bins as-is.

## Edge Cases
- **Re-run over existing `dist/`:** stale files from a prior run must not survive (FR-8).
- **Port already in use:** serve on the next free port or fail with a clear message (not a stack trace).
- **Sample report missing/corrupt:** demo still assembles the site; affected section soft-fails (NFR-7).
- **Invoked from a subdirectory:** breaks the cwd contract → usage error, not a silently wrong run; the
  `npm run demo` script always runs from repo root, but the runner should not assume otherwise silently.
- **Windows path separators / native `sharp`:** runner must not assume POSIX paths; the showcased set
  avoids `sharp`-dependent bins so the ABI is not exercised.
- **Pages project sub-path** (`https://user.github.io/<repo>/`): relative asset links must resolve under
  a non-root base path (FR-5).
- **`npm pack --dry-run`:** confirm the tarball contains only `src/` — no `dev/demo/`, no `dist/`.

## Acceptance Criteria
- **AC-1 (FR-1):** Given a clean checkout after `npm ci`, When I run `npm run demo`, Then it completes
  with exit 0 and prints a local URL to open.
- **AC-2 (FR-2):** Given the demo has run, Then `dist/site/index.html`, `dist/site/codebase-bundle.html`,
  `dist/reports/codebase-bundle.html`, and `dist/reports/jsinspect.json` all exist and were produced by
  the live bins in this run.
- **AC-3 (FR-3):** Given the demo has run, When I open the dashboard, Then the **coverage** and
  **security** sections show populated data (from the seeded samples), each marked as illustrative
  sample data, rather than "not configured".
- **AC-4 (FR-4):** Given `npm run demo` is running, When I open the printed URL, Then the dashboard
  loads, and links to the codebase bundle and reports resolve (HTTP 200).
- **AC-5 (FR-5):** Given a finished run, When I open `dist/site/index.html` directly from the filesystem
  (no server) and when the directory is served under a `/<repo>/` sub-path, Then the page and its assets
  load with no broken (absolute/`localhost`) links.
- **AC-6 (FR-6):** Given network access is disabled and no Snyk/CodeQL credentials are present, When I
  run `npm run demo`, Then it still completes successfully with no failed network calls.
- **AC-7 (FR-7):** Given the served site, Then every showcased artifact (dashboard, codebase bundle,
  coverage, audit, security) is reachable by navigation from the root URL.
- **AC-8 (FR-8):** Given a `dist/` left over from a previous run, When I re-run `npm run demo`, Then the
  result is identical in structure with no stale leftover files.
- **AC-9 (NFR-1):** Given the package, When I run `npm pack --dry-run`, Then the listed files are under
  `src/` only — no `dev/`, `.claude/`, or `dist/` entries.
- **AC-10 (NFR-2):** Given the change, Then `package.json` `dependencies` is unchanged (still 3 runtime
  deps); any added tooling appears only under `devDependencies`, or none is added.

## Open Questions & Assumptions
| # | Question | Working assumption | Blocking? |
| --- | --- | --- | --- |
| 1 | Do the sample coverage/security reports describe QMetriX's real files or are they generic? | **Generic-but-plausible** sample reports committed under `dev/demo/`, clearly labelled illustrative; they need not map to real QMetriX paths. | No |
| 2 | Static server: `node:http` vs a dev-dep (`sirv`/`http-server`)? | **`node:http`** (zero new dep, NFR-2). Revisit only if relative-path/SPA serving needs it. | No |
| 3 | Landing page: emit a dedicated `dist/site/` index, or rely on the dashboard's own nav? | Rely on the dashboard nav; add a **minimal landing index only if** an artifact isn't otherwise reachable (FR-7). | No |
| 4 | Boundary with #2 (dogfood-self-metrics): should the demo depend on #2's wiring? | **No dependency** — #1 runs the offline bins itself and seeds samples; if #2 later adds `npm run metrics`, the demo *may* call it, but must not require it. | No |
| 5 | Default serve port? | **8080**, overridable via env/flag; auto-increment if busy. | No |
| 6 | Should `qmetrix-security-scan`'s offline portions run at all? | **No** — not invoked live; security section comes only from sample SARIF (FR-6). | No |

### ⚠ Conflicts / tensions flagged (not silently resolved)
- **Overlap with task #2 (dogfood-self-metrics).** Both run the bins against this repo. Boundary to
  confirm at design: **#2 owns metrics *production* (real coverage/security/CI); #1 owns demo
  *assembly + serving*** and uses sample reports for signals #2 hasn't produced yet. Resolved here as a
  dependency-free split (Q4) — confirm with the team before design.
- **"Showcase capabilities" vs "dogfood a build-less package."** QMetriX legitimately lacks coverage,
  Storybook, routing, and a security toolchain, so a pure dogfood demo is thin. The hybrid sample-seeding
  (FR-3) deliberately shows **illustrative, not real-to-QMetriX** data for coverage/security — this is an
  honesty trade-off that must be surfaced in the demo UI, not hidden.

---
**Stage report:** 8 functional + 7 non-functional requirements · 10 acceptance criteria · 2 conflicts
flagged (overlap with #2; illustrative-data honesty) · 6 open questions (all non-blocking, with
assumptions). Next: `/task-design 1-demo-site`.
