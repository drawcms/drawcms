import { describe, expect, it } from "vitest";
import { buildStressDocument } from "./fixtures";
import { deterministicStringify } from "../document/serialize";
import { parseDocument } from "../document/schema";
import { migrateDocument } from "../document/migrate";
import { reconcileMotionTargets } from "../motion/model";
import { planFrames } from "../motion/schedule";

/**
 * Performance budgets (DM-033). These assert the model-level hot paths stay
 * within generous, CI-stable limits — they catch order-of-magnitude
 * regressions, not micro-jitter. Record fine-grained numbers with
 * `npm run bench` (see content/docs/performance.md); keep these limits as the
 * release gate.
 *
 * Baseline hardware: Apple Silicon (arm64), Node 24, 2026-08.
 */
const BUDGET_MS = {
  build1000: 1500,
  serialize1000: 1000,
  parse1000: 1500,
  migrate1000: 2000,
  reconcileSweep1000: 1000, // 100 reconciliations across a 125-step story
  planFrames1000: 500,
} as const;

function timed(label: string, budgetMs: number, work: () => void): number {
  work(); // warmup: settle JIT + allocations before measuring
  const start = performance.now();
  work();
  const elapsed = performance.now() - start;
  expect(
    elapsed,
    `${label} exceeded budget ${budgetMs}ms (took ${elapsed.toFixed(1)}ms)`,
  ).toBeLessThan(budgetMs);
  return elapsed;
}

describe("performance budgets (DM-033)", () => {
  it("covers the release budgets at 100/500/1000 nodes", () => {
    for (const size of [100, 500, 1000]) {
      const document = buildStressDocument(size);
      expect(document.nodes).toHaveLength(size);
      expect(document.edges).toHaveLength(Math.floor(size * 1.5));
      expect(document.motion.story?.scenes[0].steps.length).toBeGreaterThan(0);
    }
  });

  it("builds a 1000-node document within budget", () => {
    timed("buildStressDocument(1000)", BUDGET_MS.build1000, () => {
      buildStressDocument(1000);
    });
  });

  it("serializes a 1000-node document deterministically within budget", () => {
    const document = buildStressDocument(1000);
    timed("deterministicStringify(1000)", BUDGET_MS.serialize1000, () => {
      deterministicStringify(document);
    });
  });

  it("parses a 1000-node document within budget", () => {
    const document = buildStressDocument(1000);
    const json = JSON.parse(deterministicStringify(document));
    timed("parseDocument(1000)", BUDGET_MS.parse1000, () => {
      parseDocument(json);
    });
  });

  it("migrates a 1000-node document within budget", () => {
    const document = buildStressDocument(1000);
    const json = JSON.parse(deterministicStringify(document));
    timed("migrateDocument(1000)", BUDGET_MS.migrate1000, () => {
      migrateDocument(json);
    });
  });

  it("reconciles story targets across a dense document within budget", () => {
    const document = buildStressDocument(1000);
    const nodeIds = new Set(document.nodes.map((node) => node.id));
    const edgeIds = new Set(document.edges.map((edge) => edge.id));
    timed("reconcileMotionTargets × 100 (1000 nodes)", BUDGET_MS.reconcileSweep1000, () => {
      for (let i = 0; i < 100; i++) {
        reconcileMotionTargets(document.motion, nodeIds, edgeIds);
      }
    });
  });

  it("plans export frames for a dense scene within budget", () => {
    timed("planFrames(1000 nodes)", BUDGET_MS.planFrames1000, () => {
      planFrames(3, 30);
    });
  });
});
