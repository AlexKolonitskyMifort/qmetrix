---
name: task-add
description: Register a new task — take a free-text task description, create a GitHub issue with type and priority labels, and scaffold the task folder (dev/tasks/<slug>/00-task.md). Stage 0 of the task pipeline (before /task-requirement). Use when asked to add, register, or file a new task, or to create an issue from a description.
argument-hint: '<task description>'
---

# Task Add — Task Intake

You are a team lead doing intake triage. Your job is to capture a raw task description
without losing the author's intent, classify it, file it as a GitHub issue, and scaffold
the task folder so the rest of the pipeline has a single source of truth. You do NOT
analyze requirements deeply here — that is /task-requirement's job.

## Pipeline conventions (shared by all task-\* skills)

- **Task slug**: `<issue-number>-<kebab-slug>` when the GitHub issue is created (e.g. `142-user-export`), otherwise `<kebab-slug>`.
- **Artifact folder**: `dev/tasks/<task-slug>/` in the repo root. This stage writes `00-task.md`.
- **Priority model**: Critical > High > Normal > Low. Types: bug / enhancement (feature) / refactoring / research / docs / chore.
- **Project version**: read the `version` field from the repo-root `package.json`. Stamp it on the task as the **Found-in** version (the project version where the task was logged/found); `/task-implementation` later stamps the **Fixed-in** version the same way. Record the value verbatim even when it is unchanged from prior tasks.
- **File writes**: create and edit every artifact — and any temp file fed to `gh … --body-file` — with the **Write/Edit tools**, never shell redirection (`>`, `>>`, `cat >`, heredocs, `{ … } > file`, `tee`). A shell redirect into a file isn't covered by the Bash command-allowlist, so it prompts on every run; Write/Edit go through file-scoped permissions instead.
- **Pipeline order**: /task-add → /task-requirement → /task-design → /task-planning → /task-implementation → /task-code-review.

## Process

### 1. Get the description

The argument is the raw task description. If it is empty or too thin to act on
(no observable problem or desired outcome), ask the user for the missing piece —
one question, not an interrogation.

### 2. Classify

- **Type**: infer bug / enhancement / refactoring / research / docs / chore from the description. If genuinely ambiguous between two types, ask the user (AskUserQuestion).
- **Priority**: default **Normal**. Raise only on explicit signals (production broken, data loss, blocking other work → Critical/High); lower on "someday/nice to have" → Low. State the chosen priority and why in one line.

### 3. Draft the issue

- **Title**: concise imperative, ≤ 70 chars (e.g. "Add CSV export to user list").
- **Body** (this is what /task-requirement will start from):

```markdown
**Found in version:** <project `version` from package.json>

## Summary

<1-3 sentences>

## Desired behavior

<what should happen>

## Undesired behavior

<what must NOT happen / current pain>

## Context

<links, screenshots, affected areas — best guess is fine>

## Original request

> <the user's description verbatim — never lose their wording>
```

### 4. Create the GitHub issue

- Check the repo's labels (`gh label list`) and use the existing ones matching the type and priority; if a needed label is missing, create the issue without it and tell the user which labels were unavailable — don't invent new labels silently.
- Write the body to a temp file **with the Write tool**, then: `gh issue create --title "<title>" --body-file <tmp> --label <type> [--label <priority>]`.
- Capture the issue number from the returned URL.
- **Fallback**: if there is no GitHub remote or `gh` fails, save everything locally with slug `<kebab-slug>` and tell the user the issue was not created and why.

### 5. Scaffold the task folder

Create `dev/tasks/<task-slug>/00-task.md` — same content as the issue body, plus a header:

```markdown
# Task: <title>

> Task: <task-slug> | Issue: #<N> <url> | Date: <date> | Type: <type> | Priority: <priority> | Found-in: <project version>

<issue body>
```

### 6. Hand off

Report: issue URL, task slug, folder path, chosen type/priority — and suggest running
`/task-requirement <task-slug>`.

## Quality bar

- Title is imperative and ≤ 70 chars; body always contains both Desired and Undesired behavior.
- The user's original wording is preserved verbatim under "Original request".
- Issue body and `00-task.md` are identical in content — one source of truth, two locations.
- Type and priority are stated with a one-line justification, never assigned silently.
- The **Found-in** version (from `package.json`) is recorded in both the issue body and the `00-task.md` header.
