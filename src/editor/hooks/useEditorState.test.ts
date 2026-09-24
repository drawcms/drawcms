// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { AppEdge, AppNode } from "../types";
import {
  editorContentFingerprint,
  getSequenceInsertionLayout,
  useEditorState,
} from "./useEditorState";
import { createSequenceEdge, nextSequenceRow } from "../sequence-edges";

const nodes: AppNode[] = [
  {
    id: "client",
    position: { x: 60, y: 60 },
    data: { label: "Client", type: "actor" },
    selected: false,
  },
];

const edges: AppEdge[] = [
  {
    id: "response",
    source: "api",
    target: "client",
    selected: false,
    data: { routingMode: "curve", bend: { x: 0, y: 76 } },
  },
];

describe("editorContentFingerprint", () => {
  it("ignores selection-only canvas changes", () => {
    expect(
      editorContentFingerprint(
        nodes.map((node) => ({ ...node, selected: true })),
        edges.map((edge) => ({ ...edge, selected: true })),
      ),
    ).toBe(editorContentFingerprint(nodes, edges));
  });

  it("detects node movement and edge bend changes", () => {
    const baseline = editorContentFingerprint(nodes, edges);

    expect(
      editorContentFingerprint(
        nodes.map((node) => ({ ...node, position: { x: 70, y: 65 } })),
        edges,
      ),
    ).not.toBe(baseline);
    expect(
      editorContentFingerprint(
        nodes,
        edges.map((edge) => ({
          ...edge,
          data: { ...edge.data, bend: { x: 10, y: 86 } },
        })),
      ),
    ).not.toBe(baseline);
  });
});

describe("getSequenceInsertionLayout", () => {
  const lifelines: AppNode[] = [
    {
      id: "client",
      position: { x: 180, y: 120 },
      data: { label: "Client", type: "sequence-actor" },
      style: { width: 112, height: 240 },
    },
    {
      id: "api",
      position: { x: 400, y: 120 },
      data: { label: "API", type: "sequence-participant" },
      style: { width: 140, height: 240 },
      selected: true,
    },
  ];

  it("places additional lifelines in a readable horizontal row", () => {
    expect(
      getSequenceInsertionLayout("sequence-participant", lifelines, {
        width: 140,
        height: 240,
      }),
    ).toEqual({ position: { x: 620, y: 120 }, size: { width: 140, height: 240 } });
  });

  it("does not lay message tools out as detached nodes", () => {
    expect(
      getSequenceInsertionLayout("sequence-message", lifelines, { width: 220, height: 64 }),
    ).toBeNull();
    expect(
      getSequenceInsertionLayout("sequence-message-self", lifelines, {
        width: 140,
        height: 92,
      }),
    ).toBeNull();
  });

  it("centers activation and terminal markers on the selected lifeline", () => {
    expect(
      getSequenceInsertionLayout("sequence-activation", lifelines, {
        width: 90,
        height: 182,
      })?.position,
    ).toEqual({ x: 425, y: 172 });
    expect(
      getSequenceInsertionLayout("sequence-destroy", lifelines, {
        width: 96,
        height: 166,
      })?.position,
    ).toEqual({ x: 422, y: 236 });
  });

  it("wraps an interaction frame around the current lifeline row", () => {
    expect(
      getSequenceInsertionLayout("sequence-frame", lifelines, {
        width: 380,
        height: 280,
      }),
    ).toEqual({
      position: { x: 140, y: 80 },
      size: { width: 440, height: 320 },
    });
  });
});

