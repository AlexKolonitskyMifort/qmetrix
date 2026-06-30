# Task: Redesign quality dashboard layout to match reference design
> Task: 9-redesign-dashboard-layout | Issue: #9 https://github.com/AlexKolonitskyMifort/qmetrix/issues/9 | Date: 2026-06-30 | Type: enhancement | Priority: Normal | Found-in: 1.0.0

**Found in version:** 1.0.0

## Summary
Redesign the `qmetrix-quality-dashboard` HTML layout to match the attached reference
screenshot — a GitHub/SonarQube-style project quality "Overview" page. This is a layout
and visual-structure task: arrange the existing quality signals into the reference's
header + tab bar + two-column body (metrics & trend on the left, radial map & hotspots on
the right).

## Desired behavior
Dashboard renders the reference layout:

- **Header bar** — repo name + branch chip (`main`), right-aligned language chip
  (`TypeScript`), KLOC chip (`16 KLOC`), and a `Star` action; a `Last build <relative>`
  freshness indicator with a status dot.
- **Tab bar** — `Overview` (active) · `Issues` · `Metrics` · `Trends` · `Pulls` · `Settings`.
- **Rating cards row** (3) — Maintainability (letter grade + "N code smells"), Coverage
  (shield icon, "Not configured" when absent), Security (letter grade + "N issues").
- **Trend chart** — dual-axis line/area over a date range: Technical-debt-ratio line
  (left %-axis) + Remediation-time area (right hrs-axis), hover tooltip with date + both
  values, legend below.
- **Summary stat tiles** (4) — Technical debt ratio, Remediation time, Duplication,
  Complexity / KLOC.
- **Right sidebar** — radial/sunburst map of the file tree colored by maintainability
  grade, plus a "Maintainability hotspots" list of files with letter-grade badges (A–F).
- **Grade system** — A–F letter grades with a green→amber→red color scale, used
  consistently across cards, hotspots, and the radial map.

The full element-by-element spec captured from the screenshot is in
[reference-design.md](reference-design.md); the reference image
[`QualityDashboard-Overview.png`](QualityDashboard-Overview.png) is embedded at the end of this file.

## Undesired behavior
- Don't break the cwd / consumer-tree contract: the dashboard still reads the consumer's
  reports and writes under `dist/reports/` — this is a presentation change, not a data or
  path change.
- Don't hard-code `ai.mifort.com`, `TypeScript`, `16 KLOC`, or any reference-specific
  values; every label in the mockup is data, sourced from the consumer or defaulted/skipped
  when absent (soft-fail, per existing collector behavior).
- No new heavyweight charting dependency pulled in just for the layout — keep the
  dependency set tiny (prefer the existing render/client emission approach).
- Sections with no data degrade gracefully (e.g. Coverage → "Not configured") rather than
  rendering empty or crashing.

## Context
- Affected area: `src/dashboard/render/` (template, components, styles, client) and
  `src/quality-dashboard.mjs`; data already comes from `src/dashboard/collectors/`.
- Reference is a SonarQube / CodeClimate / CodeScene-style overview page.
- **Reference image**: the attached screenshot is saved in this task folder as
  [`QualityDashboard-Overview.png`](QualityDashboard-Overview.png) (embedded below).

## Original request
> сделай layout для dashboard как на прикрепленной картинки, картинку сохрани в папку задачи

## Reference screenshot
![Quality dashboard Overview layout — header, tab bar, rating cards, trend chart, radial map and hotspots](QualityDashboard-Overview.png)
