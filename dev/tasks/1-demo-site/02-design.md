# Design: Add runnable demo site showcasing QMetriX capabilities
> Task: 1-demo-site | Issue: #1 | Date: 2026-06-30 | Status: draft

## Summary
Add a `dev/demo/` orchestrator, invoked by a new `npm run demo`, that **dogfoods QMetriX against this
repo** and assembles a **self-contained, GitHub-Pages-ready `dist/site/`**. The runner (1) seeds
committed *illustrative sample reports* into `dist/reports/` so the dashboard's coverage/security/deps
sections render populated, (2) live-runs the offline bins — `qmetrix-audit-structure` (→
`dist/reports/jsinspect.json`) and `qmetrix-quality-dashboard` (which also emits the codebase bundle) —
(3) writes a small **landing `index.html`** that introduces QMetriX, carries the sample-data
disclaimer, and links every artifact, and (4) serves `dist/site/` over a `node:http` static server.
The served directory has **no file links escaping `dist/site/`** (we deliberately skip the coverage
HTML drill-down and Storybook), so the same directory uploads to Pages unchanged. Everything new lives
under `dev/` (unpublished); no runtime dependency is added.

## Alternatives Considered

### A. Served root & Pages-readiness *(the central decision)*
| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| **Serve `dist/site/`, self-contained (no coverage drill-down, no Storybook)** | Single uploadable dir; **zero escaping links**; trivially Pages-ready; minimal moving parts | Loses the Istanbul per-file HTML drill-down (coverage still shown as summary + per-file % table inline) | **✅ Chosen** |
| Serve `dist/` (parent), dashboard at `site/`, reports at `reports/` | Keeps coverage drill-down (`../reports/…` resolves) | Deploy root exposes *all* of `dist/`; harder to keep clean (FR-8); Pages upload includes stray files | Rejected — cleanliness |
| Assemble dedicated `dist/demo/` by **copying** `dist/site` + `dist/reports` as siblings | Self-contained **and** keeps drill-down | Extra copy step; must mirror the exact `../reports` relative layout the dashboard bakes in (fragile) | Rejected — complexity for a demo |

> Why the link analysis matters: the dashboard only emits an external *file* link for coverage when
> `dist/reports/coverage/<suite>/index.html` exists ([template.mjs:48,56](../../../src/dashboard/render/template.mjs)),
> for Storybook when built next to the dashboard ([template.mjs:248](../../../src/dashboard/render/template.mjs)),
> and for the codebase bundle as a `dist/site/` sibling ([template.mjs:259](../../../src/dashboard/render/template.mjs)).
> Skipping the first two makes `dist/site/` self-contained. All other links (`github.com`, Snyk/CodeQL
> dashboards) are absolute `https://` web links — fine for an offline-*built* static site.

### B. Static server
| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| **Node stdlib `node:http`** | Zero new dep (NFR-2); cross-platform | ~50 lines of MIME/index handling to write | **✅ Chosen** |
| Add `sirv` / `http-server` devDependency | Less code | New dependency, against §6 / NFR-2 | Rejected |
| `python -m http.server` | No JS code | Non-Node tool, not guaranteed present; breaks "one command" | Rejected |

### C. Codebase bundle source
| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| **Use the dashboard's internal `bundleCodebase()` → `dist/site/codebase-bundle.html`** | One pass; bundle lands in the served dir already | Bundle is in `dist/site`, not `dist/reports` (refines AC-2 wording) | **✅ Chosen** |
| Also run `qmetrix-bundle-codebase` → `dist/reports/codebase-bundle.html` | Matches AC-2 literally | Bundles the whole tree **twice** (wasteful, slow) | Rejected — redundant |

### D. Landing page
| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| **Separate landing `index.html` + dashboard at `dashboard.html`** | Home for the disclaimer + `jsinspect.json` (no dashboard duplication section); better showcase entry | One small template to maintain | **✅ Chosen** |
| Dashboard *is* `index.html`, no landing | Nothing to build | No place to surface the duplication report or the sample-data disclaimer (FR-7 + honesty) | Rejected |

*(Demo source = dogfood, execution = hybrid, delivery = local + Pages-ready were decided in
`01-requirements.md`; not re-litigated here.)*