describe("sequence message edges", () => {
  it("attaches a message to the same ordered row on both lifelines", () => {
    expect(
      createSequenceEdge({
        id: "request",
        sequenceType: "sequence-message",
        label: "request()",
        source: "client",
        target: "api",
        row: 3,
      }),
    ).toMatchObject({
      source: "client",
      target: "api",
      sourceHandle: "sequence-row-3",
      targetHandle: "sequence-row-3",
      zIndex: 2,
      data: { sequenceType: "sequence-message", routingMode: "straight" },
    });
  });

  it("uses two rows for a real attached self-message loop", () => {
    const self = createSequenceEdge({
      id: "verify",
      sequenceType: "sequence-message-self",
      label: "verify()",
      source: "api",
      target: "api",
      row: 4,
    });
    expect(self).toMatchObject({
      sourceHandle: "sequence-row-4",
      targetHandle: "sequence-row-5",
      data: { sequenceType: "sequence-message-self", routingMode: "elbow" },
    });
    expect(nextSequenceRow([self], true)).toBe(6);
  });

  it("moves a selected message through the editor callback without detaching it", () => {
    const lifelines: AppNode[] = [
      {
        id: "client",
        position: { x: 100, y: 40 },
        data: { label: "Client", type: "sequence-actor" },
      },
      {
        id: "api",
        position: { x: 360, y: 40 },
        data: { label: "API", type: "sequence-participant" },
      },
    ];
    const request = createSequenceEdge({
      id: "request",
      sequenceType: "sequence-message",
      label: "request()",
      source: "client",
      target: "api",
      row: 1,
    });
    const { result } = renderHook(() =>
      useEditorState({ initialNodes: lifelines, initialEdges: [request] }),
    );

    act(() => result.current.edgeRoutingCallbacks.onRoutingChangeStart());
    act(() =>
      result.current.edgeRoutingCallbacks.onSequenceMessageMove(
        "request",
        { x: 12, y: -30 },
        { x: 12, y: -30 },
      ),
    );

    expect(result.current.edges[0]).toMatchObject({
      source: "client",
      target: "api",
      sourceHandle: "sequence-row-1",
      targetHandle: "sequence-row-1",
      data: {
        sourceOffset: { x: 12, y: -30 },
        targetOffset: { x: 12, y: -30 },
      },
    });
  });

  it("moves each message point freely while preserving its attached lifelines", () => {
    const lifelines: AppNode[] = [
      {
        id: "client",
        position: { x: 100, y: 40 },
        data: { label: "Client", type: "sequence-actor" },
      },
      {
        id: "api",
        position: { x: 360, y: 40 },
        data: { label: "API", type: "sequence-participant" },
      },
    ];
    const request = createSequenceEdge({
      id: "request",
      sequenceType: "sequence-message",
      label: "request()",
      source: "client",
      target: "api",
      row: 2,
    });
    const { result } = renderHook(() =>
      useEditorState({ initialNodes: lifelines, initialEdges: [request] }),
    );

    act(() => result.current.edgeRoutingCallbacks.onRoutingChangeStart());
    act(() =>
      result.current.edgeRoutingCallbacks.onSequenceEndpointChange("request", "source", {
        x: -24,
        y: 18,
      }),
    );
    act(() =>
      result.current.edgeRoutingCallbacks.onSequenceEndpointChange("request", "target", {
        x: 42,
        y: -12,
      }),
    );

    expect(result.current.edges[0]).toMatchObject({
      source: "client",
      target: "api",
      sourceHandle: "sequence-row-2",
      targetHandle: "sequence-row-2",
      data: {
        sourceOffset: { x: -24, y: 18 },
        targetOffset: { x: 42, y: -12 },
      },
    });
  });

  it("arms from the palette, connects two lifelines, and stays attached after movement", () => {
    const lifelines: AppNode[] = [
      {
        id: "client",
        position: { x: 100, y: 40 },
        data: { label: "Client", type: "sequence-actor" },
        type: "customShape",
        style: { width: 112, height: 300 },
      },
      {
        id: "api",
        position: { x: 360, y: 40 },
        data: { label: "API", type: "sequence-participant" },
        type: "customShape",
        style: { width: 140, height: 300 },
      },
    ];
    const { result } = renderHook(() =>
      useEditorState({ initialNodes: lifelines, initialEdges: [] }),
    );

    act(() => result.current.handleAddNode("sequence-message", "request()"));
    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.activeSequenceEdgeTool?.sourceId).toBeNull();

    act(() => result.current.handleSequenceEdgeNodeClick("client"));
    expect(result.current.activeSequenceEdgeTool?.sourceId).toBe("client");
    act(() => result.current.handleSequenceEdgeNodeClick("api"));

    expect(result.current.edges).toHaveLength(1);
    expect(result.current.edges[0]).toMatchObject({
      source: "client",
      target: "api",
      sourceHandle: "sequence-row-1",
      targetHandle: "sequence-row-1",
      data: { sequenceType: "sequence-message" },
    });
    expect(result.current.activeSequenceEdgeTool).toBeNull();

    act(() =>
      result.current.onNodesChange([
        { id: "api", type: "position", position: { x: 520, y: 80 }, dragging: false },
      ]),
    );
    expect(result.current.nodes.find((node) => node.id === "api")?.position).toEqual({
      x: 520,
      y: 80,
    });
    expect(result.current.edges[0]).toMatchObject({ source: "client", target: "api" });
  });

  it("applies repeated scale changes without detaching the message", () => {
    const lifelines: AppNode[] = [
      {
        id: "client",
        position: { x: 100, y: 40 },
        data: { label: "Client", type: "sequence-actor" },
      },
      {
        id: "api",
        position: { x: 360, y: 40 },
        data: { label: "API", type: "sequence-participant" },
      },
    ];
    const edge = createSequenceEdge({
      id: "request",
      sequenceType: "sequence-message",
      label: "request()",
      source: "client",
      target: "api",
      row: 1,
    });
    const { result } = renderHook(() =>
      useEditorState({ initialNodes: lifelines, initialEdges: [{ ...edge, selected: true }] }),
    );

    act(() => result.current.setSelectedEdgeId("request"));
    expect(result.current.isSelectedSequenceEdge).toBe(true);
    expect(result.current.selectedEdgeScale).toBe(1);

    act(() => result.current.handleStyleChange({ scale: 1.5 }));
    expect(result.current.edges[0]).toMatchObject({
      source: "client",
      target: "api",
      sourceHandle: "sequence-row-1",
      targetHandle: "sequence-row-1",
      data: { scale: 1.5 },
    });

    act(() => result.current.handleStyleChange({ scale: 0.75 }));
    expect(result.current.selectedEdgeScale).toBe(0.75);
    expect(result.current.edges[0].data?.scale).toBe(0.75);
  });

  it("undoes an added node and a committed sequence message", async () => {
    const lifelines: AppNode[] = [
      {
        id: "client",
        position: { x: 100, y: 40 },
        data: { label: "Client", type: "sequence-actor" },
        type: "customShape",
        style: { width: 112, height: 300 },
      },
      {
        id: "api",
        position: { x: 360, y: 40 },
        data: { label: "API", type: "sequence-participant" },
        type: "customShape",
        style: { width: 140, height: 300 },
      },
    ];
    const { result } = renderHook(() =>
      useEditorState({ initialNodes: lifelines, initialEdges: [] }),
    );
    const pressUndo = async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true }),
      );
      await new Promise((resolve) => requestAnimationFrame(resolve));
    };

    act(() => result.current.handleAddNode("sequence-participant", "Database"));
    expect(result.current.nodes).toHaveLength(3);

    await act(pressUndo);
    expect(result.current.nodes).toHaveLength(2);

    act(() => result.current.handleAddNode("sequence-message", "request()"));
    act(() => result.current.handleSequenceEdgeNodeClick("client"));
    act(() => result.current.handleSequenceEdgeNodeClick("api"));
    expect(result.current.edges).toHaveLength(1);

    await act(pressUndo);
    expect(result.current.edges).toHaveLength(0);
  });

  it("creates standalone text ready for direct editing", () => {
    const { result } = renderHook(() => useEditorState({ initialNodes: [], initialEdges: [] }));

    act(() => result.current.handleAddNode("text", ""));

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.selectedNodeId).toBe(result.current.nodes[0].id);
    expect(result.current.nodes[0]).toMatchObject({
      data: {
        label: "",
        type: "text",
        fontFamily: "sans",
        fontSize: 20,
        fontWeight: "400",
        textAlign: "left",
        lineHeight: 1.25,
        textAutoResize: true,
        textEditOnMount: true,
      },
      style: { width: 160, height: 40 },
      selected: true,
    });
  });

  it("patches node and edge motion by id independent of selection", () => {
    const initialNodes: AppNode[] = [
      { id: "a", position: { x: 0, y: 0 }, data: { label: "A", type: "round-rect" } },
      { id: "b", position: { x: 200, y: 0 }, data: { label: "B", type: "round-rect" } },
    ];
    const initialEdges: AppEdge[] = [{ id: "e1", source: "a", target: "b", data: {} }];
    const { result } = renderHook(() => useEditorState({ initialNodes, initialEdges }));

    act(() =>
      result.current.applyElementMotionPatches([
        { targetId: "a", targetKind: "node", preset: "Pulse Node", speed: 1.5, loop: true },
        { targetId: "e1", targetKind: "edge", preset: "Data Flow", loop: false },
      ]),
    );

    expect(result.current.nodes.find((n) => n.id === "a")?.data).toMatchObject({
      preset: "Pulse Node",
      motionSpeed: 1.5,
      motionLoop: true,
    });
    expect(result.current.nodes.find((n) => n.id === "b")?.data.preset).toBeUndefined();
    expect(result.current.edges[0].data).toMatchObject({ preset: "Data Flow", motionLoop: false });
  });

  it("clears a preset with a null patch and undoes the whole batch in one step", async () => {
    const initialNodes: AppNode[] = [
      {
        id: "a",
        position: { x: 0, y: 0 },
        data: { label: "A", type: "round-rect", preset: "Bounce" },
      },
    ];
    const { result } = renderHook(() => useEditorState({ initialNodes, initialEdges: [] }));

    act(() =>
      result.current.applyElementMotionPatches([
        { targetId: "a", targetKind: "node", preset: null },
      ]),
    );
    expect(result.current.nodes[0].data.preset).toBeUndefined();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true }));
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(result.current.nodes[0].data.preset).toBe("Bounce");
  });

  it("applies a batched structural edit and undoes the whole batch in one step", async () => {
    const initialNodes: AppNode[] = [
      { id: "a", position: { x: 0, y: 0 }, data: { label: "A", type: "round-rect" } },
    ];
    const { result } = renderHook(() => useEditorState({ initialNodes, initialEdges: [] }));

    act(() =>
      result.current.applyGraphEdit([
        {
          op: "addNode",
          node: {
            id: "b",
            position: { x: 200, y: 0 },
            data: { label: "B", type: "round-rect" },
            type: "customShape",
            style: { width: 160, height: 80 },
          },
        },
        {
          op: "addEdge",
          edge: { id: "e1", source: "a", target: "b", sourceHandle: "right", targetHandle: "left" },
        },
      ]),
    );

    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.edges).toHaveLength(1);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true }));
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.edges).toHaveLength(0);
  });

  it("deletes a node and its connected edge through a batched structural edit", () => {
    const initialNodes: AppNode[] = [
      { id: "a", position: { x: 0, y: 0 }, data: { label: "A", type: "round-rect" } },
      { id: "b", position: { x: 200, y: 0 }, data: { label: "B", type: "round-rect" } },
    ];
    const initialEdges: AppEdge[] = [{ id: "e1", source: "a", target: "b", data: {} }];
    const { result } = renderHook(() => useEditorState({ initialNodes, initialEdges }));

    act(() => result.current.applyGraphEdit([{ op: "deleteNode", nodeId: "b" }]));

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.edges).toHaveLength(0);
  });

  it("adds an icon node with self-contained artwork and selects it", () => {
    const { result } = renderHook(() => useEditorState({ initialNodes: [], initialEdges: [] }));

    act(() =>
      result.current.handleAddIcon({
        icon: "lucide:home",
        body: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
        viewBox: "0 0 24 24",
        label: "home",
      }),
    );

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.selectedNodeId).toBe(result.current.nodes[0].id);
    expect(result.current.nodes[0]).toMatchObject({
      type: "customShape",
      data: {
        label: "home",
        type: "icon",
        iconName: "lucide:home",
        iconBody: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
        iconViewBox: "0 0 24 24",
      },
      style: { width: 100, height: 100 },
      selected: true,
    });
  });
});

