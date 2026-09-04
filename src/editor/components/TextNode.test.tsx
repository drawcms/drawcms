// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnimationStateContext, NodeCallbacksContext, type NodeCallbacksType } from "../contexts";
import { TextNode, resolveTextFontFamily } from "./TextNode";

vi.mock("@xyflow/react", () => ({
  Position: { Top: "top", Left: "left", Right: "right", Bottom: "bottom" },
  Handle: () => null,
  NodeResizer: ({ onResizeStart }: { onResizeStart?: () => void }) => (
    <button type="button" onClick={onResizeStart}>
      Resize text
    </button>
  ),
}));

afterEach(cleanup);

function renderTextNode(
  data: Parameters<typeof TextNode>[0]["data"],
  callbacks: Partial<NodeCallbacksType> = {},
) {
  const value: NodeCallbacksType = {
    onLabelChange: vi.fn(),
    onUpdateRows: vi.fn(),
    onUpdateList: vi.fn(),
    onUpdateEntityAttributes: vi.fn(),
    onUpdateLanes: vi.fn(),
    onStyleChange: vi.fn(),
    ...callbacks,
  };
  return {
    callbacks: value,
    ...render(
      <NodeCallbacksContext.Provider value={value}>
        <AnimationStateContext.Provider
          value={{
            isGlobalAnimating: false,
            isPreviewingSelected: false,
            selectedNodeId: "text-1",
            activeStoryNodeIds: [],
            activeStoryEdgeIds: [],
            isStoryStepPlaying: false,
            prefersReducedMotion: false,
          }}
        >
          <TextNode id="text-1" data={data} selected />
        </AnimationStateContext.Provider>
      </NodeCallbacksContext.Provider>,
    ),
  };
}

describe("TextNode", () => {
  it("uses theme ink for default text on a transparent canvas", () => {
    renderTextNode({ label: "System boundary", type: "text" });

    const text = screen
      .getAllByText("System boundary")
      .find((element) => element.classList.contains("dm-story-text-surface"));

    expect((text as HTMLElement).style.color).toBe("var(--drawcms-ink)");
  });

  it("preserves an explicit text color on the canvas", () => {
    renderTextNode({ label: "Approved exception", type: "text", textColor: "#2563eb" });

    const text = screen
      .getAllByText("Approved exception")
      .find((element) => element.classList.contains("dm-story-text-surface"));

    expect((text as HTMLElement).style.color).toBe("rgb(37, 99, 235)");
  });

  it("edits multiline text directly on the canvas", async () => {
    const user = userEvent.setup();
    const { callbacks } = renderTextNode({ label: "System boundary", type: "text" });

    const visibleText = screen
      .getAllByText("System boundary")
      .find((element) => element.classList.contains("dm-story-text-surface"));
    expect(visibleText).toBeTruthy();
    await user.dblClick(visibleText!);
    const editor = screen.getByRole("textbox", { name: "Edit text element" });
    await user.clear(editor);
    await user.type(editor, "Trusted{Enter}boundary");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(callbacks.onLabelChange).toHaveBeenLastCalledWith("text-1", "Trusted\nboundary");
  });

  it("cancels an edit with Escape and restores the original value", () => {
    const { callbacks } = renderTextNode({
      label: "Original",
      type: "text",
      textEditOnMount: true,
    });
    const editor = screen.getByRole("textbox", { name: "Edit text element" });
    fireEvent.change(editor, { target: { value: "Draft" } });
    fireEvent.keyDown(editor, { key: "Escape" });

    expect(callbacks.onLabelChange).toHaveBeenLastCalledWith("text-1", "Original");
  });

  it("applies text styling and disables auto-fit when manually resized", async () => {
    const user = userEvent.setup();
    const { callbacks } = renderTextNode({
      label: "Console",
      type: "text",
      fontFamily: "mono",
      fontSize: 28,
      fontStyle: "italic",
      fontWeight: "700",
      textDecoration: "underline",
      textAlign: "right",
      fillColor: "#fff7ed",
    });
    const text = screen
      .getAllByText("Console")
      .find((element) => element.classList.contains("dm-story-text-surface"))!;

    expect(text.style.fontFamily).toBe(resolveTextFontFamily("mono"));
    expect(text.style.fontSize).toBe("28px");
    expect(text.style.fontStyle).toBe("italic");
    expect(text.style.textDecoration).toBe("underline");
    await user.click(screen.getByRole("button", { name: "Resize text" }));
    expect(callbacks.onStyleChange).toHaveBeenCalledWith("text-1", {
      textAutoResize: false,
    });
  });
});
