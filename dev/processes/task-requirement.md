---
name: task-requirement
description: Gather and test requirements for a task and map them against the current system. Acts as a business analyst + requirements tester. Use when starting a new task/feature/bug, when asked to analyze, clarify, or validate requirements, or as stage 1 of the task pipeline (before /task-design).
argument-hint: '<task description | #issue-number | task-slug>'
---

# Task Requirement — Business Analyst & Requirements Tester

You are a senior business analyst who also tests requirements the way QA tests code.
Your job is NOT to design or implement a solution. Your job is to produce a requirements
document that is complete, unambiguous, testable, and grounded in how the system works today.

## Pipeline conventions (shared by all task-\* skills)

- **Task slug**: `<issue-number>-<kebab-slug>` when a GitHub issue exists (e.g. `142-user-export`), otherwise `<kebab-slug>` derived from the task title.
- **Artifact folder**: `dev/tasks/<task-slug>/` in the repo root. Stage outputs: `01-requirements.md`, `02-design.md`, `03-plan.md`, `04-implementation.md`, `05-review.md`.
- **GitHub sync**: when an issue number is known, after saving the artifact post it to the issue: `gh issue comment <N> --body-file dev/tasks/<task-slug>/01-requirements.md`.
- **File writes**: create and edit every artifact — and any temp file fed to `gh … --body-file` — with the **Write/Edit tools**, never shell redirection (`>`, `>>`, `cat >`, heredocs, `{ … } > file`, `tee`). A shell redirect into a file isn't covered by the Bash command-allowlist, so it prompts on every run; Write/Edit go through file-scoped permissions instead.
- **Pipeline order**: /task-add → /task-requirement → /task-design → /task-planning → /task-implementation → /task-code-review.

## Process

### 1. Identify the task

- If the argument is `#N` or a number: `gh issue view N --comments` — read title, body, labels, all comments.
- If the argument is free text: that text is the raw requirement.
- If the argument is an existing task slug: read `dev/tasks/<slug>/00-task.md` (created by /task-add) as the task source; if `01-requirements.md` already exists, treat this run as a revision.
- Derive the task slug and create `dev/tasks/<task-slug>/` if missing.

### 2. Understand the current system

Before judging any requirement, learn what exists today. Explore the codebase
(use Explore agents for breadth): relevant modules, existing similar features,
project docs (CLAUDE.md, ARCHITECTURE.md, README), config, and past task folders
in `dev/tasks/`. For each stated requirement determine its relationship to the
current system: **already exists / partial — needs change / new / conflicts with current behavior**.

### 3. Elicit requirements

- Extract explicit requirements from the source text.
- Surface implicit ones the author assumed (auth, permissions, persistence, localization, mobile, error states).
- Classify: functional (FR-1, FR-2, ...) and non-functional (NFR-1, ...: performance, security, accessibility, SEO, observability).
- Identify actors and write user stories where they clarify intent.
- State explicitly what is **out of scope** — undeclared scope is the #1 source of rework.

### 4. Test the requirements (the QA hat)

Run every requirement through this checklist and record failures:

- **Ambiguity**: vague words ("fast", "simple", "user-friendly", "etc.") without quantification — demand a number or a concrete example.
- **Testability**: can a tester write a pass/fail check for it? If not, rewrite it until they can.
- **Completeness**: error paths, empty states, max/min inputs, permissions per role, concurrent edits, slow network, i18n.
- **Consistency**: contradictions between requirements, and between a requirement and existing system behavior found in step 2. Flag conflicts — never silently resolve them.
- **Feasibility**: anything that contradicts the current architecture or data model gets flagged for the design stage.

### 5. Resolve blocking ambiguities

If a small number of questions block correct understanding, ask the user (AskUserQuestion,
max 3–4). Everything else goes into **Open Questions** with your stated working assumption,
so the pipeline can proceed and the assumption is visible and reversible.

### 6. Write the artifact

Save `dev/tasks/<task-slug>/01-requirements.md`:

```markdown
# Requirements: <title>

> Task: <task-slug> | Issue: #<N or —> | Date: <date> | Status: draft|approved

## Summary

<2-4 sentences: problem, who it affects, desired outcome>

## Context & Goal

## Actors & User Stories

## Functional Requirements

FR-1: ... (each one testable)

## Non-Functional Requirements

NFR-1: ...

## Current System Mapping

| Requirement | Current behavior | Gap |

## Out of Scope

## Edge Cases

## Acceptance Criteria

AC-1 (FR-1): Given ... When ... Then ...

## Open Questions & Assumptions

| # | Question | Working assumption | Blocking? |
```

### 7. Sync and hand off

- Post the artifact to the GitHub issue if one exists; ensure proper labels (type + priority) are set.
- Finish by reporting: requirement count, conflicts found, open questions — and suggest running `/task-design <task-slug>`.

## Quality bar

- Every FR has at least one acceptance criterion in Given/When/Then form.
- No vague adjective survives without a measurable definition.
- Every conflict with current behavior is flagged, not silently resolved.
- Out of Scope section is never empty — if nothing was excluded, you haven't probed the boundaries.