describe("keyboard shortcuts", () => {
  const press = async (key: string, modifiers: Partial<KeyboardEventInit> = {}) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...modifiers }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  };

  const selected = (node: Partial<AppNode> & { id: string }): AppNode =>
    ({
      position: { x: 0, y: 0 },
      data: { label: "N", type: "rect" },
      selected: true,
      ...node,
    }) as AppNode;

  it("steps the font size of every selected node along the ladder", async () => {
    const { result } = renderHook(() =>
      useEditorState({
        initialNodes: [
          selected({ id: "a", data: { label: "A", type: "rect", fontSize: 14 } }),
          selected({ id: "b", data: { label: "B", type: "text", fontSize: 20 } }),
          selected({ id: "c", data: { label: "C", type: "rect" }, selected: false }),
        ],
        initialEdges: [],
      }),
    );

    await act(() => press(".", { metaKey: true, shiftKey: true }));
    const sizes = () =>
      Object.fromEntries(result.current.nodes.map((n) => [n.id, n.data.fontSize]));
    expect(sizes()).toEqual({ a: 16, b: 24, c: undefined });

    await act(() => press(",", { metaKey: true, shiftKey: true }));
    await act(() => press(",", { metaKey: true, shiftKey: true }));
    // Unselected nodes are never touched.
    expect(sizes()).toEqual({ a: 12, b: 18, c: undefined });
  });

  it("clamps each node to the maximum its own element type allows", async () => {
    const { result } = renderHook(() =>
      useEditorState({
        initialNodes: [
          selected({ id: "shape", data: { label: "S", type: "rect", fontSize: 48 } }),
          selected({ id: "text", data: { label: "T", type: "text", fontSize: 96 } }),
        ],
        initialEdges: [],
      }),
    );

    await act(() => press(">", { metaKey: true, shiftKey: true }));
    expect(result.current.nodes.map((n) => n.data.fontSize)).toEqual([48, 96]);
  });

  it("leaves locked nodes alone", async () => {
    const { result } = renderHook(() =>
      useEditorState({
        initialNodes: [
          selected({ id: "a", data: { label: "A", type: "rect", fontSize: 14, locked: true } }),
        ],
        initialEdges: [],
      }),
    );

    await act(() => press(".", { metaKey: true, shiftKey: true }));
    expect(result.current.nodes[0].data.fontSize).toBe(14);
  });

  it("fans repeated pastes out instead of stacking them on one spot", async () => {
    const { result } = renderHook(() =>
      useEditorState({
        initialNodes: [selected({ id: "a", position: { x: 100, y: 100 } })],
        initialEdges: [],
      }),
    );
    act(() => result.current.setSelectedNodeId("a"));
    act(() => result.current.copySelection());

    await act(() => press("v", { metaKey: true }));
    await act(() => press("v", { metaKey: true }));
    await act(() => press("v", { metaKey: true }));

    expect(result.current.nodes.map((n) => n.position)).toEqual([
      { x: 100, y: 100 },
      { x: 140, y: 140 },
      { x: 180, y: 180 },
      { x: 220, y: 220 },
    ]);
  });

  it("pastes at an explicit point when one is given, and restarts the fan-out", () => {
    const { result } = renderHook(() =>
      useEditorState({
        initialNodes: [selected({ id: "a", position: { x: 100, y: 100 } })],
        initialEdges: [],
      }),
    );
    act(() => result.current.setSelectedNodeId("a"));
    act(() => result.current.copySelection());

    act(() => result.current.paste({ x: 900, y: 40 }));
    expect(result.current.nodes.at(-1)?.position).toEqual({ x: 900, y: 40 });
  });

  it("toggles the elements panel", async () => {
    const { result } = renderHook(() => useEditorState({ initialNodes: [], initialEdges: [] }));
    expect(result.current.showLeftPanel).toBe(false);

    await act(() => press("b", { metaKey: true }));
    expect(result.current.showLeftPanel).toBe(true);

    await act(() => press("b", { metaKey: true }));
    expect(result.current.showLeftPanel).toBe(false);
  });

  it("clears the selection on Escape", async () => {
    const { result } = renderHook(() =>
      useEditorState({ initialNodes: [selected({ id: "a" })], initialEdges: [] }),
    );
    act(() => result.current.setSelectedNodeId("a"));

    await act(() => press("Escape"));
    expect(result.current.selectedNodeId).toBeNull();
    expect(result.current.nodes[0].selected).toBe(false);
  });

  it("does not fire while the user is typing", async () => {
    const { result } = renderHook(() =>
      useEditorState({
        initialNodes: [selected({ id: "a", data: { label: "A", type: "rect", fontSize: 14 } })],
        initialEdges: [],
      }),
    );

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: ".", metaKey: true, shiftKey: true, bubbles: true }),
    );
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(result.current.nodes[0].data.fontSize).toBe(14);
    input.remove();
  });

  it("undoes a double-click text addition despite React Flow's dimension bookkeeping", async () => {
    // Adding a node lands a `dimensions` change as soon as React Flow measures
    // it. Those measurement pushes are consequences of the addition, so undo
    // must remove the element instead of re-applying a post-add snapshot.
    const { result } = renderHook(() => useEditorState({ initialNodes: [], initialEdges: [] }));

    act(() => result.current.handleAddNode("text", "", { x: 400, y: 300 }));
    expect(result.current.nodes).toHaveLength(1);
    const id = result.current.nodes[0].id;

    // React Flow measures the fresh DOM node and reports its size.
    act(() =>
      result.current.onNodesChange([
        { id, type: "dimensions", dimensions: { width: 96, height: 31 } },
      ]),
    );
    act(() => result.current.setSelectedNodeId(id));
    await act(() => press("z", { metaKey: true }));

    expect(result.current.nodes).toHaveLength(0);
    // And redo brings the element straight back.
    await act(() => press("z", { metaKey: true, shiftKey: true }));
    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0].id).toBe(id);
  });

  it("keeps position and remove changes undoable", async () => {
    const { result } = renderHook(() =>
      useEditorState({
        initialNodes: [selected({ id: "a", position: { x: 10, y: 10 } })],
        initialEdges: [],
      }),
    );

    act(() =>
      result.current.onNodesChange([
        { id: "a", type: "position", position: { x: 60, y: 60 }, dragging: false },
      ]),
    );
    await act(() => press("z", { metaKey: true }));
    expect(result.current.nodes[0].position).toEqual({ x: 10, y: 10 });
  });
});

