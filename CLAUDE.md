# CLAUDE.md — working rules for `@mifort-solutions/qmetrix`

The law of this repo. These rules are **prescriptive**: follow them for all new code. QMetriX is
**dev tooling, not an application and not a library** — a set of plain-ESM Node scripts published to
npm and invoked as `qmetrix-*` bin executables from a **consuming** repository.

> Stack is intentionally minimal — Node 22 (ESM, `type: module`) · zero framework · three runtime
> deps (`jsinspect-plus`, `monocart-coverage-reports`, `sharp`). No build step, no transpile: the
> `.mjs` sources in `src/` are what ships. Deeper context: [README.md](README.md).

---

## 1. What this package is (the core contract)

QMetriX computes quality signals over a **consuming repo**: coverage merge & reporting, a quality
dashboard, an image-budget check / optimizer, a structural-duplication audit, a security scan, an
e2e-server guard, and a single-file codebase bundler. It is installed as a `devDependency` and its
verbs run from the host project's `package.json` scripts.

- **It is consumed through `bin` executables only — there is no programmatic library API.** The
  public surface is the set of `qmetrix-*` bins declared in [package.json](package.json). Do not add
  `exports`/`main` or invite `import '@mifort-solutions/qmetrix'`; new capability ships as a new bin.
- **Output lands under the consumer's `dist/reports/`** (coverage, jsinspect.json, SARIF, the
  dashboard HTML, the codebase bundle). Reads come from the consumer's `src/`, `content/`, `public/`,
  `package.json`, `node_modules`, and git history.

## 2. The cwd contract (the invariant that must never break)

**Every bin anchors the project root on `process.cwd()`** — the directory the verb is run from —
never on `import.meta.url` / `__dirname`. `npm run …` runs from the consumer's repo root, which is
the contract: a bin invoked from a subdirectory must be a usage error, not a silently-wrong run.

- When you add or edit a script, resolve consumer paths against `process.cwd()`. Use
  `import.meta.url` **only** to load assets shipped *inside this package* (templates, fixtures).
