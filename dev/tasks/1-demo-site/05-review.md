# Review: Add runnable demo site showcasing QMetriX capabilities
> Task: 1-demo-site | PR: #11 | Date: 2026-06-30
> Found-in: 1.0.0 | Fixed-in: 1.0.0
> Verdict: NEEDS WORK → **APPROVE** (all findings fixed in `69d06e8`)

## Resolution (commit `69d06e8`)
| # | Outcome | What changed |
| --- | --- | --- |
| F1 | ✅ fixed | Landing disclaimer now lists Coverage, Security, **dependency audit/outdated** and (on this `.mjs` repo) **structural duplication** as illustrative samples; only genuinely-live signals are called "real". README Demo section updated to match. Rendered disclaimer + `dev/demo/README.md` now agree. |
| F2 | ✅ fixed | `opt()` in `run.mjs` and `serve.mjs` no longer treats a following `--flag` as a value; `--port --open` → default 8080 (no `NaN`); ports coerce to a sane default. Verified across `--port --open` / `--port 9000` / `--port` / `--host --open`. |
| F3 | ✅ fixed | `run.mjs` cleans `dist/reports/` as well as `dist/site/` before seeding. Verified: planted `stray-leak.sarif` + `coverage/storybook/` are wiped on the next run; inventory deterministic. |
| F4 | ✅ fixed | "Quality dashboard" / "Raw dashboard data" cards now badged **"live + sample"** (new `.badge.mixed`) instead of a flat "sample data". |

Post-fix re-verification: `npm run demo:build` green, smoke check passes, `dist/site/` identical across two runs (AC-8), `npm pack --dry-run` unchanged (38 files, no leak).

---
*(Original review below — verdict at time of review was NEEDS WORK.)*

