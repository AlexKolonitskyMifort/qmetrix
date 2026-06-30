# Reference screenshots — Metrics tab

Two screenshots of a code-quality dashboard ("ai.mifort.com") are the visual target for this
feature. Both are saved in this folder and embedded below; the descriptions capture their
content in text so the downstream pipeline (/task-requirement, /task-design) has a durable
reference even when the images aren't at hand.

---

## Screenshot 1 — [`QualityDashboard-Metrics.png`](QualityDashboard-Metrics.png) (repo root)

![Metrics tab at repo root — summary cards and per-file metrics table](QualityDashboard-Metrics.png)

Top nav tabs: **Overview · Issues · Metrics (active) · Trends · Pulls · Settings**, with a
repo header (`ai.mifort.com`, branch `main`, `TypeScript`, `16 KLOC`, ★ Star) and
"Last build 11 hours ago".

Toolbar (right): **View Issues**, **Columns**, and a view toggle **Tree (active) / List /
Unformatted Files**. Left: a breadcrumb starting at the root (file icon `/`).

Four **summary cards**:
- **Lines of Code** — `16,201`
- **Maintainability** — grade **B**, `92 smells (1 month)`
- **Duplication** — `3.7% (33 duplicates)`
- **Code Coverage** — `Setup instructions` (link shown when coverage is not configured)

**Table** with columns: **TYPE · FILE · LOC · ISSUES · MAINTAINABILITY · COMPLEXITY ·
DUPLICATION · COVERAGE**. Rows are folders/files of the repo root, e.g.:
- `.agents`, `.claude` (folders, no metrics shown)
- `.config` — LOC 289, Issues 0, Maintainability **A** (0 mins), Complexity 10, Dup 0.0%
- `.github` — LOC 0, Issues 4, Maintainability **A** (0 mins), Complexity 0, Dup 0.0%
- `.husky`, `content`, `dev`, `public` (folders)
- `src` — LOC 12,940, Issues 69, Maintainability **B** (3 wks), Complexity 1,269, Dup 4.7%
- `supabase` (folder), `.env.example` (file)

Maintainability is shown as a colored letter grade chip (A green … F red) plus an estimated
time-to-fix ("0 mins", "3 wks").

## Screenshot 2 — [`QualityDashboard-Metrics-02.png`](QualityDashboard-Metrics-02.png) (drilled into `src/features`)

![Metrics tab drilled into src/features — breadcrumb and scoped summary cards](QualityDashboard-Metrics-02.png)

Same chrome, but the breadcrumb now reads **`/ src / features`** — demonstrating folder
drill-down. A `..` row navigates back up.

Three **summary cards** (scoped to `src/features`):
- **Lines of Code** — `2,236`
- **Maintainability** — grade **D**, `23 smells (2 weeks)`
- **Duplication** — `1.9% (3 duplicates)`

**Table** rows (children of `src/features`):
- `..` (up), `agents`, `aicore`, `analytics` (folders, no metrics)
- `assistant` — LOC 602, Issues 3, Maintainability **D** (3 days), Complexity 114, Dup 0.0%
- `cookie-consent` — LOC 80, Issues 0, Maintainability **A** (0 mins), Complexity 5, Dup 0.0%
- `report-issue` — LOC 1,554, Issues 20, Maintainability **F** (1 wk), Complexity 316, Dup 2.8%

---

## What to take from these for the build
- A **breadcrumb + clickable tree** over the consumer's source layout, with summary cards
  recomputed per level.
- Per-row columns: **LOC, Issues, Maintainability (grade + time-to-fix), Complexity,
  Duplication, Coverage**.
- The request emphasizes **coverage** and **all bugs/issues found** per file — these map to
  the Coverage and Issues columns and likely a per-file issue drill-down ("View Issues").
- Graceful degradation: when a signal is absent (e.g. coverage), show a setup affordance
  rather than an error — matches QMetriX's soft-fail collector behaviour.
