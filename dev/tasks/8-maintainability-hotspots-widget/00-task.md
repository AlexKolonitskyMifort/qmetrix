# Task: Add maintainability-hotspots widget to the quality dashboard
> Task: 8-maintainability-hotspots-widget | Issue: #8 https://github.com/AlexKolonitskyMifort/qmetrix/issues/8 | Date: 2026-06-30 | Type: enhancement | Priority: Normal | Found-in: 1.0.0

**Found in version:** 1.0.0

## Summary
Add a "Maintainability hotspots" widget to the quality dashboard: a sunburst-style map of the
codebase coloured by maintainability grade, paired with a ranked list of the worst-scoring files
and their letter grades.

## Desired behavior
- A circular / sunburst visualization where each ring is a directory level and each leaf arc is a
  file; arc **colour** encodes the file's maintainability grade (grey = good → yellow → orange →
  red = worst) and arc **size** encodes a weight (e.g. LOC / file size).
- Below the chart, a **"Maintainability hotspots"** ranked list of the worst files, each with a
  letter-grade badge (A–F) and a link to the file.
- Driven by the maintainability metric/grade from #3 — reuse that signal, don't recompute it.
- Renders inside the existing dashboard pipeline: a collector produces the hierarchy + grades data,
  `render/` consumes it via the data contract; degrades gracefully (empty / skip) when the metric
  is unavailable.

## Undesired behavior
- A widget that hardcodes one consumer's file tree, paths, or layout.
- Recomputing maintainability independently of #3 instead of consuming its output.
- A crash when maintainability data is missing — must soft-fail like the other collectors.
- Pulling in a heavy charting dependency; prefer the existing render approach (inline SVG / HTML /
  CSS / client JS) over adding a fourth runtime dep.

## Context
- **Reference image** saved in the task folder as [`QualityDashboard-Hot.png`](QualityDashboard-Hot.png)
  (embedded below) — see [reference-widget.md](reference-widget.md) for a textual breakdown.
- Fits the dashboard signal model: `src/dashboard/collectors/<signal>.mjs` produces data;
  `src/dashboard/render/` emits HTML/CSS/JS.
- Depends on **#3** (maintainability metric definition) for the grade; this task is the
  visualization layer on top of it.
- The hotspot list in the reference shows files like `ScreenshotEditor.tsx`, `bundle-codebase.mjs`,
  `FloatingAssistant.tsx`, `ScreenRecorder.tsx`, `template.mjs` — all graded **F**.

## Original request
> добавь виджет "maintanability hotspot" см. картинку и сохрани её в папке задачи для референса

## Reference screenshot
![Maintainability hotspots widget — sunburst map and ranked hotspot list](QualityDashboard-Hot.png)
