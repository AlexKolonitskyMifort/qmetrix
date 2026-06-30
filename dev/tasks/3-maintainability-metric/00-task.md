# Task: Design a maintainability metric for projects
> Task: 3-maintainability-metric | Issue: #3 https://github.com/AlexKolonitskyMifort/qmetrix/issues/3 | Date: 2026-06-30 | Type: research | Priority: Normal | Found-in: 1.0.0

**Found in version:** 1.0.0

## Summary
Design a maintainability metric for the projects QMetriX analyzes — define what
"maintainability" means as a quality signal and how it should be computed from data
QMetriX already gathers over the consumer repo (code, coverage, deps, lint, duplication,
…), so it can later surface on the quality dashboard.

## Desired behavior
- A clear, documented definition of project maintainability as a (composite) score / grade.
- Computed by reusing signals QMetriX already collects, with a transparent breakdown of the
  contributing factors so the number is explainable.
- Degrades gracefully when inputs are missing — matches the existing collectors' soft-fail
  behaviour (a consumer may lack Storybook, a security toolchain, etc.).

## Undesired behavior
- A single opaque number with no explanation of how it was derived.
- A metric that hard-requires tools a consumer may not have and crashes when they are absent.
- Reinventing inputs that existing collectors already produce instead of reusing them.

## Context
- Fits the dashboard signal model: `src/dashboard/collectors/<signal>.mjs` produces data,
  `src/dashboard/render/` consumes it via the data contract.
- Related existing signals: code, coverage, deps, lint, security, structural duplication
  (`audit-structure` / jsinspect).
- This is a research / design task — the output is a thought-through metric definition and an
  approach, not yet a shipped collector.

## Original request
> нужно продумать метрику maintainability для проектов
