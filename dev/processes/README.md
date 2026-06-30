# Task Pipeline — process & skill definitions

A six-stage development pipeline driven by Claude Code skills. Each stage plays a
distinct role, produces a markdown artifact, and hands off to the next stage. The
files in this folder are the canonical definitions, mirrored from the installed
skills at `~/.claude/skills/<name>/SKILL.md`.

## Pipeline

| #   | Skill                                          | Role                                   | Reads                | Writes                                    |
| --- | ---------------------------------------------- | -------------------------------------- | -------------------- | ----------------------------------------- |
| 0   | [/task-add](task-add.md)                       | Team lead (intake triage)              | task description     | `00-task.md` + GitHub issue               |
| 1   | [/task-requirement](task-requirement.md)       | Business analyst + requirements tester | `00-task.md` / issue | `01-requirements.md`                      |
| 2   | [/task-design](task-design.md)                 | Team lead / architect                  | `01`                 | `02-design.md`                            |
| 3   | [/task-planning](task-planning.md)             | Team lead / PM                         | `01`, `02`           | `03-plan.md`                              |
| 4   | [/task-implementation](task-implementation.md) | Full-stack developer                   | `01`–`03`            | `04-implementation.md` + code, branch, PR |
| 5   | [/task-code-review](task-code-review.md)       | Adversarial reviewer                   | `01`–`04`, diff      | `05-review.md` + PR review                |

## Shared conventions

- **Task slug**: `<issue-number>-<kebab-slug>` (e.g. `142-user-export`); `<kebab-slug>` if no issue.
- **Artifact folder**: `dev/tasks/<task-slug>/` in the repo root, files `00-task.md` … `05-review.md`.
- **File writes**: create and edit every artifact — and any temp file fed to `gh … --body-file` — with the **Write/Edit tools**, never shell redirection (`>`, `>>`, `cat >`, heredocs, `{ … } > file`, `tee`). A shell redirect into a file isn't covered by the Bash command-allowlist, so it prompts on every run; Write/Edit go through file-scoped permissions instead.
- **Active board vs. archive**: top-level `dev/tasks/*/` is the **live board** — only in-flight tasks.
  When a task's PR is **merged**, its folder is archived to `dev/tasks/archive/<task-slug>/` (see
  _Lifecycle_ below). Archived folders stay in the repo as the design record but are excluded from
  the board and from `/task-cowork`'s scan.
- **GitHub sync**: every stage posts its artifact to the task's GitHub issue
  (`gh issue comment <N> --body-file …`); the review stage posts to the PR instead.
- **Priority model**: Critical > High > Normal > Low. At equal priority, type order:
  bug > feature > refactoring > research > docs > chore.
- **Project version (Found-in / Fixed-in)**: every task records the project `version` (the `version` field
  of the repo-root `package.json`) at two points — **Found-in** at `/task-add` (the version where the task was
  logged/found, in the `00-task.md` header and the GitHub issue) and **Fixed-in** at `/task-implementation`
  (the version the fix ships in, in the `04-implementation.md` header and the PR). `/task-code-review` carries
  both into its `05-review.md` header. The version is currently static (`0.1.0`, no release tags), so today both
  fields read the same — that's expected; they become meaningful once the version is bumped per release.
- **Branches**: `feature/<issue>-<slug>`, `fix/…`, `refactor/…`, `chore/…`, `docs/…`.
  **Never commit directly to `main`** — every change lands via a branch + PR. Commits and PR
  titles in conventional-commit form: `feat(<scope>): <description> (#<issue>)`, authored under the
  repo's git identity with **no `Co-Authored-By` trailer**. Claude makes the commits itself via the
  git CLI, frequently (one coherent green change per commit). See **CLAUDE.md §13** for the standing
  rule that governs all work, pipeline or not.

## Usage

```
/task-add Add CSV export to the user list
  → creates issue #N and dev/tasks/N-user-csv-export/00-task.md
/task-requirement N-user-csv-export
/task-design N-user-csv-export
/task-planning N-user-csv-export
/task-implementation N-user-csv-export
/task-code-review N-user-csv-export
```

Stages may be skipped for small tasks, but each skill states explicitly when it is
proceeding without an upstream artifact. A significant deviation discovered mid-stage
(e.g. design doesn't survive contact with the code) sends the task back to the
earlier stage rather than drifting silently.

## Lifecycle — archiving on merge

The GitHub issue tracks **status** (closed-by-PR = done); the task folder is the durable
**design record** (the _why_ — requirements, alternatives, plan). Once the work ships, keep the
rationale but get it off the active board:

```bash
# after the task's PR is merged and its issue is closed
git mv dev/tasks/<slug> dev/tasks/archive/<slug>
git commit -m "chore(tasks): archive <slug> (merged in #<pr>)"
```

Use `git mv` so history follows the files. Archive — never delete: git keeps the bytes either way,
but a live `archive/` folder keeps the design rationale one click away instead of buried in history.
To resume an archived task, move it back to the top level.

## Scheduled coworker — [/task-cowork](task-cowork.md)

An **orchestrator**, not a stage. Each run scans `dev/tasks/*` (excluding `archive/`), picks the single
highest-priority task that is ready to move, and drives it through the stages above as far
as it can safely go — stopping at genuine human-decision points (recorded as a
`## ⏳ NEEDS HUMAN` block in the artifact + a GitHub issue comment). Small mechanical tasks
flow all the way to an open PR; research tasks stop each phase to ask. It never merges a PR,
never pushes to `main`, and advances at most one task per run.

Drive it on a schedule with `/loop` (several times a day):

```
/loop 3h /task-cowork          # every ~3h: advance one task, report a standup digest
/task-cowork                   # one-off: do a single sitting now
/task-cowork 18-portfolio-…    # target a specific task
```

The loop runs in your session, so the coworker can also surface questions inline; the
written NEEDS-HUMAN block stays the source of truth so nothing is lost when you're away.

## Updating the skills

Edit the installed copy in `~/.claude/skills/<name>/SKILL.md` (that is what Claude Code
loads), then mirror the change here so the process stays versioned with the repo:

```bash
for s in task-add task-requirement task-design task-planning task-implementation task-code-review; do
  cp ~/.claude/skills/$s/SKILL.md dev/processes/$s.md
done
```
