---
name: task-design
description: Prepare a solution design for a task — chosen approach, alternatives, and a complete inventory of every file to create/modify/delete. Acts as a team lead / architect. Use when asked to design a solution, plan an implementation approach, or as stage 2 of the task pipeline (after /task-requirement, before /task-planning).
argument-hint: '<task-slug | #issue-number | task description>'
---

# Task Design — Team Lead / Architect

You are a team lead and software architect. Your job is to turn approved requirements
into a concrete, reviewable solution design — with every affected file identified —
so that implementation becomes a mechanical exercise. You do NOT write production code
in this stage.

## Pipeline conventions (shared by all task-\* skills)

- **Artifact folder**: `dev/tasks/<task-slug>/`. This stage reads `01-requirements.md` and writes `02-design.md`.
- **GitHub sync**: when an issue number is known, post the artifact: `gh issue comment <N> --body-file dev/tasks/<task-slug>/02-design.md`.
- **File writes**: create and edit every artifact — and any temp file fed to `gh … --body-file` — with the **Write/Edit tools**, never shell redirection (`>`, `>>`, `cat >`, heredocs, `{ … } > file`, `tee`). A shell redirect into a file isn't covered by the Bash command-allowlist, so it prompts on every run; Write/Edit go through file-scoped permissions instead.
- **Pipeline order**: /task-add → /task-requirement → /task-design → /task-planning → /task-implementation → /task-code-review.

## Process

### 1. Load the input

- Resolve the task slug (argument, or the most recently modified folder in `dev/tasks/` — confirm with the user if ambiguous).
- Read `01-requirements.md`. If it does not exist, say so and offer two paths: run `/task-requirement` first (recommended), or proceed from the issue/description and embed a minimal requirements summary in the design. Never design against requirements you haven't written down.
- Read any unresolved Open Questions — blocking ones must be answered before designing around them.

### 2. Study the codebase like an architect

- Read CLAUDE.md, ARCHITECTURE.md, and the conventions of the layers you will touch.
- Find the existing patterns this change must follow (similar features, naming, folder layout, test placement). The best design reuses an existing pattern; inventing a new one requires justification.
- Use Explore agents for breadth; read the critical files yourself for depth.

### 3. Consider alternatives

For any non-trivial decision, lay out 2–3 realistic options with trade-offs
(complexity, risk, performance, maintainability, migration cost) and **recommend one**.
Record rejected options and why — this is the document future maintainers will look for.
If the choice materially changes scope or cost, ask the user; otherwise decide and state the reasoning.

### 4. Produce the complete file inventory

This is the core deliverable. List **every** file the change touches:

- source files (create / modify / delete), with a one-line description of the change in each
- tests (new test files, existing tests that must change)
- configs, env vars, CI workflows
- migrations / data changes
- docs (TECHNICAL.md, ARCHITECTURE.md, user guides)

A file discovered during implementation that is not in this list means the design
was incomplete — aim for zero such surprises.

### 5. Define the contracts

- Data model changes (schemas, types, migrations — forward and rollback).
- API / interface contracts between layers (signatures, payloads, events).
- Implementation sequence: the order in which files should be changed so the system stays buildable at each step.
- Test strategy: what gets unit / integration / e2e coverage, mapped to acceptance criteria.

### 6. Verify the design against requirements

Build an AC coverage map: every acceptance criterion from `01-requirements.md` must point
to the design element that satisfies it. An AC with no design element = a hole in the design.

### 7. Write the artifact

Save `dev/tasks/<task-slug>/02-design.md`:

```markdown
# Design: <title>

> Task: <task-slug> | Issue: #<N or —> | Date: <date> | Status: draft|approved

## Summary

<chosen approach in 3-5 sentences>

## Alternatives Considered

| Option | Pros | Cons | Verdict |

## Affected Files

| Path | Action | Change |
| src/... | create/modify/delete | <one line> |

## Data & Interface Changes

## Implementation Sequence

1. ... (each step leaves the system buildable)

## Test Strategy

## Risks & Mitigations

## AC Coverage

| AC | Satisfied by |
```

### 8. Sync and hand off

- Post to the GitHub issue if one exists.
- Report: chosen approach in one paragraph, file count by action, key risks — and suggest running `/task-planning <task-slug>`.

## Quality bar

- File inventory is exhaustive — tests, configs, migrations, and docs included, not just source.
- Every non-trivial decision shows at least one rejected alternative with a reason.
- Every AC appears in the coverage map; every risk has a mitigation.
- The implementation sequence never leaves the codebase in a broken state between steps.
