// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { DiagramCanvas } from "./DiagramCanvas";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
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
