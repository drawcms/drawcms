// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AnimationStateContext, type AnimationStateType } from "../../contexts";
import { ContainerNode } from "./ContainerNode";
import { EntityNode } from "./EntityNode";
import { SwimlaneNode } from "./SwimlaneNode";
import { TableNode } from "./TableNode";
import { UmlClassNode } from "./UmlClassNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  NodeResizer: () => null,
  Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
}));

vi.mock("gsap", () => ({
  default: {
    killTweensOf: vi.fn(),
    set: vi.fn(),
    to: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const activeAnimationState: AnimationStateType = {
  isGlobalAnimating: false,
  isPreviewingSelected: false,
  selectedNodeId: null,
  activeStoryNodeIds: ["active-node"],
  activeStoryEdgeIds: [],
  isStoryStepPlaying: false,
  prefersReducedMotion: false,
};

function renderActiveNode(testId: string, node: ReactNode) {
  render(
    <AnimationStateContext.Provider value={activeAnimationState}>
      <div data-testid={testId}>{node}</div>
    </AnimationStateContext.Provider>,
  );
  return screen.getByTestId(testId).querySelector<HTMLElement>("[data-story-active='true']");
}

describe("structured node presentation highlight", () => {
  it.each([
    [
      "table",
      <TableNode
        key="table"
        id="active-node"
        selected={false}
        data={{ label: "Table", rows: [{ id: "row", name: "id", type: "uuid" }] }}
      />,
    ],
    [
      "uml-class",
      <UmlClassNode
        key="uml-class"
        id="active-node"
        selected={false}
        data={{ label: "Class", attributes: [], methods: [] }}
      />,
    ],
    [
      "entity",
      <EntityNode
        key="entity"
        id="active-node"
        selected={false}
        data={{ label: "Entity", entityAttributes: [] }}
      />,
    ],
    [
      "container",
      <ContainerNode
        key="container"
        id="active-node"
        selected={false}
        data={{ label: "Group", type: "group" } as never}
      />,
    ],
    [
      "swimlane",
      <SwimlaneNode
        key="swimlane"
        id="active-node"
        selected={false}
        data={{ label: "Pool", type: "bpmn-pool" }}
      />,
    ],
  ])("uses its own visible surface for the %s highlight", (testId, node) => {
    const surface = renderActiveNode(testId, node);

    expect(surface).not.toBeNull();
    expect(surface?.style.borderColor).toBe("rgb(12, 140, 94)");
    expect(surface?.style.backgroundColor).toBe("rgb(236, 248, 242)");
  });
});
