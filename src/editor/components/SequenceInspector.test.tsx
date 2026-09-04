// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StoryState } from "../story/model";
import { SequenceInspector } from "./SequenceInspector";

afterEach(cleanup);

const story: StoryState = {
  activeSceneId: "scene-1",
  scenes: [
    {
      id: "scene-1",
      title: "Request flow",
      description: "How a request reaches the API.",
      steps: [
        {
          id: "step-1",
          title: "Validate request",
          description: "The API validates the incoming payload.",
          targets: [{ targetId: "node-1", targetKind: "node" }],
        },
        {
          id: "step-2",
          title: "Forward request",
          targets: [{ targetId: "edge-1", targetKind: "edge" }],
        },
      ],
    },
  ],
};

const baseProps = {
  story,
  knownNodes: [{ id: "node-1", label: "API" }],
  knownEdges: [{ id: "edge-1", label: "Request" }],
  selectedTargets: [
    { targetId: "node-1", targetKind: "node" as const },
    { targetId: "edge-1", targetKind: "edge" as const },
  ],
  onChange: () => {},
  onCreateStep: () => {},
  onEditStep: () => {},
  onPreview: () => {},
  onClose: () => {},
};

describe("SequenceInspector", () => {
  it("describes story steps separately from motion", () => {
    render(<SequenceInspector {...baseProps} />);

    expect(screen.getByRole("heading", { name: "Steps" })).toBeTruthy();
    expect(screen.getByText("Arrange the story. Motion stays on each item.")).toBeTruthy();
    expect(screen.queryByText(/Choose what it does/i)).toBeNull();
    expect(screen.queryByText(/Add to animation/i)).toBeNull();
  });

  it("creates a step from all selected canvas items", async () => {
    const user = userEvent.setup();
    const onCreateStep = vi.fn();
    render(<SequenceInspector {...baseProps} onCreateStep={onCreateStep} />);

    await user.click(screen.getByRole("button", { name: "Add 2 selected items" }));
    expect(onCreateStep).toHaveBeenCalledWith(baseProps.selectedTargets);
  });

  it("opens the presentation preview from the steps panel", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    render(<SequenceInspector {...baseProps} onPreview={onPreview} />);

    await user.click(screen.getByRole("button", { name: "Preview" }));
    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it("moves steps using explicit order controls", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SequenceInspector {...baseProps} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Move Forward request earlier" }));
    expect(
      onChange.mock.calls[0][0].scenes[0].steps.map((step: { id: string }) => step.id),
    ).toEqual(["step-2", "step-1"]);
  });

  it("keeps scene title and description editable", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SequenceInspector {...baseProps} onChange={onChange} />);

    const title = screen.getByLabelText("Scene title");
    await user.clear(title);
    await user.type(title, "Checkout flow");
    await user.tab();

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        scenes: [expect.objectContaining({ title: "Checkout flow" })],
      }),
    );
  });
});
