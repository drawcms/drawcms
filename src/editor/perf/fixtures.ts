import { createDocument } from "../document/serialize";
import type { DrawCMSDocument } from "../document/schema";
import type { MotionState } from "../motion/model";

/**
 * Deterministic stress fixtures (DM-033). No randomness: a tiny LCG keeps
 * layouts/story targets stable so benchmarks and budget assertions compare
 * across machines and CI runs.
 */
function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

const GRID = 24; // columns in the layout grid

export function buildStressDocument(nodeCount: number): DrawCMSDocument {
  const random = lcg(0xd1a6a);
  const shapeTypes = ["rect", "round-rect", "circle", "diamond", "table", "uml-class"];
  const presets = ["Bounce", "Pulse Node", "Shake"] as const;

  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: `node-${index}`,
    type: "shape",
    position: {
      x: (index % GRID) * 180 + Math.floor(random() * 20),
      y: Math.floor(index / GRID) * 140 + Math.floor(random() * 20),
    },
    data: {
      label: `Node ${index}: service / module ${index % 17}`,
      type: shapeTypes[Math.floor(random() * shapeTypes.length)],
      fillColor: "#ffffff",
      strokeColor: "#4b5563",
      // Every fourth node carries a legacy element preset (the animation
      // model actually played back — see content/docs/decisions/003-single-motion-model.md).
      ...(index % 4 === 0 ? { preset: presets[index % presets.length], motionSpeed: 0.5 } : {}),
    },
  }));

  const edgeCount = Math.floor(nodeCount * 1.5);
  const edges = Array.from({ length: edgeCount }, (_, index) => ({
    id: `edge-${index}`,
    source: `node-${index % nodeCount}`,
    target: `node-${(index * 7 + 13) % nodeCount}`,
    label: `flow ${index}`,
    data: index % 8 === 0 ? { preset: "Data Flow" as const, motionLoop: true } : undefined,
  }));

  // One narrative step per eighth node, each holding one node and its
  // outgoing edge — enough scale to exercise story sanitization/reconciliation.
  const stepCount = Math.max(1, Math.floor(nodeCount / 8));
  const motion: MotionState = {
    story: {
      activeSceneId: "scene-1",
      scenes: [
        {
          id: "scene-1",
          title: "Stress scene",
          steps: Array.from({ length: stepCount }, (_, index) => ({
            id: `step-${index}`,
            title: `Step ${index + 1}`,
            description: `Narrative beat ${index + 1} of the stress fixture.`,
            targets: [
              { targetId: `node-${index * 8}`, targetKind: "node" as const },
              { targetId: `edge-${index * 8}`, targetKind: "edge" as const },
            ],
          })),
        },
      ],
    },
  };

  return createDocument({
    meta: { name: `Stress ${nodeCount}` },
    nodes: nodes as never,
    edges: edges as never,
    motion,
  });
}
