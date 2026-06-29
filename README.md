# QMetriX

> `@mifort-solutions/qmetrix` — build & quality tooling, extracted from `ai.mifort.com`'s `dev/scripts/`.

QMetriX is a set of plain-ESM Node scripts that compute quality signals over a
**consuming repository**: coverage merge & reporting, a quality dashboard, an image
budget check / optimizer, a structural-duplication audit, a security scan, an
e2e-server guard, and a single-file codebase bundler.

It is **dev tooling, not a library** — you install it as a `devDependency` and invoke its
`bin` executables from your project's `package.json` scripts. The scripts read and write
the **consuming repo's** tree (`src/`, `content/`, `public/`, `dist/reports/*`,
`package.json`, `node_modules`, git history).

## The cwd contract (important)

Every QMetriX bin anchors the project root on **`process.cwd()`** — i.e. the directory the
verb runs from. **Run every bin from your repository root** (which is what `npm run …` does
by default). Running a bin from a subdirectory will make its `src/`, `dist/`, `package.json`
reads target the wrong tree.

## Requirements

- **Node `22.x`** (closed range — the package's `engines` pins the same major as the host app).
- A few bins shell out to system tools that are not npm dependencies:
  `qmetrix-security-scan` uses `curl` / `tar` / the CodeQL CLI; `qmetrix-quality-dashboard`
  expects a built Storybook under `dist/site/storybook` when run for a full dashboard.

## Install

```bash
npm install --save-dev @mifort-solutions/qmetrix
```

## Bins

| Bin | What it does |
| --- | --- |
| `qmetrix-check-images` | Fail the build when committed images exceed the byte/pixel budget (`sharp`). |
| `qmetrix-optimize-images` | Resize / re-encode committed assets (`sharp`). |
| `qmetrix-audit-structure` | Structural (AST-shape) copy-paste audit via `jsinspect-plus` → `dist/reports/jsinspect.json`. Advisory (exits 0). |
| `qmetrix-security-scan` | Local SAST/SCA (Snyk + CodeQL) → SARIF under `dist/reports/`. |
| `qmetrix-quality-dashboard` | Build the quality dashboard HTML from `dist/reports/*` + the repo tree. |
| `qmetrix-bundle-codebase` | Bundle the codebase into one self-contained HTML file. |
| `qmetrix-e2e-server-guard` | Guard the e2e port against a stale `next start` / poisoned prerender cache. |
| `qmetrix-coverage-clean` | Clean per-suite / global coverage scratch under `dist/reports/coverage`. |
| `qmetrix-coverage-report-suite` | Build a per-suite coverage report from raw V8 / istanbul data. |
| `qmetrix-coverage-report-global` | Merge per-suite coverage into a global line-union `lcov.info`. |
| `qmetrix-coverage-next-start` | Start Next.js in-process with V8 coverage enabled (used by Playwright). |

Arguments pass through verbatim, e.g.:

```bash
qmetrix-coverage-clean e2e
qmetrix-e2e-server-guard --pre-build
qmetrix-coverage-report-suite storybook
qmetrix-quality-dashboard --no-coverage
qmetrix-optimize-images public/images --format webp
```

## Example wiring (`package.json`)

```jsonc
{
  "scripts": {
    "images:check": "qmetrix-check-images",
    "audit:structure": "qmetrix-audit-structure",
    "coverage:global": "qmetrix-coverage-clean global && qmetrix-coverage-report-global"
  }
}
```

## License

MIT.
