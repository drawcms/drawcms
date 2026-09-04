import { describe, expect, it } from "vitest";
import { normalizeMotion } from "./ops";
import { createEmptyMotion } from "./model";

describe("normalizeMotion", () => {
  it("drops story targets that no longer exist on the graph", () => {
    const motion = {
      ...createEmptyMotion(),
      story: {
        scenes: [
          {
            id: "story-scene-1",
            title: "Scene 1",
            steps: [
              {
                id: "step-1",
                title: "Step 1",
                targets: [
                  { targetId: "live-node", targetKind: "node" as const },
                  { targetId: "deleted-node", targetKind: "node" as const },
                ],
              },
            ],
          },
        ],
        activeSceneId: "story-scene-1",
      },
    };

    const normalized = normalizeMotion(motion, new Set(["live-node"]), new Set());
    expect(normalized.story?.scenes[0].steps[0].targets).toEqual([
      { targetId: "live-node", targetKind: "node" },
    ]);
  });

  it("leaves already-valid motion untouched", () => {
    const motion = createEmptyMotion();
    expect(normalizeMotion(motion, new Set(), new Set())).toEqual(motion);
  });
});
