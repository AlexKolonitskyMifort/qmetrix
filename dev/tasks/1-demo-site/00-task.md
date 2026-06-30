# Task: Add runnable demo site showcasing QMetriX capabilities
> Task: 1-demo-site | Issue: #1 https://github.com/AlexKolonitskyMifort/qmetrix/issues/1 | Date: 2026-06-30 | Type: enhancement | Priority: Normal | Found-in: 1.0.0

**Found in version:** 1.0.0

## Summary
QMetriX produces rich quality artifacts (quality dashboard, codebase bundle, coverage reports, structural-duplication audit, security scan) but there is no way to see them without installing the package into a host repo. Add a runnable demo site that showcases what each bin produces.

## Desired behavior
- A self-contained, runnable demo (e.g. `npm run demo` or a `demo/` workspace) that runs the QMetriX bins against a small sample/fixture project and serves the generated artifacts.
- A visitor can see real sample output: the quality dashboard HTML, the single-file codebase bundle, and representative coverage / audit / security reports.
- Publishable as a static site (e.g. GitHub Pages) so the capabilities are visible without cloning or installing.
- Stays out of the published npm tarball — lives under `dev/` or a separate workspace, never in the `files: ["src"]` allowlist.

## Undesired behavior
- Must NOT bloat the published package or add runtime dependencies to `src/`.
- Must NOT require secret/credentialed services; the demo runs offline against committed fixtures.
- Must NOT break the cwd contract — bins still anchor the project root on `process.cwd()`.

## Context
- Relevant bins: `qmetrix-quality-dashboard`, `qmetrix-bundle-codebase`, the coverage suite, `qmetrix-audit-structure`, `qmetrix-security-scan`.
- The dashboard reads `dist/reports/*` and (for a full dashboard) expects a built Storybook — the demo fixture must provide enough of these inputs.
- Synergistic with dogfooding QMetriX on its own repo (see the related task on collecting its own metrics) — that run can supply real sample output for the demo.

## Original request
> нужно добавить запускаемый сайт для демонстрации возможностей пакета
