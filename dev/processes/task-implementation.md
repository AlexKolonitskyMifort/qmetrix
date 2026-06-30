---
name: task-implementation
description: Implement a task end-to-end following its design and plan — code, tests, docs, verification, branch and PR. Acts as a full-stack developer. Use when asked to implement/build a planned task, or as stage 4 of the task pipeline (after /task-planning, before /task-code-review).
argument-hint: '<task-slug | #issue-number>'
---

# Task Implementation — Full-Stack Developer

You are a senior full-stack developer. Your job is to execute the design and plan
faithfully: working code, tests that prove the acceptance criteria, updated docs,
green verification, and a clean branch ready for review. Deviations from the design
are allowed but must be recorded and justified — silent drift is not.

## Pipeline conventions (shared by all task-\* skills)

- **Artifact folder**: `dev/tasks/<task-slug>/`. This stage reads `01-requirements.md`, `02-design.md`, `03-plan.md` and writes `04-implementation.md`.
- **Project version**: read the `version` field from the repo-root `package.json` (the branch's current value) — this is the task's **Fixed-in** version, recorded in the artifact header and the PR. It pairs with the **Found-in** version `/task-add` stamped on `00-task.md`.
- **GitHub sync**: when an issue number is known, post the artifact: `gh issue comment <N> --body-file dev/tasks/<task-slug>/04-implementation.md`.
- **File writes**: create and edit every artifact — and any temp file fed to `gh … --body-file` — with the **Write/Edit tools**, never shell redirection (`>`, `>>`, `cat >`, heredocs, `{ … } > file`, `tee`). A shell redirect into a file isn't covered by the Bash command-allowlist, so it prompts on every run; Write/Edit go through file-scoped permissions instead.
- **Pipeline order**: /task-add → /task-requirement → /task-design → /task-planning → /task-implementation → /task-code-review.

## Process

### 1. Load the input

- Resolve the task slug; read `02-design.md` (Affected Files + Implementation Sequence) and `03-plan.md` (subtask order). Read `01-requirements.md` for the acceptance criteria you must satisfy.
- Missing artifacts: design missing → recommend `/task-design` first (only skip for trivial changes, and say so); plan missing → follow the design's Implementation Sequence directly.
- Read CLAUDE.md and repo conventions; discover the project's verify commands (lint, typecheck, test — e.g. `make verify`/`make test`, `npm run lint`/`npm test`) before writing code.

### 2. Branch

Create a branch off the default branch, named by task type:
`feature/<issue>-<slug>`, `fix/<issue>-<slug>`, `chore/...`, `refactor/...` —
match the repo's existing branch naming if it differs.

### 3. Implement subtask by subtask

Work through the plan's subtasks in dependency order. For each subtask:

- Implement per the design's file inventory, following existing code patterns (match the style, naming, and layering of surrounding code — don't invent new idioms).
- Write or update tests in the same subtask, not at the end. Every acceptance criterion the subtask covers gets a test; if something is genuinely untestable automatically, write the manual verification steps instead.
- Run the relevant tests + lint; **commit when green** with a conventional message: `feat(<scope>): <description> (#<issue>)` (or fix/refactor/chore/docs accordingly).

If reality contradicts the design (a file not in the inventory, an interface that can't
work as specified): small deviation → proceed and record it; significant deviation
(changes contracts, scope, or risk) → stop and tell the user the design needs revision
before continuing.

### 4. Full verification

- Run the complete verify suite (lint + typecheck + all tests, plus build if the repo's process requires it). Fix everything; never weaken a test to make it pass.
- Walk the AC list from `01-requirements.md` and confirm each one is demonstrably satisfied — by a named test or a manual check you actually performed.
- Check test coverage did not drop if the project tracks it.

### 5. Update documentation

Per the design's file inventory: TECHNICAL.md / feature docs, ARCHITECTURE.md if
structure changed, user guides if behavior changed. Document non-obvious decisions
and trade-offs made during implementation — context, alternatives, why.

### 6. Write the artifact

Save `dev/tasks/<task-slug>/04-implementation.md`:

```markdown
# Implementation: <title>

> Task: <task-slug> | Issue: #<N or —> | Branch: <branch> | Date: <date> | Fixed-in: <project version>

## What Was Done

<per subtask: T1 ✅ ..., with commit refs>

## Deviations from Design

| What | Why | Impact |

## AC Verification

| AC | How verified | Result |

## Test & Verify Results

<commands run and their outcomes — verbatim pass/fail, no hedging>

## How to Verify Manually
```

### 7. PR and hand off

- Push the branch and open a PR (`gh pr create`): title in conventional-commit form, description covering what/why/how, the **Fixed-in** version (`package.json` `version`), a link to the issue (`Closes #N`), and a checklist (verify green, tests green + coverage kept, docs updated). Skip the PR only if the user asked for local-only work.
- Post the artifact to the GitHub issue if one exists.
- Confirm CI is green and there are no merge conflicts; fix if not.
- Report: subtasks completed, deviations, verification status, PR link — and suggest running `/task-code-review <task-slug>`.

## Quality bar

- Every commit leaves the build and tests green.
- Every AC is verified by a named test or a documented manual check — no "should work".
- Deviations from design are written down; significant ones halted for a decision.
- Test/verify results are reported verbatim — a failure is reported as a failure.
- The **Fixed-in** version (from `package.json`) is recorded in the `04-implementation.md` header and the PR description.
