// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Position, ReactFlowProvider, type EdgeProps } from "@xyflow/react";
import {
  AnimationStateContext,
  EdgeRoutingCallbacksContext,
  type AnimationStateType,
  type EdgeRoutingCallbacksType,
} from "../contexts";
import { CustomEdge } from "./CustomEdge";

const gsapMocks = vi.hoisted(() => {
  const timeline = {
    to: vi.fn(),
    kill: vi.fn(),
  };
  timeline.to.mockReturnValue(timeline);
  return {
    timeline,
    gsap: {
      registerPlugin: vi.fn(),
      killTweensOf: vi.fn(),
      set: vi.fn(),
      to: vi.fn(),
      timeline: vi.fn(() => timeline),
    },
  };
});

vi.mock("gsap", () => ({ default: gsapMocks.gsap }));
vi.mock("gsap/MotionPathPlugin", () => ({ MotionPathPlugin: {} }));
vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    EdgeLabelRenderer: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const edgeProps = {
  id: "edge-ab",
  source: "node-a",
  target: "node-b",
  sourceX: 0,
  sourceY: 20,
  targetX: 180,
  targetY: 20,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  selected: false,
  data: {},
} as EdgeProps;

const baseAnimationState: AnimationStateType = {
  isGlobalAnimating: false,
  isPreviewingSelected: false,
  selectedNodeId: null,
  activeStoryNodeIds: [],
  activeStoryEdgeIds: [],
  isStoryStepPlaying: false,
  prefersReducedMotion: false,
};

function renderEdge(
  animationState: AnimationStateType,
  props: EdgeProps = edgeProps,
  routingCallbacks: EdgeRoutingCallbacksType | null = null,
) {
  return render(
    <ReactFlowProvider>
      <AnimationStateContext.Provider value={animationState}>
        <EdgeRoutingCallbacksContext.Provider value={routingCallbacks}>
          <svg>
            <CustomEdge {...props} />
          </svg>
        </EdgeRoutingCallbacksContext.Provider>
      </AnimationStateContext.Provider>
    </ReactFlowProvider>,
  );
}

