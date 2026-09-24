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

describe("re-pointing a connector does not disturb its story step", () => {
  /**
   * The invariant behind `reconnectEdgeInSnapshot` keeping the edge id.
   *
   * Reconciliation is id-only, so a re-pointed edge is indistinguishable from an
   * untouched one. If reconnection were ever reimplemented as delete-then-create
   * with a fresh id, this test fails: the old id becomes an orphaned target,
   * gets filtered out, and any step whose only target was that connector is
   * dropped entirely — silent data loss from what the user experienced as
   * dragging an arrow onto a different box.
   */
  const motion = {
    ...createEmptyMotion(),
    story: {
      scenes: [
        {
          id: "story-scene-1",
          title: "Request path",
          steps: [
            {
              id: "step-1",
              title: "Client calls the API",
              targets: [{ targetId: "e1", targetKind: "edge" as const }],
            },
          ],
        },
      ],
      activeSceneId: "story-scene-1",
    },
  };

  it("keeps the step while the edge id is still present", () => {
    const normalized = normalizeMotion(motion, new Set(["a", "b", "c"]), new Set(["e1"]));
    expect(normalized.story?.scenes[0].steps).toHaveLength(1);
    expect(normalized.story?.scenes[0].steps[0].targets).toEqual([
      { targetId: "e1", targetKind: "edge" },
    ]);
  });

  it("loses the step if the edge id changes — the failure mode being prevented", () => {
    const normalized = normalizeMotion(
      motion,
      new Set(["a", "b", "c"]),
      new Set(["e1-regenerated"]),
    );
    expect(normalized.story?.scenes[0].steps).toHaveLength(0);
  });
});