describe("placing elements added without a position", () => {
  it("centres them on the visible canvas rather than a fixed coordinate", () => {
    const { result } = renderHook(() =>
      useEditorState({
        initialNodes: [],
        initialEdges: [],
        // Author has panned far from the origin.
        getViewportCenter: () => ({ x: 4000, y: 3000 }),
      }),
    );

    act(() => result.current.handleAddNode("round-rect", "Step"));

    // 160x80 default, so the centre of the box lands on the centre of the view.
    expect(result.current.nodes[0].position).toEqual({ x: 3920, y: 2960 });
  });

  it("cascades instead of stacking when several are added in a row", () => {
    const { result } = renderHook(() =>
      useEditorState({
        initialNodes: [],
        initialEdges: [],
        getViewportCenter: () => ({ x: 1000, y: 1000 }),
      }),
    );

    act(() => result.current.handleAddNode("round-rect", "One"));
    act(() => result.current.handleAddNode("round-rect", "Two"));
    act(() => result.current.handleAddNode("round-rect", "Three"));

    const positions = result.current.nodes.map((node) => node.position);
    expect(positions).toEqual([
      { x: 920, y: 960 },
      { x: 948, y: 988 },
      { x: 976, y: 1016 },
    ]);
  });

  it("centres icons on the view too", () => {
    const { result } = renderHook(() =>
      useEditorState({
        initialNodes: [],
        initialEdges: [],
        getViewportCenter: () => ({ x: 500, y: 400 }),
      }),
    );

    act(() =>
      result.current.handleAddIcon({
        icon: "lucide:home",
        body: "<path d='M3 9l9-7 9 7'/>",
        viewBox: "0 0 24 24",
        label: "home",
      }),
    );

    // Icons are 100x100.
    expect(result.current.nodes[0].position).toEqual({ x: 450, y: 350 });
  });

  it("still lets sequence shapes claim their own lifeline column", () => {
    const { result } = renderHook(() =>
      useEditorState({
        initialNodes: [],
        initialEdges: [],
        getViewportCenter: () => ({ x: 5000, y: 5000 }),
      }),
    );

    act(() => result.current.handleAddNode("sequence-participant", "API"));

    // Sequence placement is positional notation, not a matter of taste, so it
    // must win over "wherever the author happens to be looking".
    expect(result.current.nodes[0].position).not.toEqual({ x: 4930, y: 4880 });
    expect(result.current.nodes[0].position.y).toBe(120);
  });

  it("falls back to a fixed spot before the canvas reports a viewport", () => {
    const { result } = renderHook(() => useEditorState({ initialNodes: [], initialEdges: [] }));

    act(() => result.current.handleAddNode("round-rect", "Step"));
    expect(result.current.nodes[0].position).toEqual({ x: 300, y: 200 });
  });

  it("honours an explicit position over the viewport centre", () => {
    const { result } = renderHook(() =>
      useEditorState({
        initialNodes: [],
        initialEdges: [],
        getViewportCenter: () => ({ x: 1000, y: 1000 }),
      }),
    );

    act(() => result.current.handleAddNode("round-rect", "Step", { x: 12, y: 34 }));
    expect(result.current.nodes[0].position).toEqual({ x: 12, y: 34 });
  });
});