describe("CustomEdge presentation highlight", () => {
  it("renders a dedicated mint route, arrow, and packet for an active step edge", () => {
    const { container } = renderEdge({
      ...baseAnimationState,
      activeStoryEdgeIds: ["edge-ab"],
      isStoryStepPlaying: true,
    });

    const highlight = container.querySelector(".dm-story-edge-highlight");
    expect(highlight?.getAttribute("stroke")).toBe("#0c8c5e");
    expect(highlight?.getAttribute("stroke-width")).toBe("3");
    expect(highlight?.getAttribute("marker-end")).toMatch(/^url\(#dm-story-arrow-/);
    expect(container.querySelector(".dm-story-edge-underlay")).toBeTruthy();
    expect(container.querySelector(".dm-story-flow-packet")).toBeTruthy();
    expect(container.querySelector(".dm-story-edge-active")?.getAttribute("stroke")).toBe(
      "#0c8c5e",
    );
    expect(gsapMocks.gsap.timeline).toHaveBeenCalled();
  });

  it("does not add presentation decoration to an inactive connector", () => {
    const { container } = renderEdge(baseAnimationState);

    expect(container.querySelector(".dm-story-edge-highlight")).toBeNull();
    expect(container.querySelector(".dm-story-edge-underlay")).toBeNull();
    expect(container.querySelector(".dm-story-flow-packet")).toBeNull();
  });

  it("keeps the static route but suppresses packet motion for reduced motion", () => {
    const { container } = renderEdge({
      ...baseAnimationState,
      activeStoryEdgeIds: ["edge-ab"],
      isStoryStepPlaying: true,
      prefersReducedMotion: true,
    });

    expect(container.querySelector(".dm-story-edge-highlight")).toBeTruthy();
    expect(container.querySelector(".dm-story-flow-packet")).toBeTruthy();
    expect(gsapMocks.gsap.timeline).not.toHaveBeenCalled();
  });

  it("bends return connectors away from a parallel request path", () => {
    const { container } = renderEdge(baseAnimationState, {
      ...edgeProps,
      data: { curveOffset: 64 },
    });

    expect(container.querySelector(".react-flow__edge-path")?.getAttribute("d")).toBe(
      "M0,20 Q90,148 180,20",
    );
  });

  it("renders a direct line in straight mode", () => {
    const { container } = renderEdge(baseAnimationState, {
      ...edgeProps,
      data: { routingMode: "straight" },
    });

    expect(container.querySelector(".react-flow__edge-path")?.getAttribute("d")).toBe(
      "M 0,20L 180,20",
    );
  });

  it("preserves multiline labels and constrains long edge text", () => {
    const { container } = renderEdge(baseAnimationState, {
      ...edgeProps,
      data: { label: "request payload\nwith details" },
    });

    const label = container.querySelector<HTMLElement>('[data-edge-label="true"]');
    expect(label?.textContent).toBe("request payload\nwith details");
    expect(label?.style.whiteSpace).toBe("pre-wrap");
    expect(label?.style.overflowWrap).toBe("anywhere");
    expect(label?.style.maxWidth).toBe("220px");
  });

  it("renders an orthogonal route through the stored bend in elbow mode", () => {
    const { container } = renderEdge(baseAnimationState, {
      ...edgeProps,
      targetY: 120,
      data: { routingMode: "elbow", bend: { x: 24, y: 32 } },
    });
    const path = container.querySelector(".react-flow__edge-path")?.getAttribute("d") ?? "";

    expect(path).toContain("L");
    expect(path).not.toContain(" C");
  });

  it("renders synchronous sequence messages as attached filled-arrow edges", () => {
    const { container } = renderEdge(baseAnimationState, {
      ...edgeProps,
      data: { sequenceType: "sequence-message", routingMode: "straight", label: "request()" },
    });

    const path = container.querySelector(".react-flow__edge-path");
    const marker = container.querySelector('marker[id^="dm-sequence-arrow-"]');
    expect(path?.getAttribute("d")).toBe("M 0,20L 180,20");
    expect(path?.getAttribute("marker-end")).toMatch(/^url\(#dm-sequence-arrow-/);
    expect(marker?.getAttribute("refX")).toBe("10");
    expect(
      container.querySelector('marker[id^="dm-sequence-arrow-"] path')?.getAttribute("fill"),
    ).toBe("#475569");
  });

  it("loops a subtle flow packet without replacing the sequence message line", () => {
    const { container } = renderEdge(baseAnimationState, {
      ...edgeProps,
      data: {
        sequenceType: "sequence-message",
        routingMode: "straight",
        preset: "Sequence Flow",
        motionSpeed: 0.5,
        motionLoop: true,
        isAnimating: true,
      },
    });

    expect(container.querySelector(".react-flow__edge-path")?.getAttribute("d")).toBe(
      "M 0,20L 180,20",
    );
    const paths = container.querySelectorAll<SVGPathElement>(".react-flow__edge-path");
    const glow = paths[paths.length - 1];
    expect(glow.getAttribute("stroke-dasharray")).toBe("24 1000");
    expect(glow.getAttribute("stroke-dashoffset")).toBe("24");
    expect(gsapMocks.gsap.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        opacity: 0.9,
      }),
    );
    expect(gsapMocks.gsap.to).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        attr: { "stroke-dashoffset": -1024 },
        duration: 1,
        ease: "none",
        repeat: -1,
      }),
    );
  });

  it("scales a selected sequence message", () => {
    const { container } = renderEdge(baseAnimationState, {
      ...edgeProps,
      selected: true,
      data: {
        sequenceType: "sequence-message",
        routingMode: "straight",
        label: "request()",
        scale: 1.5,
      },
    });

    const path = container.querySelector(".react-flow__edge-path");
    const marker = container.querySelector('marker[id^="dm-sequence-arrow-"]');
    expect(path?.getAttribute("stroke-width")).toBe("3");
    expect(marker?.getAttribute("markerWidth")).toBe("15");
    expect(marker?.getAttribute("markerHeight")).toBe("15");
  });

  it("applies independent visual offsets to both sequence message endpoints", () => {
    const { container } = renderEdge(baseAnimationState, {
      ...edgeProps,
      data: {
        sequenceType: "sequence-message",
        routingMode: "straight",
        sourceOffset: { x: 12, y: -8 },
        targetOffset: { x: 36, y: 44 },
      },
    });

    expect(container.querySelector(".react-flow__edge-path")?.getAttribute("d")).toBe(
      "M 12,12L 216,64",
    );
  });

  it("exposes keyboard-accessible source and target point controls", () => {
    const routingCallbacks: EdgeRoutingCallbacksType = {
      onRoutingChangeStart: vi.fn(),
      onRoutingChange: vi.fn(),
      onSequenceEndpointChange: vi.fn(),
      onSequenceMessageMove: vi.fn(),
    };
    renderEdge(
      baseAnimationState,
      {
        ...edgeProps,
        selected: true,
        sourceHandleId: "sequence-row-2",
        data: { sequenceType: "sequence-message", routingMode: "straight" },
      },
      routingCallbacks,
    );

    const sourceControl = screen.getByRole("button", { name: "Move sequence message source" });
    const targetControl = screen.getByRole("button", { name: "Move sequence message target" });
    fireEvent.keyDown(sourceControl, {
      key: "ArrowRight",
    });
    expect(routingCallbacks.onRoutingChangeStart).toHaveBeenCalledOnce();
    expect(routingCallbacks.onSequenceEndpointChange).toHaveBeenCalledWith("edge-ab", "source", {
      x: 1,
      y: 0,
    });
    expect(targetControl).toBeTruthy();

    vi.mocked(routingCallbacks.onRoutingChangeStart).mockClear();
    vi.mocked(routingCallbacks.onSequenceEndpointChange).mockClear();
    fireEvent.mouseDown(targetControl, { clientX: 180, clientY: 20, buttons: 1 });
    fireEvent.mouseMove(window, { clientX: 240, clientY: 110, buttons: 1 });
    fireEvent.mouseUp(window, { clientX: 240, clientY: 110 });
    expect(routingCallbacks.onRoutingChangeStart).toHaveBeenCalledOnce();
    expect(routingCallbacks.onSequenceEndpointChange).toHaveBeenCalledWith("edge-ab", "target", {
      x: 60,
      y: 90,
    });
  });

  it("renders return messages dashed with an open arrowhead", () => {
    const { container } = renderEdge(baseAnimationState, {
      ...edgeProps,
      data: { sequenceType: "sequence-message-return", routingMode: "straight" },
    });

    const path = container.querySelector(".react-flow__edge-path");
    expect(path?.getAttribute("stroke-dasharray")).toBe("7 5");
    expect(path?.getAttribute("stroke-dashoffset")).toBe("0");
    expect(
      container.querySelector('marker[id^="dm-sequence-arrow-"] path')?.getAttribute("fill"),
    ).toBe("none");
    expect(container.querySelector('marker[id^="dm-sequence-arrow-"]')?.getAttribute("refX")).toBe(
      "9",
    );
  });

  it("routes a self message out and back between two handles on the same participant", () => {
    const { container } = renderEdge(baseAnimationState, {
      ...edgeProps,
      source: "node-a",
      target: "node-a",
      sourceX: 80,
      targetX: 80,
      sourceY: 120,
      targetY: 160,
      data: {
        sequenceType: "sequence-message-self",
        routingMode: "elbow",
        bend: { x: 64, y: 0 },
      },
    });

    expect(container.querySelector(".react-flow__edge-path")?.getAttribute("d")).toBe(
      "M80,120 L144,120 L144,160 L80,160",
    );
    expect(container.querySelector('marker[id^="dm-sequence-arrow-"]')?.getAttribute("refX")).toBe(
      "10",
    );
  });

  it("scales self-message loop clearance while keeping both lifeline anchors fixed", () => {
    const { container } = renderEdge(baseAnimationState, {
      ...edgeProps,
      source: "node-a",
      target: "node-a",
      sourceX: 80,
      targetX: 80,
      sourceY: 120,
      targetY: 160,
      data: {
        sequenceType: "sequence-message-self",
        routingMode: "elbow",
        bend: { x: 64, y: 0 },
        scale: 1.5,
      },
    });

    expect(container.querySelector(".react-flow__edge-path")?.getAttribute("d")).toBe(
      "M80,120 L176,120 L176,160 L80,160",
    );
  });
});

