---
name: task-code-review
description: Adversarial review of implemented code — actively try to break it and find every weakness (security, edge cases, races, abuse paths) before a user or attacker does. Acts as an offensive-minded reviewer. Use when asked to review a task/PR/branch hard, or as stage 5 of the task pipeline (after /task-implementation).
argument-hint: '<task-slug | PR-number | branch>'
---

# Task Code Review — Adversarial Reviewer

You are reviewing your own team's code with an attacker's mindset: your goal is to
**break it**, not to approve it. Assume the code is guilty until proven innocent.
A review that finds nothing must prove it looked hard — list what was attacked and survived.
This is a defensive review of code you have authorization to test; findings exist
to be fixed, with concrete scenarios and fixes attached.

## Pipeline conventions (shared by all task-\* skills)

- **Artifact folder**: `dev/tasks/<task-slug>/`. This stage reads all prior artifacts and writes `05-review.md`.
- **Project version**: carry the **Found-in** version from `00-task.md` and the **Fixed-in** version from `04-implementation.md` into the review header — the review is the record that confirms the task is fixed in that version.
- **GitHub sync**: when a PR exists, post findings as a PR review; when only an issue exists, `gh issue comment <N> --body-file dev/tasks/<task-slug>/05-review.md`.
- **File writes**: create and edit every artifact — and any temp file fed to `gh … --body-file` — with the **Write/Edit tools**, never shell redirection (`>`, `>>`, `cat >`, heredocs, `{ … } > file`, `tee`). A shell redirect into a file isn't covered by the Bash command-allowlist, so it prompts on every run; Write/Edit go through file-scoped permissions instead.
- **Pipeline order**: /task-add → /task-requirement → /task-design → /task-planning → /task-implementation → /task-code-review.

## Process

### 1. Determine the scope

- Task slug → branch from `04-implementation.md`; PR number → `gh pr diff <N>`; branch → `git diff <default-branch>...<branch>`.
- Read `01-requirements.md` (the ACs are the contract) and `02-design.md` (the diff must match the design). Review intent, not just code.
- Read the full diff, then open the surrounding code of every changed hunk — bugs hide in the interaction between the change and the unchanged code around it.

### 2. Attack passes

Run each lens over the diff as a separate pass. Do not blend them — each lens catches what the others miss.

**Security**

- Injection: SQL/NoSQL, command, XSS (stored/reflected/DOM), template, path traversal, SSRF.
- AuthN/AuthZ: missing checks, IDOR (can user A reach user B's object by changing an id?), privilege escalation, endpoints trusting client-side state.
- Secrets: keys/tokens/passwords in code, logs, error messages, or committed config.
- Input trust: every external input (params, headers, cookies, file uploads, webhook payloads) — what happens with hostile values?

**Correctness & edge cases**

- Empty, null/undefined, zero, negative, huge, unicode/emoji, whitespace-only inputs.
- Off-by-one, boundary values, timezone/DST, locale, float comparison.
- Error paths: what does the user see when each external call fails? Is anything swallowed silently?

**Concurrency & state**

- Race conditions: double-submit, parallel requests on the same resource, check-then-act gaps.
- Idempotency of retries; partial-failure states (step 2 of 3 fails — what's left behind?).
- Stale caches/ISR, optimistic UI vs server truth.

**Abuse & limits**

- How would a malicious or careless user weaponize this feature? Spam, oversized payloads, rate-limit gaps, enumeration.
- Resource exhaustion: unbounded queries, N+1, loops over user-controlled collections, memory growth.

**Tests as a target**

- Can you change the code's behavior in a way users would notice while every test still passes? Each such mutation is a missing-test finding.
- Do tests assert real behavior or mock so much they only test the mocks?

**Contract compliance**

- Walk every AC: is it actually satisfied in the diff (point at the lines), or only claimed in `04-implementation.md`?
- Diff vs design: undocumented deviations, files changed that the design never listed.

### 3. Prove each finding

For every candidate finding, construct the concrete failure scenario: the exact input,
sequence of requests, or timing that triggers it — quote `file:line`. If you cannot
build a plausible scenario, downgrade it to a note or drop it. Severity:

- **Critical** — exploitable security hole or data loss/corruption.
- **High** — wrong behavior on realistic inputs, broken AC.
- **Medium** — breaks on plausible edge cases, missing error handling, perf cliff.
- **Low** — hardening, code-quality risk, missing test.

### 4. Write the artifact

Save `dev/tasks/<task-slug>/05-review.md`:

```markdown
# Review: <title>

> Task: <task-slug> | PR: #<N or —> | Date: <date>
> Found-in: <00-task version> | Fixed-in: <04-implementation version>
> Verdict: APPROVE | NEEDS WORK | REJECT

## Findings

| # | Severity | Location | Weakness | Attack/failure scenario | Suggested fix |

## AC Verification

| AC | Status | Evidence (file:line / test) |

## Attack Surface Checked

<every lens run and what survived it — so "no findings" is a claim, not an omission>
```

### 5. Sync and hand off

- PR exists → post the review with `gh pr review` (inline comments for Critical/High, summary for the rest). Issue only → post the artifact as a comment.
- Report: verdict, finding counts by severity, the single worst finding in one sentence.
- If Critical/High findings exist, recommend `/task-implementation <task-slug>` to fix them, then re-run this review on the new diff.

## Quality bar

- Every finding has a concrete, reproducible scenario and a `file:line` — no vibes-based findings.
- Every AC is checked against the actual diff, not the implementation report's claims.
- The Attack Surface Checked section is filled in even when the verdict is APPROVE.
- Verdict is honest: one Critical finding means NEEDS WORK, regardless of how good the rest is.
- The review header carries the **Found-in** and **Fixed-in** versions from `00-task.md` / `04-implementation.md`.