- Never hardcode `ai.mifort.com` (or any single consumer's) paths, layout, or assumptions. A path
  that exists in one host but not another is configuration, not a constant — surface it, default it.

## 3. Module layout — where things go

```
src/
  *.mjs                 one file per bin entry point (audit-structure, bundle-codebase,
                        check-images, optimize-images, quality-dashboard, security-scan,
                        e2e-server-guard, optimize-images, test-outline)
  coverage/             coverage pipeline: clean, report-suite, report-global,
                        next-start-cov, merge-istanbul, src-filter
  dashboard/
    collectors/         one collector per signal (code, coverage, deps, lint, security,
                        routing, storybook, composition*, entities, graph)
    render/             HTML/CSS/client emission (template, components, styles, client, composition)
    utils/              exec / fs / format helpers
    config.mjs          dashboard configuration
```

| Adding…                                   | Put it in…                                                     |
| ----------------------------------------- | -------------------------------------------------------------- |
| A new verb / capability                   | `src/<name>.mjs` + a `qmetrix-<name>` entry in `package.json` `bin` |
| A coverage-pipeline step                  | `src/coverage/`                                                |
| A new dashboard signal                    | `src/dashboard/collectors/<signal>.mjs`                        |
| Dashboard HTML/CSS/JS output              | `src/dashboard/render/`                                        |
| A shared exec/fs/format helper            | `src/dashboard/utils/` (or a small co-located helper)          |
| Docs / process / task artifacts           | `dev/` — **not shipped** (excluded by the `files` allowlist)   |

- **Only `src/` is published** (`"files": ["src"]` in `package.json`). Anything under `dev/`,
  `.claude/`, tests, or the repo root is repo-local and must not be required at runtime by a bin.
- Keep each bin's entry file thin: parse args, resolve cwd paths, delegate to a module. Push logic
  into `coverage/`, `dashboard/`, or a co-located helper — a bin file should read top-to-bottom.

## 4. ESM & Node conventions

- **Pure ESM.** `type: module`; use `import`/`export`, `import.meta.url`, top-level `await` where it
  reads cleanly. No CommonJS (`require`, `module.exports`), no `.cjs` unless a dep forces it.
- **No transpile / no build.** The `.mjs` you write is the `.mjs` that ships. Target the Node 22
  feature set directly; don't introduce a bundler or a `dist/` build for this package.
- Prefer the Node standard library (`node:fs`, `node:path`, `node:child_process`, …) over adding a
  dependency. A new runtime dep is a deliberate, justified decision (see §6).

## 5. Reading & writing the consumer's tree

- **Reads are best-effort and defensive.** A consumer may not have Storybook, a security toolchain,
  or every report present. Missing inputs degrade to a clear skip/empty result, never a crash — match
  the existing collectors' soft-fail behaviour.
- **Writes stay inside `dist/reports/`** of the consumer (create it if absent). Don't scatter output
  at the consumer's repo root.
- Some bins shell out to **system tools that are not npm deps**: `qmetrix-security-scan` uses
  `curl` / `tar` / the CodeQL CLI; `qmetrix-quality-dashboard` expects a built Storybook under the
  consumer's `dist/site/storybook` for a full dashboard. Guard for their absence and report it.

## 6. Dependencies & holdbacks (do not bump blindly)

- **Runtime is Node `22.x`** — a **closed** `engines.node` range (`"22.x"`), matching the host apps.
  Keep it closed: an open `>=` range resolves *up* to the newest major in CI and silently jumps the
  runtime. Node 20 reached EOL 2026-04-30.
- **Keep the dependency set tiny.** Three runtime deps today (`jsinspect-plus`,
  `monocart-coverage-reports`, `sharp`). Adding a fourth needs a real reason — prefer the stdlib or a
  small inlined helper. `sharp` is a native module; be mindful of its platform/Node ABI constraints.
- Check `README.md` and the consuming app's holdbacks before bumping a shared tool.

## 7. Publishing

- Published **public** under the `@mifort-solutions` scope (`publishConfig.access: "public"`).
- **Semver matters** — consumers pin this as a devDependency. A bin rename or an output-path /
  flag change is a breaking change; reflect it in the version. `npm publish` is gated behind `ask`.
- The `files` allowlist (`["src"]`) is the publish boundary. Verify with `npm pack --dry-run` that no
  `dev/`, `.claude/`, or scratch files leak into the tarball.

## 8. Everyday commands

```bash
npm pack --dry-run     # inspect exactly what would publish (the src/ allowlist)
npm ls                 # dependency tree
node src/<bin>.mjs …   # run a bin against the *current* cwd while developing
```

There is no app to start and no test suite wired in this repo yet; QMetriX is exercised by running
its bins against a consuming checkout (e.g. `ai.mifort.com`). When verifying a change, run the
affected bin from a consumer's root and diff its `dist/reports/` output before and after.

---

## 9. Working discipline (scope & interface)

How to *navigate* the code, not just where to put it. These bind exploration, not only output.

1. **Verb work stays inside its verb.** When the task is about one bin (e.g. the coverage pipeline or
   one dashboard collector), read and edit within that module — `src/coverage/`, or the single
   `collectors/<signal>.mjs` — not the whole tree. A collector is independent of its siblings.

2. **Collectors and renderers meet at a data contract, not at internals.** A `collectors/<x>.mjs`
   produces data; `render/` consumes it. Change the shape on one side only by updating the contract,
   not by having the renderer reach into a collector's implementation. If the contract is unclear,
   that is the defect — fix the contract.

3. **Treat the consumer's tree as an external interface.** Depend on documented inputs
   (`dist/reports/*`, `package.json`, conventional source layout), not on any one consumer's private
   structure. If you can't rely on the boundary, the boundary is the bug.

---

## 10. Task pipeline & PM processes

This repo carries the same Claude-driven task pipeline as the rest of the mifort projects, defined in
[dev/processes/](dev/processes/) — the canonical mirror of the installed skills at
`~/.claude/skills/<name>/SKILL.md`:

- **Pipeline** (per task): `/task-add` → `/task-requirement` → `/task-design` → `/task-planning` →
  `/task-implementation` → `/task-code-review`. Artifacts live in `dev/tasks/<slug>/` as
  `00-task.md` … `05-review.md`. See [dev/processes/README.md](dev/processes/README.md).
- **Coworker**: [/task-cowork](dev/processes/task-cowork.md) advances one task per run; drive it with
  `/loop`.
- **PM layer**: [/pm-status](dev/processes/pm-status.md) reports the board; see
  [dev/processes/pm-suite.md](dev/processes/pm-suite.md) for shared conventions.

`dev/processes/` and the global skills are kept in sync: edit the installed copy in
`~/.claude/skills/<name>/SKILL.md` (that is what Claude Code loads), then mirror it back here
(`cp ~/.claude/skills/<name>/SKILL.md dev/processes/<name>.md`) so the process stays versioned with
the repo. The processes here are the **canonical mirror** shared across all mifort projects.

This repo also runs its **own task board** at [dev/tasks/](dev/tasks/): tasks that target QMetriX
itself — its bins, dashboard, packaging, and this tooling — are tracked here. Work on a *consuming*
app's product belongs in that app's repo, not here; only QMetriX's own work lives on this board.

---

## 11. Git workflow — branches & commits

`main` is **protected by convention: never commit to it directly.** Every change — code, docs,
process, config — starts on a branch and lands via PR. This applies to **all** work, not just
`/task-*`.

1. **Branch first, always.** Before the first commit of any unit of work, branch off `main`:
   `<type>/<issue>-<slug>` — `feature/`, `fix/`, `refactor/`, `chore/`, `docs/`
   (e.g. `feature/12-coverage-merge`). No issue yet → `<type>/<slug>`. If the working tree already
   holds unrelated changes on `main`, move them to a branch before committing — don't bundle
   unrelated work into one commit.

2. **Commit early and often — Claude drives the CLI.** Claude makes the commits itself via
   `git commit`; this is a **standing authorization** — you don't re-approve each one. One coherent,
   green change = one commit (not a single dump at the end). Push and open the PR when the work is
   ready for review (or when asked) — never push to `main`.

3. **Authored by you, no AI trailer.** Commits use the repo's git identity
   (currently `Alex Kolonitsky <Alex.Kolonitsky@mifort.org>`) and carry **no** `Co-Authored-By`
   trailer — they are attributed solely to you. *(This overrides the default Claude-Code commit
   trailer.)*

4. **Conventional messages.** `type(scope): description (#issue)` —
   `feat` / `fix` / `refactor` / `chore` / `docs` / `style` / `test`. Imperative mood, ≤ 72-char
   subject; add a body for the *why* when it isn't obvious. PR titles use the same form.

5. **One source of truth for naming.** Task slug `<issue>-<slug>`, branch `<type>/<issue>-<slug>`,
   commit `type(scope): … (#issue)` — defined once in
   [dev/processes/README.md](dev/processes/README.md). Keep this section and that file in sync.
