# Archived tasks

Shipped tasks, moved off the active board (`dev/tasks/*/`) once the issue is closed and the work is
on `main`. Each task is stored as `<slug>.zip` (its full pipeline artifacts: `00-task.md` …
`05-review.md`). The bytes also live in git history; this index is the human-readable record.

## How to archive
1. Confirm the issue is **closed** and the work is on **main** (merged PR or a landing commit).
2. `git mv dev/tasks/<slug> dev/tasks/archive/<slug>`, then
   `Compress-Archive -Path dev/tasks/archive/<slug> -DestinationPath dev/tasks/archive/<slug>.zip -Force`,
   then `rm -rf dev/tasks/archive/<slug>` (keep only the zip).
3. Append a row below (newest last) and land it via a `chore(tasks): archive <slug>` PR.

## How to restore
`Expand-Archive -Path dev/tasks/archive/<slug>.zip -DestinationPath dev/tasks/archive -Force`, then
`git mv dev/tasks/archive/<slug> dev/tasks/<slug>`, and drop the zip + this row in the same PR.

## Index
| # | Task | Type | Priority | Issue (closed) | PR (merged) | Created | Closed | Archive |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Add runnable demo site showcasing QMetriX capabilities | enhancement | Normal | [#1](https://github.com/AlexKolonitskyMifort/qmetrix/issues/1) | [#11](https://github.com/AlexKolonitskyMifort/qmetrix/pull/11) | 2026-06-30 | 2026-06-30 | [1-demo-site.zip](1-demo-site.zip) |
