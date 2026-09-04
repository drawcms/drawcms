import { bench, describe } from "vitest";
import { buildStressDocument } from "./fixtures";
import { deterministicStringify } from "../document/serialize";
import { parseDocument } from "../document/schema";
import { migrateDocument } from "../document/migrate";
import { reconcileMotionTargets } from "../motion/model";

/**
 * Model-level benchmarks (DM-033). Run with `npm run bench`; they do not run
 * in `npm test` (budgets are the release gate — see budgets.test.ts). Pan /
 * zoom / drag rendering is React Flow + DOM work and is measured manually per
 * content/docs/performance.md; these numbers cover what the editor owns: document
 * load, serialization (save), and story reconciliation.
 */
const sizes = [100, 500, 1000] as const;

for (const size of sizes) {
  describe(`stress document: ${size} nodes`, () => {
    const document = buildStressDocument(size);
    const serialized = deterministicStringify(document);
    const json = JSON.parse(serialized);
    const nodeIds = new Set(document.nodes.map((node) => node.id));
    const edgeIds = new Set(document.edges.map((edge) => edge.id));

    bench("create (fixture build)", () => {
      buildStressDocument(size);
    });

    bench("deterministicStringify (save)", () => {
      deterministicStringify(document);
    });

    bench("parseDocument (load)", () => {
      parseDocument(json);
    });

    bench("migrateDocument (load, legacy path)", () => {
      migrateDocument(json);
    });

    bench(
      `reconcileMotionTargets sweep ×20 (${document.motion.story?.scenes[0].steps.length} steps)`,
      () => {
        for (let i = 0; i < 20; i++) {
          reconcileMotionTargets(document.motion, nodeIds, edgeIds);
        }
      },
    );
  });
}