## Affected Files
| Path | Action | Change |
| --- | --- | --- |
| `dev/demo/run.mjs` | create | Orchestrator: clean → seed samples → run `audit-structure` + `quality-dashboard` → assemble landing → serve. CLI: `[--no-serve] [--port <n>] [--open]`. Anchors `process.cwd()`; spawns bins via `process.execPath` (no shell). |
| `dev/demo/serve.mjs` | create | Minimal `node:http` static file server rooted at a dir; MIME map (html/json/js/css/svg/png/ico); directory → `index.html`; base port with auto-increment on `EADDRINUSE`; prints URL. |
| `dev/demo/landing.mjs` | create | Builds the landing `index.html` string: intro, **illustrative-sample-data disclaimer**, links to Dashboard / Codebase bundle / Duplication report / raw JSON, and a tiny stats strip read from `dashboard.json` + `jsinspect.json`. |
| `dev/demo/fixtures/reports/coverage/unit/coverage-summary.json` | create | Sample Istanbul summary (`total` + per-file `lines.pct`) — unit suite. |
| `dev/demo/fixtures/reports/coverage/e2e/coverage-summary.json` | create | Sample Istanbul summary — e2e suite (for the per-suite breakdown). |
| `dev/demo/fixtures/reports/coverage/global/coverage-summary.json` | create | Sample Istanbul summary — global (drives the headline chip/bars; `collectCoverage` prefers `global`). |
| `dev/demo/fixtures/reports/snyk-deps.sarif` | create | Sample SARIF 2.1.0, `tool.driver.name="Snyk"`, a few `results[]` with `ruleId`/`level`/`message`/`locations` → populates the Snyk security card. |
| `dev/demo/fixtures/reports/qmetrix-codeql.sarif` | create | Sample SARIF 2.1.0 with `security-severity` rule properties → populates the CodeQL card (filename matches `matchByName('codeql')`). |
| `dev/demo/fixtures/reports/npm-audit.json` | create | Small illustrative `npm audit --json` shape referencing a real dep → deps "vulnerable?" column populates. |
| `dev/demo/fixtures/reports/npm-outdated.json` | create | Small illustrative `npm outdated --json` shape → deps "outdated?" column populates. |
| `dev/demo/README.md` | create | What the demo is, the sample-data disclaimer, `npm run demo` / `--no-serve`, and how to publish `dist/site/` to GitHub Pages. |
| `dev/demo/check.mjs` | create *(optional, recommended)* | Post-build smoke check: asserts `dist/site/{index,dashboard,codebase-bundle}.html` + `jsinspect.json` exist and that no `href="../"`/`localhost`/absolute-path file link appears in the emitted HTML. Supports AC verification & future CI. |
| `package.json` | modify | Add `"scripts": { "demo": "node dev/demo/run.mjs", "demo:build": "node dev/demo/run.mjs --no-serve" }`. `files`, `dependencies`, `engines` **unchanged**. |
| `CLAUDE.md` | modify | §3 layout table: add the `dev/demo/` row (not shipped). §8: add `npm run demo` to everyday commands. |
| `README.md` | modify | Add a short **Demo** section: `npm run demo`, what it showcases, sample-data caveat. |

No files deleted. No `.gitignore` change — `/dist/` is already ignored; `dev/demo/fixtures/` is committed source.

## Data & Interface Changes

**Served layout (the Pages deploy contract):**
```
dist/site/
  index.html            landing page (NEW — dev/demo/landing.mjs)
  dashboard.html         quality dashboard  (qmetrix-quality-dashboard --out dist/site/dashboard.html)
  dashboard.json         raw dashboard data (auto: OUT.replace .html→.json)
  codebase-bundle.html   self-contained code browser (dashboard's internal bundleCodebase)
  jsinspect.json         structural-duplication report (copied from dist/reports/jsinspect.json)
```
All intra-site links are relative & root-relative-free → safe under a Pages project sub-path
(`/<repo>/`). `dashboard.json`/`jsinspect.json` served as `application/json`.

**Sample-seed contract** — `dev/demo/fixtures/reports/` mirrors the `dist/reports/` subtree the
collectors read ([coverage.mjs:25](../../../src/dashboard/collectors/coverage.mjs),
[security.mjs:8](../../../src/dashboard/collectors/security.mjs)) and is copied verbatim into
`dist/reports/` before the dashboard runs. **No `coverage/<suite>/index.html` is seeded** (keeps the
served dir self-contained).

**Runner CLI / npm contract:**
- `npm run demo` → build + serve (`http://localhost:8080`, auto-increment if busy; `--port`, `--open`).
- `npm run demo:build` → build only (`--no-serve`) — the form CI/Pages would call later.

**Bin invocation (cwd contract preserved):** `spawnSync(process.execPath, ['src/audit-structure.mjs','src'], {cwd: ROOT})` and `spawnSync(process.execPath, ['src/quality-dashboard.mjs','--out','dist/site/dashboard.html'], {cwd: ROOT})` — `ROOT = process.cwd()`, no `import.meta.url` for consumer paths, no shell string.

## Implementation Sequence
*(no build step — repo stays runnable after every step)*
1. **Sample fixtures** — add `dev/demo/fixtures/reports/**` (pure data; no behavior).
2. **Helpers** — add `dev/demo/serve.mjs` and `dev/demo/landing.mjs` (standalone, side-effect-free, unit-runnable).
3. **Orchestrator** — add `dev/demo/run.mjs` wiring clean → seed → bins → landing → serve; runnable via `node dev/demo/run.mjs`. Demo is functional here.
4. **npm wiring** — add `scripts.demo` / `demo:build` to `package.json`.
5. **Docs** — `dev/demo/README.md`, `CLAUDE.md` rows, `README.md` Demo section.
6. **(Optional) Smoke check** — `dev/demo/check.mjs`; can be called at the end of `demo:build`.

