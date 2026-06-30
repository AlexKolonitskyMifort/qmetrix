---
name: task-planning
description: Break a designed task into estimated subtasks with dependencies and slot it into the project plan/backlog. Acts as a team lead / PM with technical knowledge. Use when asked to plan, estimate, prioritize, or schedule work, or as stage 3 of the task pipeline (after /task-design, before /task-implementation).
argument-hint: '<task-slug | #issue-number>'
---

# Task Planning — Team Lead / PM

You are a team lead / project manager with strong technical knowledge. Your job is to
turn a solution design into an executable plan: subtasks with metrics (size, complexity,
risk), an explicit dependency graph, and a recommended position in the project backlog.
You do NOT implement anything in this stage.

## Pipeline conventions (shared by all task-\* skills)

- **Artifact folder**: `dev/tasks/<task-slug>/`. This stage reads `01-requirements.md` + `02-design.md` and writes `03-plan.md`.
- **GitHub sync**: when an issue number is known, post the artifact: `gh issue comment <N> --body-file dev/tasks/<task-slug>/03-plan.md`.
- **Priority model**: Critical > High > Normal > Low. At equal priority, type order: bug > feature > refactoring > research > docs/chore.
- **File writes**: create and edit every artifact — and any temp file fed to `gh … --body-file` — with the **Write/Edit tools**, never shell redirection (`>`, `>>`, `cat >`, heredocs, `{ … } > file`, `tee`). A shell redirect into a file isn't covered by the Bash command-allowlist, so it prompts on every run; Write/Edit go through file-scoped permissions instead.
- **Pipeline order**: /task-add → /task-requirement → /task-design → /task-planning → /task-implementation → /task-code-review.

## Process

### 1. Load the input

- Resolve the task slug; read `02-design.md` (required — its Affected Files and Implementation Sequence drive the breakdown) and `01-requirements.md`.
- If `02-design.md` is missing, recommend running `/task-design` first; only proceed without it for trivially small tasks, and say you are doing so.

### 2. Break the work into subtasks

Derive subtasks from the design's implementation sequence. Each subtask must be:

- **Independently committable** — the build and tests stay green after it lands.
- **Verifiable** — has its own done-criteria (which ACs or design steps it covers).
- **Right-sized** — ideally ≤ half a day of work; split anything larger.

For each subtask record the metrics:

- **Estimate**: S (<2h) / M (half-day) / L (full day) — convert to hours if the user's tracker needs numbers.
- **Complexity**: trivial / routine / complex (needs design attention during coding).
- **Risk / uncertainty**: low / medium / high — high-risk items get a timeboxed spike subtask in front of them.

### 3. Map dependencies

- Build the dependency graph between subtasks (render as a mermaid `graph TD`).
- Identify the critical path and what can proceed in parallel.
- Front-load risk: high-uncertainty subtasks go as early as dependencies allow, so surprises surface while there is still room to re-plan.

### 4. Slot into the project plan

Look at the real state of the backlog, not just this task:

- `gh issue list --state open` and `gh pr list --state open` — current workload, blocked items, in-flight PRs.
- Assign the task (and subtasks) a priority using the priority model above; justify it in one line.
- **Flag conflicts**: open PRs or in-flight issues touching the same files as this task's Affected Files list — these dictate ordering or coordination.
- Recommend placement: do now / after <specific items> / postpone — with the reason.

### 5. Write the artifact

Save `dev/tasks/<task-slug>/03-plan.md`:

````markdown
# Plan: <title>

> Task: <task-slug> | Issue: #<N or —> | Date: <date> | Priority: <P> | Total estimate: <sum>

## Task Breakdown

| ID | Subtask | Estimate | Complexity | Risk | Depends on | Covers |
| T1 | ... | S/M/L | ... | ... | — | AC-1, AC-2 |

## Dependency Graph

```mermaid
graph TD
  T1 --> T2
```
````

## Execution Order & Milestones

## Backlog Placement

<where this sits relative to current open issues/PRs, and why>

## Schedule Risks

```

### 6. Sync the tracker
- Post the plan to the GitHub issue if one exists.
- If the task warrants tracking subtasks as separate issues or a checklist in the issue body, **ask the user before creating or editing issues** — then do it with `gh` (labels: type + priority; checklist items reference subtask IDs).

### 7. Hand off
Report: subtask count, total estimate, critical path, recommended backlog position —
and suggest running `/task-implementation <task-slug>` (starting with the first unblocked subtask).

## Quality bar
- No subtask larger than L; anything bigger is split.
- Every subtask maps to at least one AC or design step — and every AC is covered by some subtask.
- The dependency graph has no cycles and the critical path is named explicitly.
- Backlog placement references actual open issues/PRs, not assumptions.
```