describe("CustomEdge stroke consistency with exports", () => {
  // The live canvas resolves the edge stroke through React Flow's
  // `.react-flow__edge-path` CSS rule, while html-to-image exports fall back
  // to the path's own styles. Anchoring the color (and width) in an inline
  // style keeps both renderings identical.
  const mainPathOf = (container: HTMLElement) =>
    container.querySelector<SVGPathElement>(".react-flow__edge-path");
  const asRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${r}, ${g}, ${b})`;
  };

  beforeAll(() => {
    // jsdom lacks SVG geometry; Sequential Glow measures the path length.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getTotalLength = () => 100;
  });

  it.each([
    ["Data Flow", "#63d2a4"],
    ["Pulse", "#60a5fa"],
    ["Orbit", "#60a5fa"],
    ["Sequential Glow", "#63d2a4"],
    ["Fade Path", "#63d2a4"],
  ])("applies the %s preset color as inline style", (preset, expected) => {
    const { container } = renderEdge(baseAnimationState, {
      ...edgeProps,
      data: { preset },
    });
    const path = mainPathOf(container)!;
    expect(path.getAttribute("stroke")).toBe(expected);
    expect(path.style.stroke).toBe(asRgb(expected));
    expect(path.style.strokeWidth).toBe("1");
  });

  it("keeps the default connector color consistent between attribute and style", () => {
    const { container } = renderEdge(baseAnimationState);
    const path = mainPathOf(container)!;
    expect(path.getAttribute("stroke")).toBe("#94a3b8");
    expect(path.style.stroke).toBe(asRgb("#94a3b8"));
  });

  it("uses the DrawCMS mint accent for a selected connector", () => {
    const { container } = renderEdge(baseAnimationState, { ...edgeProps, selected: true });
    const path = mainPathOf(container)!;
    expect(path.getAttribute("stroke")).toBe("#0c8c5e");
    expect(path.style.stroke).toBe(asRgb("#0c8c5e"));
  });

  it("pins the glow color and dash geometry so both survive export", () => {
    const { container } = renderEdge(baseAnimationState, {
      ...edgeProps,
      data: { preset: "Sequential Glow" },
    });
    const glows = container.querySelectorAll<SVGPathElement>(".react-flow__edge-path");
    const glow = glows[glows.length - 1];
    expect(glow.getAttribute("stroke")).toBe("#63d2a4");
    expect(glow.style.stroke).toBe(asRgb("#63d2a4"));
    expect(glow.style.opacity).toBe("0");
    expect(glow.getAttribute("stroke-dasharray")).toBe("15 100");
    expect(glow.getAttribute("stroke-dashoffset")).toBe("100");
  });
});
