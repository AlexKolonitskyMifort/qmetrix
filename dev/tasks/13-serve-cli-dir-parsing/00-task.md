# Task: Fix serve.mjs standalone CLI mistaking option value for <dir>
> Task: 13-serve-cli-dir-parsing | Issue: #13 https://github.com/AlexKolonitskyMifort/qmetrix/issues/13 | Date: 2026-06-30 | Type: bug | Priority: Low | Found-in: 1.0.0

**Found in version:** 1.0.0

## Summary
The standalone `dev/demo/serve.mjs` CLI derives the served directory as the first non-flag token.
When the positional `<dir>` is omitted but an option is passed, the **option's value** is mistaken
for the directory, so the server roots itself at a nonexistent path. Surfaced as finding **NF1** in the
#1 demo-site code review (`dev/tasks/archive/1-demo-site.zip` → `05-review.md`).

## Desired behavior
`node dev/demo/serve.mjs --port 9000` serves the default directory (`.`) on port 9000. Options and the
positional `<dir>` are parsed independently regardless of order, e.g. `--host 127.0.0.1` does not become
the served directory.

## Undesired behavior
- `node dev/demo/serve.mjs --port 9000` → `dir = '9000'` (the port value) → serves a nonexistent `./9000`,
  so every request 404s.
- `node dev/demo/serve.mjs --host 127.0.0.1` → `dir = '127.0.0.1'`.
- Verified by reproducing the parse: `--port 9000` → `{ dir: '9000', port: 9000 }`.

## Context
- **Root cause:** in the standalone CLI block of `dev/demo/serve.mjs`,
  `const dir = argv.find((a) => !a.startsWith('--')) || '.'` grabs the first non-flag token, which is an
  option's value when `<dir>` is omitted.
- **Scope/impact:** Low. Only the documented standalone convenience CLI
  (`node dev/demo/serve.mjs <dir> [--port] [--host]`) is affected; the documented form with `<dir>` first
  works. The primary entry `npm run demo` is **unaffected** — `run.mjs` calls `startServer()` directly and
  never invokes this CLI. Pre-existing since commit `570693a`; not introduced by the review fixes.
- **Suggested fix:** parse options first, then take the first *remaining* positional as `<dir>` (e.g. skip
  any token immediately preceded by `--port`/`--host`), or require `<dir>` before flags and default it
  otherwise. The same `opt()` value/flag guard already added to `run.mjs`/`serve.mjs` in #1 can inform it.

## Original request
> Fix serve.mjs standalone-CLI arg parsing: when the positional <dir> is omitted but an option is passed,
> the option's value is mistaken for the directory. Found as NF1 in the #1 demo-site code review
> (dev/tasks/archive/1-demo-site.zip → 05-review.md).
>
> Repro: `node dev/demo/serve.mjs --port 9000` → dir='9000' (the port value) → serves a nonexistent ./9000
> so every request 404s. Same for `node dev/demo/serve.mjs --host 127.0.0.1` → dir='127.0.0.1'. Verified by
> reproducing the parse: `--port 9000` → {dir:'9000', port:9000}.
>
> Root cause: in the standalone CLI block of dev/demo/serve.mjs,
> `const dir = argv.find((a) => !a.startsWith('--')) || '.'` grabs the first non-flag token, which is an
> option's value when <dir> is omitted.
>
> Scope/impact: Low. Only the documented standalone convenience CLI
> (`node dev/demo/serve.mjs <dir> [--port] [--host]`) is affected; the documented form with <dir> first
> works. The primary entry `npm run demo` is unaffected — run.mjs calls startServer() directly, never this
> CLI. Pre-existing since commit 570693a, not introduced by the review fixes.
>
> Suggested fix: parse options first, then take the first remaining positional as <dir> (e.g. skip any
> token immediately preceded by --port/--host), or require <dir> before flags and default it otherwise.
>
> Type: bug. Priority: Low.
