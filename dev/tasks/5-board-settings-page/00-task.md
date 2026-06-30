# Task: Add a Settings page to the board UI
> Task: 5-board-settings-page | Issue: #5 https://github.com/AlexKolonitskyMifort/qmetrix/issues/5 | Date: 2026-06-30 | Type: enhancement | Priority: Normal | Found-in: 1.0.0

**Found in version:** 1.0.0

## Summary
Add a Settings page to the board UI, modeled on the reference screenshot (the ai.mifort.com Settings view). The page has a left sub-navigation grouped into Project / Quality Configs / More, with per-section configuration panels — the first being Code Coverage setup.

## Desired behavior
- A **Settings** top-nav tab opens a dedicated Settings page with a left sidebar grouped into sections:
  - **PROJECT**: General, Features, Components
  - **QUALITY CONFIGS**: Code Coverage, Review Config, Analysis Config, Ignore Rules
  - **MORE**: Badges
- The **Code Coverage** panel (default/active) shows a "CODE COVERAGE SETUP" card with:
  - **Coverage Token** — read-only token field + copy-to-clipboard button; subtitle "Results for the default branch are displayed".
  - **Setup Instructions** — row linking to "View setup instructions".
  - **Regenerate Token** — row with a "Regenerate" action; subtitle "Invalidate the current token and create a new one".
- Below the card, a **Coverage Reports** section with a Reports/Uploads toggle, a search box, a Columns control, a table (COMMIT, REF, TIME, TOTAL UPLOADS), and an empty state ("No coverage reports").
- Layout, grouping, and affordances follow the reference screenshot saved in this task folder.

## Undesired behavior
- Must NOT leak any real secret/token — the token shown is a sample/placeholder; never commit a live coverage token.
- Must NOT break the cwd / packaging contract: UI code stays out of the published `src/` tarball (it belongs to the board/demo surface, not `files: ["src"]`).
- Sidebar items beyond Code Coverage (Review Config, Analysis Config, etc.) need not be fully built here — but navigation must not dead-end silently; a stub / "coming soon" is acceptable, a crash is not.

## Context
- Reference UI: [`QualityDashboard-Settings.png`](QualityDashboard-Settings.png) in this task folder (screenshot of ai.mifort.com → Settings → Code Coverage) — embedded below; see also [reference-ui.md](reference-ui.md) for a written breakdown.
- Scope of "the board" = the QMetriX dashboard/board front-end surface, related to the demo-site work (#1) — not the published Node bins.
- This is intake only; the concrete page location, framework, and routing are for `/task-requirement` and `/task-design` to pin down.

## Original request
> нужно добавить страницу настроек для нашего борда как на картинке (картинку сохранить в папку задачи

## Reference screenshot
![QMetriX Settings page — ai.mifort.com → Settings → Code Coverage](QualityDashboard-Settings.png)
