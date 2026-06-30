# Review: Add runnable demo site showcasing QMetriX capabilities
> Task: 1-demo-site | PR: #11 | Date: 2026-06-30
> Found-in: 1.0.0 | Fixed-in: 1.0.0
> Verdict: **APPROVE** (Round 2 — post-fix re-review of `69d06e8`; 1 new Low, non-blocking)

This is the second adversarial pass, run against the updated branch (through `2c63bd6`). Round 1's
one Medium (F1) and three Lows (F2–F4) are all fixed and independently re-verified (`npm run demo:build`
green, `dist/site/` idempotent across two runs, planted stray reports wiped, disclaimer now honest,
`npm pack` unchanged). Re-attacking the changed code surfaced **one new Low** in the standalone
`serve.mjs` CLI (a positional/option arg collision that does not affect `npm run demo`). No Critical,
High, or Medium findings remain.

## Findings
| # | Severity | Location | Weakness | Attack/failure scenario | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| NF1 | Low | [serve.mjs:125](dev/demo/serve.mjs#L125) | The standalone CLI derives the served dir as `argv.find(a => !a.startsWith('--'))` — the first non-flag token. When the positional dir is omitted but an option is passed, the **option's value** is taken as the directory. | `node dev/demo/serve.mjs --port 9000` → `dir = '9000'` (the port value), so it serves a nonexistent `./9000` and every request 404s. `node dev/demo/serve.mjs --host 127.0.0.1` → `dir = '127.0.0.1'`. Verified by reproducing the parse: `--port 9000` → `{dir:'9000', port:9000}`. The documented form `node dev/demo/serve.mjs dist/site --port 9000` works (dir first). **`npm run demo` is unaffected** — `run.mjs` calls `startServer()` directly, never this CLI. Pre-existing (since `570693a`); not introduced by the fixes. | Parse options first, then take the first *remaining* positional as dir (e.g. skip any token immediately preceded by `--port`/`--host`); or default the dir and require it before flags. |

## Resolution of Round 1 findings (fixed in `69d06e8`)
| # | Sev | Outcome | Evidence |
| --- | --- | --- | --- |
| F1 | Medium | ✅ fixed | Disclaimer now lists Coverage, Security, **dependency audit / outdated** and (on this `.mjs` repo) **structural duplication** as illustrative samples; only live signals called "real" ([landing.mjs:87-100](dev/demo/landing.mjs#L87-L100)). Rendered output confirmed; README + `dev/demo/README.md` now agree. |
| F2 | Low | ✅ fixed | `opt()` rejects a following `--flag` as a value and ports coerce to 8080 ([run.mjs:41-46](dev/demo/run.mjs#L41-L46), [serve.mjs:121-127](dev/demo/serve.mjs#L121-L127)). Verified: `--port --open`→8080, `--port 9000`→9000, `--host --open`→host unchanged. |
| F3 | Low | ✅ fixed | `dist/reports/` cleaned before seeding ([run.mjs:109-111](dev/demo/run.mjs#L109-L111)). Verified: planted `stray-leak.sarif` + `coverage/storybook/` are gone after the next run; only seeded suites remain. |
| F4 | Low | ✅ fixed | Dashboard / Raw-data cards badged **"live + sample"** via new `.badge.mixed` ([landing.mjs](dev/demo/landing.mjs)) instead of a flat "sample data". |

## AC Verification
*(re-checked against the post-fix `dist/site/` output, not the report's claims)*

| AC | Status | Evidence |
| --- | --- | --- |
| AC-1 `npm run demo` exits 0 + prints URL | ✅ | `demo:build` exits 0; serve form prints `serving at http://…` ([run.mjs:163](dev/demo/run.mjs#L163)). |
| AC-2 live bins produced artifacts | ⚠ Met (documented) | `dashboard.{html,json}` + `codebase-bundle.html` live; `jsinspect.json` is the seeded sample (jsinspect skips `.mjs`) — labelled "sample data". |
| AC-3 coverage & security populated + labelled | ✅ | 7/12 inventory; security findings carry `[illustrative sample]`; disclaimer now also covers deps audit/outdated and duplication. |
| AC-4 URL serves dashboard; links resolve | ✅ | Static server + relative links; serve matrix returned 200 for all five artifacts. |
| AC-5 filesystem & `/repo/` sub-path safe | ✅ | `check.mjs` passes; I re-grepped `index.html` + `dashboard.html` — only relative + absolute `https://` links, no `../`/`localhost`/root-absolute. |
| AC-6 offline / no creds | ✅ | Only `audit-structure` + `quality-dashboard` run; no networked path invoked. |
| AC-7 every artifact reachable from root | ✅ | Landing links all four artifacts; all present. |
| AC-8 idempotent re-run | ✅ (stronger now) | `dist/site/` file-list identical across two runs; **and** `dist/reports/` is now cleaned, so the dashboard content is deterministic too (F3). |
| AC-9 tarball only `src/` | ✅ | `npm pack --dry-run`: 38 files, no `dev/`/`.claude/`/`dist/`. |
| AC-10 deps unchanged / dev-only | ✅ | `package.json` `dependencies`/`files`/`engines` untouched; server is `node:http`. |

## Attack Surface Checked
- **XSS via new disclaimer/badge strings:** `sampleSignals`/`realSignals` and the `'mixed'` badge are trusted static strings injected without `esc()`; they contain only `/ ( ) +` — no `< > & "`. No href/src added, so `check.mjs` still passes. **Survived.**
- **Disclaimer correctness, both providers:** re-derived for `dupLive=true` (.js/.ts consumer) and `false` (this repo). The `(dupLive ? realSignals : sampleSignals).push(...)` branch lands "structural duplication" on the correct side; grammar (`panels are`) holds for 3–4 items. **Survived.**
- **`dist/reports/` clean (F3) — collateral wipe:** confirmed the clean removes only `dist/reports/` and the demo re-seeds it; `codebase-bundle.html` lives in `dist/site/` (untouched) and `jsinspect.json` is regenerated/sampled afterwards. `rmSync(force:true)` on a missing dir (clean checkout) is a no-op. **Survived.**
- **Arg parsing (F2):** `opt()` value/flag separation verified across four arg shapes; port `NaN` guarded to 8080. **Survived** for `run.mjs`; **CLI dir collision found → NF1** (separate `dir` detection, not `opt`).
- **Path traversal (server):** unchanged from Round 1 — `resolvePath` `+ path.sep` boundary still defeats `..` and prefix-sibling attacks. **Survived.**
- **SARIF double-count / packaging boundary / self-containment:** unchanged and re-confirmed (single-count via `walk` skipping `reports`; 38-file tarball; smoke check green). **Survived.**
- **Idempotency under a dirty tree:** planted stray reports + extra coverage suite → wiped on next run. **Survived.**

---
**Summary:** 0 Critical · 0 High · 0 Medium · 1 Low (new) · Round 1's 1 Medium + 3 Low all fixed.
Worst remaining: `node dev/demo/serve.mjs --port 9000` serves the wrong directory because the port
value is mistaken for the positional dir — a one-line parse fix in a convenience CLI that does not
affect `npm run demo`. **Verdict: APPROVE.** NF1 is optional hardening; safe to merge as-is or fold the
one-liner in first.
