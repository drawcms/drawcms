---
title: "Performance budgets and benchmarks (DM-033)"
---

DrawCMS stays responsive for real architecture work: documents of 100, 500,
and 1000 nodes are covered by deterministic fixtures, model-level benchmarks,
and hard release budgets.

## Release budgets (CI-enforced)

`src/editor/perf/budgets.test.ts` runs in `npm test` on every CI build. Budgets are
generous on purpose: they catch order-of-magnitude regressions, not jitter.

| Operation (1000 nodes unless noted)                                  |  Budget | Baseline* |
| -------------------------------------------------------------------- | ------: | --------: |
| Fixture/document build                                               | 1500 ms |   ~0.3 ms |
| `deterministicStringify` (save)                                      | 1000 ms |   ~1.7 ms |
| `parseDocument` (load)                                               | 1500 ms |   ~3.9 ms |
| `migrateDocument` (legacy load)                                      | 2000 ms |   ~3.9 ms |
| `stateAt` × 100 seeks over a 250-track scene (playback/export clock) | 1000 ms |     ~5 ms |
| `planFrames` at 30 fps for the scene duration                        |  500 ms |     <1 ms |

\* Baseline recorded 2026-08-11 on Apple Silicon (arm64), Node 24, vitest 4.

## Benchmarks

Recorded numbers come from vitest bench mode, which is separate from `npm test`:

```bash
npm run bench
```

Fixtures live in `src/editor/perf/fixtures.ts`
(`buildStressDocument(nodeCount)`) — deterministic via a seeded generator;
sizes 100 / 500 / 1000 nodes with 1.5× edges and dense motion scenes
(250+ tracks, 2 steps each plus connector-flow tracks).

## What this does not measure

Pan/zoom/drag/selection rendering is React Flow + DOM work and is verified
manually against the same fixtures at each release: open a stress document in
the editor (`File → Open` a generated file or the guided template) and pan,
zoom, drag a node, marquee-select, preview one preset, and toggle Animate. Any
interaction that does not feel immediate on the baseline hardware blocks the
release.

GIF/MP4 export capture cost scales with pixel work, so the export menu warns
when the diagram exceeds 500 nodes and suggests the managed cloud render path
(`src/editor/components/topbar/ExportMenu.tsx`).