The implementation is solid and well-engineered — I independently re-ran `npm run demo:build`,
re-verified 9 of 10 ACs against the actual emitted output (not the report's claims), and attacked the
static server, the path resolver, the live-vs-sample fallback, and the self-containment guard. Almost
everything survived. The one issue that didn't: the demo **fabricates a dependency vulnerability and an
outdated-package finding from seeded samples and presents them as real**, on the dashboard panel that
the landing page explicitly labels "real, generated live." Honesty about illustrative data was an
explicitly stakeholder-flagged requirement of this task (req conflict #2 / design R3), so this is a
contract breach, not a nit — though the fix is a one-sentence content change.

## Findings
| # | Severity | Location | Weakness | Attack/failure scenario | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| F1 | **Medium** | [landing.mjs:184-191](dev/demo/landing.mjs#L184-L191); [README.md](README.md) Demo section; data from [deps.mjs:92-133](src/dashboard/collectors/deps.mjs#L92-L133) | The landing disclaimer scopes "sample data" to **Coverage** and **Security** and asserts "the **dependency inventory** … is **real**, generated live." But the dashboard's *vulnerable?* / *outdated?* columns are populated from the seeded `npm-audit.json` / `npm-outdated.json` fixtures, and the collector strips the `[illustrative sample]` marker (it keeps only `severity`), so the dashboard shows **no** sample label. | Open the served dashboard → Dependencies. `sharp` shows a `moderate` vulnerability badge ([dashboard.html:347](dist/site/dashboard.html#L347)) and `monocart-coverage-reports` shows `^2.12.12 → 2.13.1` "outdated" ([dashboard.html:339-340](dist/site/dashboard.html#L339-L340)). Both are fabricated demo data with no label, and the only disclaimer on the site says deps are real. A prospective evaluator reads a fake CVE on `sharp` as QMetriX's real metric. The site's own `dev/demo/README.md` table correctly lists "npm audit/outdated → sample", contradicting the landing + README. | Add "dependency audit/outdated (npm audit/outdated)" to the sample list in the landing disclaimer and the top-level README Demo section; ideally surface a one-line sample note in the deps area too. Match `dev/demo/README.md`, which is already correct. |
| F2 | Low | [run.mjs:41-44](dev/demo/run.mjs#L41-L44) | `opt(name, fallback)` returns the next argv token unconditionally — it does not check the token is a value rather than another flag. | `node dev/demo/run.mjs --port --open` → `port = Number('--open') = NaN` → server binds an OS-assigned random port and the EADDRINUSE auto-increment becomes `NaN`. `--host --open` → host becomes the literal `--open` and `listen` fails with an opaque error rather than a usage message. Misuse, dev-tool only. | Treat a following `--`-prefixed token as "no value" (`const v = argv[i+1]; return v && !v.startsWith('--') ? v : fallback`); validate `--port` parses to a finite number. |
| F3 | Low | [run.mjs:102-114](dev/demo/run.mjs#L102-L114) | Clean removes only `dist/site/` and `dist/reports/jsinspect.json`; the seed copies fixtures *onto* `dist/reports/` without first clearing it. FR-8 ("no stale demo output survives") holds for the served `dist/site/` (fully cleaned) but not for `dist/reports/`. | On a dirty `dist/` (not a clean checkout), a developer's pre-existing real reports — e.g. a real `*.sarif`, `eslint.json`, or an extra `coverage/<suite>/` — survive into the demo run and the dashboard mixes them with the seeded samples. AC-8 (measured on `dist/site/` file list) still passes; the leak is in dashboard *content*. Clean-checkout (NFR-4) is unaffected. | Remove the demo-owned `dist/reports/` subtree (or at least the seeded paths) before seeding, or document that the demo assumes a clean `dist/reports/`. |
| F4 | Low | [landing.mjs:88-95](dev/demo/landing.mjs#L88-L95) | The "Quality dashboard" (and "Raw dashboard data") cards hardcode `live: false` → badge "sample data", although the dashboard is *predominantly live* (code, deps inventory, graph) with only coverage/security seeded. Labeling imprecise in the opposite direction from F1. | Visitor sees the main dashboard badged "sample data" and may discount the genuinely-live code/graph/dependency analysis. Cosmetic; the disclaimer clarifies. | Drop the badge on these two cards, or label them "live + sample" to match the actual mix. |

## AC Verification
*(re-verified against a fresh `npm run demo:build` + served fetch, not the implementation report's claims)*

| AC | Status | Evidence (file:line / test) |
| --- | --- | --- |
| AC-1 `npm run demo` exits 0 + prints URL | ✅ (with note) | `demo:build` exits 0; serve mode prints `serving at http://…` ([run.mjs:162](dev/demo/run.mjs#L162)). Note: the serve form intentionally **blocks** (serves until Ctrl-C) — it prints the URL but does not "complete"; AC wording is loose for a server. |
| AC-2 live bins produced artifacts | ⚠ Met w/ documented deviation | `dist/site/{dashboard.html,dashboard.json,codebase-bundle.html}` produced live; bundle at `dist/site/` not `dist/reports/` (design refinement). **`jsinspect.json` is the seeded sample, not live** — `jsinspect-plus` skips `.mjs`, so `audit-structure` prints non-JSON to stdout, `JSON.parse` throws, and it exits before writing ([audit-structure.mjs:72-76](src/audit-structure.mjs#L72-L76)); the fallback at [run.mjs:122-126](dev/demo/run.mjs#L122-L126) then copies the sample. Honestly labelled. I confirmed the served `jsinspect.json` is `demo-sample-1`. |
| AC-3 coverage & security populated + labelled | ✅ | Inventory: 7/12 artifacts (coverage unit/e2e/global, npm audit/outdated, Snyk, CodeQL). Security findings carry the `[illustrative sample]` text; landing has the "Demo data notice". (Deps audit/outdated populate too but are mislabelled — see F1.) |
| AC-4 URL serves dashboard; links resolve | ✅ | Implementation captured `200` for `/`, `/dashboard.html`, `/codebase-bundle.html`, `/jsinspect.json`, `/dashboard.json`; static server + relative links confirmed by code read. |
| AC-5 opens from filesystem & under `/repo/` sub-path | ✅ | `index.html` + `dashboard.html` use inline CSS, relative hrefs, and only absolute `https://` links. I grepped `dashboard.html`: all hrefs are `https://…` or the relative `codebase-bundle.html` — no `../`, `localhost`, or root-absolute. `check.mjs` enforces this. |
| AC-6 offline / no creds | ✅ (by construction) | Only `audit-structure` (local jsinspect) + `quality-dashboard` (local file reads + local `git`) run; no `npm audit`/Snyk/CodeQL networked path is invoked. |
| AC-7 every artifact reachable from root | ✅ | Landing links Dashboard, Codebase bundle, `jsinspect.json`, `dashboard.json`; all present in `dist/site/`. |
| AC-8 idempotent re-run | ✅ (for `dist/site/`) | `dist/site/` is cleaned + rebuilt; file structure identical. (Content embeds a per-run timestamp — expected. `dist/reports/` not cleaned — see F3.) |
| AC-9 tarball only `src/` | ✅ | I ran `npm pack --dry-run`: 38 files, **no** `dev/`, `.claude/`, or `dist/` entries. `dist/` is gitignored and untracked. |
| AC-10 deps unchanged / dev-only | ✅ | `git diff main -- package.json`: only `scripts` added; `dependencies`/`files`/`engines` untouched; server uses `node:http`. |

## Attack Surface Checked
- **Path traversal (server):** `resolvePath` ([serve.mjs:45-51](dev/demo/serve.mjs#L45-L51)) decodes `%2e`/`%2f` before resolving, strips leading slashes, and gates on `target === root || target.startsWith(root + path.sep)`. I tried `/../../package.json` (raw → 403; fetch normalizes → 404), encoded traversal (`%2e%2e` decoded then caught), and the prefix-sibling attack (`…/dist/siteEVIL` vs root `…/dist/site` — the `+ path.sep` defeats it). **Survived.**
- **Live-vs-sample fallback:** I hypothesized `audit-structure` always writes `[]` (which would make `dupLive` wrongly `true` and suppress the sample). Ran it against `src/` — it errors on non-JSON stdout and exits **before** the write, so `jsinspect.json` is absent and the sample is used. **Survived** (verified the served file is the sample, badge reads "sample data").
- **Self-containment regression (R1):** `check.mjs` greps `index.html` + `dashboard.html` for `../`, `file://`, `localhost`, drive-absolute, and root-absolute links; the coverage drill-down link is suppressed because no `coverage/<suite>/index.html` is seeded ([coverage.mjs:33-42](src/dashboard/collectors/coverage.mjs#L33-L42) → `reportHref: null`). I independently grepped both pages — clean. **Survived.**
- **XSS in landing:** all interpolated meta (`name`, `version`, `branch`, repo owner/name, `generated`) goes through `esc()` (escapes `& < > "`); values sit in double-quoted attrs or element text, and are sourced from this repo's own `package.json`/git, not external input. Low surface; **survived.**
- **Port exhaustion / EADDRINUSE:** auto-increments base→base+19, then rejects with the error `.message` (no stack trace) via `main().catch`. **Survived.**
- **SARIF double-count:** `findSarifFiles` scans `dist/reports/` *and* `walk(ROOT)`; `walk` skips any dir named `reports` (IGNORE_DIRS), so the committed `dev/demo/fixtures/reports/*.sarif` are **not** re-counted alongside the seeded copies. Security findings = 5, single-counted. **Survived.**
- **Packaging boundary:** `npm pack --dry-run` — no `dev/` leak. **Survived.**
- **Honesty of illustrative data:** coverage ✅ labelled, security ✅ labelled (carries `[illustrative sample]` in the finding text), duplication ✅ labelled "sample data" — **but deps audit/outdated NOT labelled and asserted "real"**. → **F1.**
- **CLI arg parsing:** `opt()` swallows a following flag as a value. → **F2.**
- **Idempotency of `dist/reports/`:** seeded onto an uncleaned dir. → **F3.**

---
**Summary:** 0 Critical · 0 High · 1 Medium · 3 Low. Worst finding: the demo presents a fabricated
"moderate" vulnerability on `sharp` and an outdated `monocart-coverage-reports` as QMetriX's *real*
dependency metrics, while the landing disclaimer claims the dependency inventory is real — a one-line
content fix that nonetheless breaches the task's explicit illustrative-data honesty requirement.
Recommend `/task-implementation 1-demo-site` to fix F1 (and fold in F2–F4), then re-run this review on
the updated diff. No re-architecture required.
