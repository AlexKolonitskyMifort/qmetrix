# Task: Dogfood QMetriX on its own repo to collect its own metrics
> Task: 2-dogfood-self-metrics | Issue: #2 https://github.com/AlexKolonitskyMifort/qmetrix/issues/2 | Date: 2026-06-30 | Type: chore | Priority: Normal | Found-in: 1.0.0

**Found in version:** 1.0.0

## Summary
QMetriX measures other repos but does not measure itself. Wire its own bins into this repo so QMetriX computes its own quality metrics (coverage, structural duplication, security, codebase bundle, dashboard) — both to validate the tooling end-to-end and to publish credible self-metrics.

## Desired behavior
- `package.json` scripts (and ideally CI) invoke the `qmetrix-*` bins against this repo to produce `dist/reports/*` and a quality dashboard for QMetriX itself.
- The run works on a plain-ESM, build-less package: metrics that don't apply (e.g. Storybook, framework routing) degrade cleanly to skipped/empty rather than failing.
- Output is reproducible locally (e.g. `npm run metrics`) and, where it makes sense, runs in CI.
- Self-dogfooding surfaces any cwd-contract or consumer-assumption bugs in the bins when the "consumer" is QMetriX itself.

## Undesired behavior
- Must NOT add the metrics tooling or its outputs to the published tarball (`files: ["src"]` stays clean; reports under `dist/reports/` are git-ignored).
- Must NOT introduce new runtime dependencies into `src/` just to measure the repo.
- A metric a build-less ESM package legitimately lacks must NOT hard-fail the run.

## Context
- QMetriX has no tests, no coverage, and no Storybook today — several collectors (coverage, lint, storybook, routing) may have nothing to read. Part of this task is deciding which metrics are meaningful for the package itself.
- Bins: `qmetrix-audit-structure`, `qmetrix-bundle-codebase`, `qmetrix-security-scan`, `qmetrix-quality-dashboard`, the coverage suite, `qmetrix-check-images`.
- Feeds the demo-site task (#1): real self-metrics output is exactly what the showcase needs.

## Original request
> нужно этим же пакетом собрать его же метрики
