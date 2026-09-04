import { describe, expect, it } from "vitest";
import { createEmptyStory } from "./model";
import {
  addStoryScene,
  addStoryStep,
  moveStoryStep,
  removeStoryScene,
  updateStoryStep,
} from "./ops";

describe("story operations", () => {
  it("creates one information step for multiple selected targets", () => {
    const story = createEmptyStory();
    const next = addStoryStep(story, story.scenes[0].id, {
      title: "Request enters the system",
      description: "The client and connector belong to one explanation step.",
      targets: [
        { targetId: "client", targetKind: "node" },
        { targetId: "request", targetKind: "edge" },
      ],
    });

    expect(next.scenes[0].steps).toHaveLength(1);
    expect(next.scenes[0].steps[0]).toMatchObject({
      title: "Request enters the system",
      targets: [
        { targetId: "client", targetKind: "node" },
        { targetId: "request", targetKind: "edge" },
      ],
    });
  });

  it("reorders steps without changing motion timing", () => {
    const empty = createEmptyStory();
    const first = addStoryStep(empty, empty.scenes[0].id, {
      title: "First",
      targets: [{ targetId: "a", targetKind: "node" }],
    });
    const second = addStoryStep(first, first.scenes[0].id, {
      title: "Second",
      targets: [{ targetId: "b", targetKind: "node" }],
    });
    const secondId = second.scenes[0].steps[1].id;

    const moved = moveStoryStep(second, second.scenes[0].id, secondId, -1);
    expect(moved.scenes[0].steps.map((step) => step.title)).toEqual(["Second", "First"]);
  });

  it("updates copy while preserving selected targets", () => {
    const story = createEmptyStory();
    const withStep = addStoryStep(story, story.scenes[0].id, {
      title: "Draft",
      targets: [{ targetId: "a", targetKind: "node" }],
    });
    const step = withStep.scenes[0].steps[0];
    const next = updateStoryStep(withStep, withStep.scenes[0].id, step.id, {
      title: "Final title",
      description: "Viewer-facing explanation.",
      targets: step.targets,
    });

    expect(next.scenes[0].steps[0]).toMatchObject({
      title: "Final title",
      description: "Viewer-facing explanation.",
      targets: step.targets,
    });
  });

  it("keeps at least one scene", () => {
    const story = createEmptyStory();
    expect(removeStoryScene(story, story.scenes[0].id)).toEqual(story);
    expect(addStoryScene(story).scenes).toHaveLength(2);
  });
});
