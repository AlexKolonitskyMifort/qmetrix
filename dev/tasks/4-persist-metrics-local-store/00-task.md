# Task: Persist project metrics to a local store over time
> Task: 4-persist-metrics-local-store | Issue: #4 https://github.com/AlexKolonitskyMifort/qmetrix/issues/4 | Date: 2026-06-30 | Type: research | Priority: Normal | Found-in: 1.0.0

**Found in version:** 1.0.0

## Summary
QMetriX produces point-in-time quality signals but does not persist them, so a project has no history or trend of its metrics over time. This task is to decide how to store project metrics in a **local** database and stand up that persistence: which store, which metrics, and the write strategy.

## Desired behavior
- Metrics produced by the `qmetrix-*` bins can be saved to a **local** store so a project accumulates a metrics history (point-in-time → time series).
- A decision is reached and documented on: **which store** (e.g. SQLite / `node:sqlite`, JSON/NDJSON append, another small embedded option), **which metrics** are persisted (coverage, structural duplication, security findings, codebase size, …), and **how/when** records are written (per run, keyed by commit/date/branch).
- The store lives under the consumer's tree (consistent with the existing `dist/reports/` output contract) and degrades cleanly when a given metric is absent.

## Undesired behavior
- Must NOT add a heavy runtime dependency or a database server; "local" means embedded/file-based, in keeping with the tiny-dependency rule (§6).
- Must NOT break the cwd contract — the store is anchored on the consumer's `process.cwd()`, not on the package install location.
- Must NOT leak the store or new tooling into the published tarball (`files: ["src"]` stays clean).
- A missing or skipped metric must NOT hard-fail the run.

## Context
- This is a **research** task: the primary deliverable is the decision among local-store options, the metric set, and the write strategy — implementation follows as a separate enhancement.
- Related to #2 (dogfood-self-metrics): that task runs the bins to produce reports; this task is about *keeping* those metrics over time. The self-metrics output is a natural first producer of records to persist.
- Open questions to resolve: SQLite (a dep vs. Node 22's experimental `node:sqlite`) vs. flat JSON/NDJSON vs. another embedded option; schema/keying (commit SHA, timestamp, branch); the read/query path (does the quality dashboard consume the history?).

## Original request
> нужно добавить сохранение метрик проекта в локальную базу, нужно решить что будет за база / какие метрика / как сохранять