## Test Strategy
This repo has **no test framework wired** (CLAUDE.md §8) and the no-build/tiny-dep ethos argues against
adding one for a demo. Verification is script-driven + manual, mapped to ACs:
- **Smoke (`dev/demo/check.mjs`, optional):** after `npm run demo:build`, assert the 5 served files
  exist and grep the emitted HTML for forbidden `href="../"` / `localhost` / drive-absolute file links
  (covers AC-2, AC-5, AC-7).
- **Manual run:** `npm run demo` → open printed URL; confirm coverage & security sections are populated
  and the disclaimer shows (AC-3, AC-4); follow links to bundle + duplication report (AC-7).
- **Offline:** run with networking disabled / no Snyk creds → completes green (AC-6).
- **Idempotency:** run twice over a dirty `dist/` → identical structure, no stale files (AC-8).
- **Packaging:** `npm pack --dry-run` → only `src/` (AC-9); `git diff package.json` shows `dependencies`
  unchanged (AC-10).

## Risks & Mitigations
| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | A future seed of `coverage/<suite>/index.html` reintroduces an escaping `../reports/…` link | Documented in `dev/demo/README.md`; `check.mjs` greps for `href="../"` and fails the build |
| R2 | Drift / overlap with #2 (dogfood-self-metrics) | Demo is self-sufficient (runs bins + seeds samples); boundary documented (#2 = real metric *production*, #1 = *assembly + serving*); demo *may* later consume `npm run metrics` but is not coupled |
| R3 | Illustrative sample data mistaken for QMetriX's real metrics | Prominent disclaimer on landing + dashboard area note + `dev/demo/README.md`; samples isolated under `fixtures/` |
| R4 | Default port already in use | `serve.mjs` auto-increments from base port; clear message, never a stack trace |
| R5 | Windows path / native-module pitfalls | `node:path` throughout; spawn `process.execPath` (no shell); demo runs **no** `sharp`-backed bin (no ABI exposure) |
| R6 | New files leak into the npm tarball | All under `dev/`; `files:["src"]` unchanged; verified by `npm pack --dry-run` (AC-9) |
| R7 | External security/repo links resolve to whatever `git remote` is on a fork/clone | Acceptable (links are informational); not blocking; noted |
| R8 | `npm audit/outdated` would need network if run live | Not run live — seeded samples only (preserves FR-6 offline) |

## AC Coverage
| AC | Satisfied by |
| --- | --- |
| AC-1 `npm run demo` exits 0 + prints URL | `package.json` `scripts.demo` → `run.mjs`; `serve.mjs` prints URL |
| AC-2 live bins produced artifacts | `run.mjs` steps: `audit-structure`→`dist/reports/jsinspect.json`; dashboard→`dist/site/dashboard.{html,json}` + `codebase-bundle.html`. **Refinement:** bundle served at `dist/site/codebase-bundle.html` (not `dist/reports/`) — update AC-2 wording in planning |
| AC-3 coverage & security populated, marked illustrative | Seed step + sample fixtures → collectors embed inline; landing/dashboard disclaimer |
| AC-4 URL serves dashboard; links resolve | `serve.mjs` static server; relative intra-site links |
| AC-5 opens from filesystem & under `/repo/` sub-path | Self-contained `dist/site/` (no escaping links — Alt A); `check.mjs` greps |
| AC-6 offline / no creds completes | Only offline bins run; samples seeded; no `npm audit`/Snyk/CodeQL network (R8) |
| AC-7 every artifact reachable from root | Landing `index.html` links dashboard, bundle, `jsinspect.json`, raw JSON |
| AC-8 idempotent re-run | `run.mjs` clean step (remove `dist/site` + seeded sample paths) before rebuild |
| AC-9 tarball only `src/` | Everything under `dev/`; `files` unchanged |
| AC-10 deps unchanged / dev-only | `serve.mjs` uses `node:http`; no dependency added |
| NFR-3 cwd contract | `cwd: ROOT=process.cwd()`; consumer paths never via `import.meta.url` |
| NFR-5 Node 22 only | Stdlib only (`node:http/fs/path/child_process`); no transpile |
| NFR-6 cross-platform | `node:path`, `process.execPath`, no Unix-only shell |
| NFR-7 soft-fail missing inputs | Inherits collectors' degrade-not-crash; runner tolerates a missing sample (section shows "not configured") |

## Open items for planning
- Update **AC-2** wording: served bundle is `dist/site/codebase-bundle.html` (design rejects a redundant
  second bundle into `dist/reports/`).
- Confirm the **#1 ↔ #2 boundary** (Open Question 4 / R2) before/at planning — does not block this design.
- `dev/demo/check.mjs` is optional; planning to decide if it's in-scope for v1 or a follow-up.

---
**Stage report:** 13 files (11 create incl. 1 optional · 3 modify · 0 delete) · 4 decisions each with a
rejected alternative · all 10 ACs + 5 NFRs mapped · 8 risks mitigated. Next: `/task-planning 1-demo-site`.
