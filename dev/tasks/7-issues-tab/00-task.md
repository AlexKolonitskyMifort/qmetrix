# Task: Add an Issues tab listing all code findings to the board UI
> Task: 7-issues-tab | Issue: #7 https://github.com/AlexKolonitskyMifort/qmetrix/issues/7 | Date: 2026-06-30 | Type: enhancement | Priority: Normal | Found-in: 1.0.0

**Found in version:** 1.0.0

## Summary
The board UI surfaces aggregate metrics but has no single place to browse the individual problems the analysis tools report. Add an **Issues** tab that aggregates every finding from all tools (security/zizmor, qlty duplication & structure, lint, …) into one searchable, filterable list — one row per rule, with its occurrence count.

## Desired behavior
- An **Issues** top-nav tab opens a dedicated page listing all problems found in the code, **one row per rule**.
- Each row shows: **Rule** (rule id badge, e.g. `qlty:similar-code`, plus a human-readable title), **Tool** (e.g. `zizmor`, `qlty`), **Category** (Vulnerability, Duplication, Structure, …), **Level** (severity, e.g. Medium), and **Occurrences** (count).
- A toolbar with a **Search** box, filter chips for **Tool**, **Category**, and **Level**, and a **Columns** control to show/hide columns.
- Each row has an **Ignore** action (dropdown) to dismiss/suppress a rule.
- Findings are sourced from the existing collectors' output (security scan, qlty duplication/structure, lint, …) and aggregated into the unified list, with accurate per-rule occurrence counts.
- Layout, columns, and affordances follow the reference screenshot saved in this task folder.

## Undesired behavior
- Must NOT crash or show a broken table when a consumer is missing a tool's output — absent inputs degrade to a clear empty/skip state (matches the collectors' soft-fail behavior).
- Must NOT break the cwd / packaging contract: board UI code stays out of the published `src/` tarball (it belongs to the board/demo surface, not `files: ["src"]`).
- Must NOT silently drop findings — every occurrence a tool reports is represented and the count is accurate.

## Context
- Reference UI: [`QualityDashboard-issues.png`](QualityDashboard-issues.png) in this task folder (screenshot of ai.mifort.com → Issues) — embedded below; see [reference-ui.md](reference-ui.md) for a written breakdown of the layout and the sample rows.
- "The board" = the QMetriX dashboard/board front-end surface, related to the demo-site (#1) and Settings page (#5) work — **not** the published Node bins.
- Likely data sources: the existing dashboard collectors (`src/dashboard/collectors/*`) and report outputs under the consumer's `dist/reports/*` (SARIF, jsinspect/qlty output, etc.).
- This is intake only; the concrete data model, routing, and what "Ignore" persists are for `/task-requirement` and `/task-design` to pin down.

## Original request
> добавь таб issues где будут добавлены все проблемы найденные в коде см картнику и сохрани её в папке задачи

## Reference screenshot
![QMetriX Issues tab — ai.mifort.com → Issues — aggregated findings table](QualityDashboard-issues.png)
