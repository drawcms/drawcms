// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { DEFAULT_MAX_ZOOM, DEFAULT_MIN_ZOOM, DiagramCanvas } from "./DiagramCanvas";
import { installReactFlowJsdomShims } from "../test/react-flow-jsdom";

beforeAll(() => {
  installReactFlowJsdomShims();
});

afterEach(cleanup);

describe("DiagramCanvas icon nodes", () => {
  it("renders self-contained icon artwork without a visible label", () => {
    render(
      <ReactFlowProvider>
        <DiagramCanvas
          nodes={[
            {
              id: "icon-1",
              position: { x: 0, y: 0 },
              data: {
                label: "home",
                type: "icon",
                iconName: "lucide:home",
                iconBody: '<path d="M3 9l9-7 9 7"/>',
                iconViewBox: "0 0 24 24",
              },
              type: "customShape",
            },
          ]}
          edges={[]}
          onNodesChange={() => {}}
          onEdgesChange={() => {}}
          onConnect={() => {}}
          setSelectedNodeId={() => {}}
          setSelectedEdgeId={() => {}}
        />
      </ReactFlowProvider>,
    );

    const artwork = document.querySelector('svg[viewBox="0 0 24 24"]');
    expect(artwork).toBeTruthy();
    expect(artwork?.querySelector("path")).toBeTruthy();
    expect(screen.queryByText("home")).toBeNull();
  });

  it("uses theme ink for the default label beneath an actor", () => {
    render(
      <ReactFlowProvider>
        <DiagramCanvas
          nodes={[
            {
              id: "actor-1",
              position: { x: 0, y: 0 },
              data: { label: "Browser", type: "actor" },
              type: "customShape",
            },
          ]}
          edges={[]}
          onNodesChange={() => {}}
          onEdgesChange={() => {}}
          onConnect={() => {}}
          setSelectedNodeId={() => {}}
          setSelectedEdgeId={() => {}}
        />
      </ReactFlowProvider>,
    );

    const label = screen.getByText("Browser");
    expect((label as HTMLElement).style.color).toBe("var(--drawcms-ink)");
  });
});

