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
