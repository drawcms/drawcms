import { describe, expect, it } from "vitest";
import { resolveStoryTargets } from "./active-flow";
import type { StoryTarget } from "./model";

const edges = [
  { id: "edge-ab", source: "node-a", target: "node-b" },
  { id: "edge-bc", source: "node-b", target: "node-c" },
  { id: "edge-ad", source: "node-a", target: "node-d" },
];

function nodes(...ids: string[]): StoryTarget[] {
  return ids.map((targetId) => ({ targetId, targetKind: "node" }));
}

describe("resolveStoryTargets", () => {
  it("derives direct connectors between selected step nodes", () => {
    expect(resolveStoryTargets(nodes("node-a", "node-b", "node-c"), edges)).toEqual({
      nodeIds: ["node-a", "node-b", "node-c"],
      edgeIds: ["edge-ab", "edge-bc"],
    });
  });

  it("does not guess connectors for a single selected node", () => {
    expect(resolveStoryTargets(nodes("node-a"), edges)).toEqual({
      nodeIds: ["node-a"],
      edgeIds: [],
    });
  });

  it("preserves explicit edge targets and avoids duplicates", () => {
    const targets: StoryTarget[] = [
      { targetId: "edge-ad", targetKind: "edge" },
      ...nodes("node-a", "node-b"),
      { targetId: "edge-ab", targetKind: "edge" },
    ];

    expect(resolveStoryTargets(targets, edges)).toEqual({
      nodeIds: ["node-a", "node-b"],
      edgeIds: ["edge-ad", "edge-ab"],
    });
  });

  it("stops guessing connectors once the step names one explicitly", () => {
    const targets: StoryTarget[] = [
      ...nodes("node-a", "node-b", "node-c"),
      { targetId: "edge-ab", targetKind: "edge" },
    ];

    expect(resolveStoryTargets(targets, edges)).toEqual({
      nodeIds: ["node-a", "node-b", "node-c"],
      edgeIds: ["edge-ab"],
    });
  });

  it("keeps a sequence step on its own message instead of every message between the lifelines", () => {
    // Reported against an agent-built order sequence: the "Create the order"
    // step named both lifelines, the activation bar, and message 2, and the
    // player also lit message 9 because it shares the same two endpoints.
    const sequenceEdges = [
      { id: "message-2-create-order", source: "storefront", target: "order-service" },
      { id: "message-9-order-confirmed", source: "order-service", target: "storefront" },
    ];
    const targets: StoryTarget[] = [
      ...nodes("storefront", "order-service", "order-activation"),
      { targetId: "message-2-create-order", targetKind: "edge" },
    ];

    expect(resolveStoryTargets(targets, sequenceEdges)).toEqual({
      nodeIds: ["storefront", "order-service", "order-activation"],
      edgeIds: ["message-2-create-order"],
    });
  });

  it("ignores connectors whose other endpoint is outside the step", () => {
    expect(resolveStoryTargets(nodes("node-a", "node-c"), edges)).toEqual({
      nodeIds: ["node-a", "node-c"],
      edgeIds: [],
    });
  });
});