describe("creating elements from the canvas", () => {
  /** React Flow captures its instance in `onInit`, one tick after render. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  const renderCanvas = (onAddNode: (...args: unknown[]) => void, readOnly = false) =>
    render(
      <ReactFlowProvider>
        <DiagramCanvas
          nodes={[]}
          edges={[]}
          onNodesChange={() => {}}
          onEdgesChange={() => {}}
          onConnect={() => {}}
          setSelectedNodeId={() => {}}
          setSelectedEdgeId={() => {}}
          onAddNode={onAddNode as never}
          readOnly={readOnly}
        />
      </ReactFlowProvider>,
    );

  it("starts a text element where empty canvas is double-clicked", async () => {
    const onAddNode = vi.fn();
    renderCanvas(onAddNode);
    await settle();

    const pane = document.querySelector(".react-flow__pane") as HTMLElement;
    fireEvent.doubleClick(pane, { clientX: 240, clientY: 160, bubbles: true });

    expect(onAddNode).toHaveBeenCalledTimes(1);
    const [type, label, position] = onAddNode.mock.calls[0];
    expect(type).toBe("text");
    // Empty label so the editor opens on a blank line rather than placeholder text.
    expect(label).toBe("");
    expect(position).toBeDefined();
  });

  it("leaves double-clicks on a node to that node's own editor", () => {
    const onAddNode = vi.fn();
    render(
      <ReactFlowProvider>
        <DiagramCanvas
          nodes={[
            {
              id: "n1",
              position: { x: 0, y: 0 },
              data: { label: "Step", type: "rect" },
              type: "customShape",
            },
          ]}
          edges={[]}
          onNodesChange={() => {}}
          onEdgesChange={() => {}}
          onConnect={() => {}}
          setSelectedNodeId={() => {}}
          setSelectedEdgeId={() => {}}
          onAddNode={onAddNode as never}
        />
      </ReactFlowProvider>,
    );

    fireEvent.doubleClick(screen.getByText("Step"), { bubbles: true });
    expect(onAddNode).not.toHaveBeenCalled();
  });

  it("does not create anything on a read-only canvas", async () => {
    const onAddNode = vi.fn();
    renderCanvas(onAddNode, true);
    await settle();

    const pane = document.querySelector(".react-flow__pane") as HTMLElement;
    fireEvent.doubleClick(pane, { clientX: 40, clientY: 40, bubbles: true });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }));

    expect(onAddNode).not.toHaveBeenCalled();
  });

  it("ignores the insert shortcut until the pointer has been over the pane", async () => {
    const onAddNode = vi.fn();
    renderCanvas(onAddNode);
    await settle();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }));
    expect(onAddNode).not.toHaveBeenCalled();

    const pane = document.querySelector(".react-flow__pane") as HTMLElement;
    fireEvent.mouseMove(pane, { clientX: 300, clientY: 220, bubbles: true });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }));

    expect(onAddNode).toHaveBeenCalledTimes(1);
    expect(onAddNode.mock.calls[0][0]).toBe("rounded-rect");
  });
});

describe("area selection mode", () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  const renderCanvas = (readOnly = false) =>
    render(
      <ReactFlowProvider>
        <DiagramCanvas
          nodes={[]}
          edges={[]}
          onNodesChange={() => {}}
          onEdgesChange={() => {}}
          onConnect={() => {}}
          setSelectedNodeId={() => {}}
          setSelectedEdgeId={() => {}}
          readOnly={readOnly}
        />
      </ReactFlowProvider>,
    );

  const pan = () => screen.getByRole("button", { name: "Pan the canvas" });
  const area = () => screen.getByRole("button", { name: "Select an area" });
  const wrapper = () => document.querySelector(".dm-canvas-area-select");

  it("starts in pan mode with both tools offered", async () => {
    renderCanvas();
    await settle();

    expect(pan().getAttribute("aria-pressed")).toBe("true");
    expect(area().getAttribute("aria-pressed")).toBe("false");
    expect(pan().getAttribute("aria-keyshortcuts")).toBe("H");
    expect(area().getAttribute("aria-keyshortcuts")).toBe("V");
    expect(wrapper()).toBeNull();
  });

  it("switches to the marquee tool from the control and back", async () => {
    renderCanvas();
    await settle();

    fireEvent.click(area());
    expect(area().getAttribute("aria-pressed")).toBe("true");
    expect(pan().getAttribute("aria-pressed")).toBe("false");
    // The pane advertises the mode through the cursor, driven by this class.
    expect(wrapper()).not.toBeNull();

    fireEvent.click(pan());
    expect(area().getAttribute("aria-pressed")).toBe("false");
    expect(wrapper()).toBeNull();
  });

  it("binds V and H to the two tools", async () => {
    renderCanvas();
    await settle();

    fireEvent.keyDown(window, { key: "v" });
    expect(area().getAttribute("aria-pressed")).toBe("true");

    fireEvent.keyDown(window, { key: "h" });
    expect(area().getAttribute("aria-pressed")).toBe("false");
  });

  it("ignores the tool keys while typing", async () => {
    renderCanvas();
    await settle();

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "v", bubbles: true }));
    expect(area().getAttribute("aria-pressed")).toBe("false");
    input.remove();
  });

  it("stays in pan mode on a read-only canvas", async () => {
    renderCanvas(true);
    await settle();

    fireEvent.keyDown(window, { key: "v" });
    expect(wrapper()).toBeNull();
  });
});

describe("canvas zoom range and viewport reporting", () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("opens the zoom range far enough for the canvas to read as unbounded", () => {
    // React Flow's own defaults are 0.5–2, which cannot show a wide diagram
    // whole. The actual camera move is a d3 transition that jsdom does not run,
    // so the range itself is what gets pinned here.
    expect(DEFAULT_MIN_ZOOM).toBeLessThanOrEqual(0.1);
    expect(DEFAULT_MAX_ZOOM).toBeGreaterThanOrEqual(4);
    // Panning is unbounded (no `translateExtent`), so the floor is what decides
    // how much of a large diagram can be on screen at once.
    expect(DEFAULT_MAX_ZOOM / DEFAULT_MIN_ZOOM).toBeGreaterThanOrEqual(100);
  });

  it("hands the host a viewport-centre getter and withdraws it on unmount", async () => {
    const registered: Array<(() => { x: number; y: number } | null) | null> = [];
    const view = render(
      <ReactFlowProvider>
        <DiagramCanvas
          nodes={[]}
          edges={[]}
          onNodesChange={() => {}}
          onEdgesChange={() => {}}
          onConnect={() => {}}
          setSelectedNodeId={() => {}}
          setSelectedEdgeId={() => {}}
          registerViewportCenter={(fn) => {
            registered.push(fn);
          }}
        />
      </ReactFlowProvider>,
    );
    await settle();

    const getCenter = registered[0];
    expect(typeof getCenter).toBe("function");
    // The shims report a 1200x800 canvas at the origin, so the untransformed
    // centre is the middle of that box.
    expect(getCenter?.()).toEqual({ x: 600, y: 400 });

    view.unmount();
    // Withdrawn, so the host never calls into an unmounted canvas.
    expect(registered.at(-1)).toBeNull();
  });
});
