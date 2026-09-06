---
title: "Performance budgets and benchmarks"
---

DrawCMS stays responsive for real architecture work: documents of 100, 500,
and 1000 nodes are covered by deterministic fixtures, model-level benchmarks,
and hard release budgets.

## Release budgets (CI-enforced)

`src/editor/perf/budgets.test.ts` runs in `npm test` on every CI build. Budgets are
generous on purpose: they catch order-of-magnitude regressions, not jitter.

| Operation (1000 nodes unless noted)                  |  Budget | Baseline* |
| ---------------------------------------------------- | ------: | --------: |
| Fixture/document build                               | 1500 ms |   ~0.3 ms |
| `deterministicStringify` (save)                      | 1000 ms |   ~1.7 ms |
| `parseDocument` (load)                               | 1500 ms |   ~3.4 ms |
| `migrateDocument` (legacy load)                      | 2000 ms |   ~3.4 ms |
| `reconcileMotionTargets` × 100 over a 125-step story | 1000 ms |   ~0.4 ms |
| `planFrames` for 3 seconds at 30 fps                 |  500 ms |     <1 ms |

\* Baseline recorded 2026-09-05 on Apple Silicon (arm64), Node 24, vitest 4.

## Benchmarks

Recorded numbers come from vitest bench mode, which is separate from `npm test`:

```bash
npm run bench
```

Fixtures live in `src/editor/perf/fixtures.ts`
(`buildStressDocument(nodeCount)`) — deterministic via a seeded generator;
sizes 100 / 500 / 1000 nodes use 1.5× as many edges, motion on a subset of
items, and one story step for every eight nodes.

## What this does not measure

These tests do not measure React Flow rendering, pan, zoom, drag, selection,
or export encoding. Those paths need browser profiling with a representative
large `.drawcms` file; the model-level timings above cannot be used as UI
latency claims.

GIF/MP4 export capture cost scales with pixel work, so the export menu warns
when the diagram exceeds 500 nodes. Cloud MP4 export adds plan checks and
managed storage, but it still encodes frames in the browser
(`src/editor/components/topbar/ExportMenu.tsx`).