describe("re-pointing a connector", () => {
  const three: AppNode[] = [
    { id: "a", position: { x: 0, y: 0 }, data: { label: "A", type: "rect" } },
    { id: "b", position: { x: 200, y: 0 }, data: { label: "B", type: "rect" } },
    { id: "c", position: { x: 400, y: 0 }, data: { label: "C", type: "rect" } },
  ];
  const link: AppEdge = {
    id: "e1",
    source: "a",
    target: "b",
    sourceHandle: "right",
    targetHandle: "left",
    data: { preset: "Data Flow", motionLoop: true },
  };

  it("moves the endpoint and keeps the edge id, preset, and loop", () => {
    const { result } = renderHook(() =>
      useEditorState({ initialNodes: three, initialEdges: [link] }),
    );

    act(() => result.current.onReconnectStart());
    act(() =>
      result.current.onReconnect(link, {
        source: "a",
        target: "c",
        sourceHandle: "right",
        targetHandle: "left",
      }),
    );

    expect(result.current.edges).toHaveLength(1);
    expect(result.current.edges[0]).toMatchObject({
      id: "e1",
      source: "a",
      target: "c",
      data: { preset: "Data Flow", motionLoop: true },
    });
  });

  // History is pushed on drag start, not on the mutation. Pushing it in
  // onReconnect would snapshot state that already contains the change and make
  // Cmd+Z a no-op — the same trap onNodesChange avoids for dimension changes.
  it("undo restores the original endpoints", () => {
    const { result } = renderHook(() =>
      useEditorState({ initialNodes: three, initialEdges: [link] }),
    );

    act(() => result.current.onReconnectStart());
    act(() =>
      result.current.onReconnect(link, {
        source: "a",
        target: "c",
        sourceHandle: null,
        targetHandle: "left",
      }),
    );
    expect(result.current.edges[0].target).toBe("c");

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true }),
      );
    });
    expect(result.current.edges[0]).toMatchObject({ id: "e1", source: "a", target: "b" });
  });

  it("refuses a drop onto a locked node", () => {
    const locked: AppNode[] = [
      ...three.slice(0, 2),
      { id: "c", position: { x: 400, y: 0 }, data: { label: "C", type: "rect", locked: true } },
    ];
    const { result } = renderHook(() =>
      useEditorState({ initialNodes: locked, initialEdges: [link] }),
    );

    act(() => result.current.onReconnectStart());
    act(() =>
      result.current.onReconnect(link, {
        source: "a",
        target: "c",
        sourceHandle: null,
        targetHandle: null,
      }),
    );

    expect(result.current.edges[0].target).toBe("b");
  });

  it("refuses a drop that would duplicate an existing connector", () => {
    const existing: AppEdge = { id: "e2", source: "a", target: "c" };
    const { result } = renderHook(() =>
      useEditorState({ initialNodes: three, initialEdges: [link, existing] }),
    );

    act(() => result.current.onReconnectStart());
    act(() =>
      result.current.onReconnect(link, {
        source: "a",
        target: "c",
        sourceHandle: null,
        targetHandle: null,
      }),
    );

    expect(result.current.edges.find((e) => e.id === "e1")?.target).toBe("b");
    expect(result.current.edges).toHaveLength(2);
  });

  it("isValidConnection mirrors the commit rules", () => {
    const { result } = renderHook(() =>
      useEditorState({ initialNodes: three, initialEdges: [link] }),
    );

    expect(
      result.current.isValidConnection({
        source: "a",
        target: "c",
        sourceHandle: null,
        targetHandle: null,
      }),
    ).toBe(true);
    expect(
      result.current.isValidConnection({
        source: "a",
        target: "b",
        sourceHandle: "right",
        targetHandle: "left",
      }),
    ).toBe(false);
  });

  it("leaves sequence messages non-reconnectable", () => {
    const lifelines: AppNode[] = [
      { id: "client", position: { x: 100, y: 40 }, data: { label: "C", type: "sequence-actor" } },
      {
        id: "api",
        position: { x: 360, y: 40 },
        data: { label: "A", type: "sequence-participant" },
      },
    ];
    const message = createSequenceEdge({
      id: "request",
      sequenceType: "sequence-message",
      label: "request()",
      source: "client",
      target: "api",
      row: 1,
    });
    const { result } = renderHook(() =>
      useEditorState({ initialNodes: lifelines, initialEdges: [message] }),
    );

    // Row geometry (sequence-row-N, capped at 12) is not something a free
    // endpoint drag can honour, and these already have their own affordance.
    expect(result.current.flowEdges[0].reconnectable).toBe(false);
  });
});
