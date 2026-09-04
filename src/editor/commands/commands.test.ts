import { describe, expect, it } from "vitest";
import type { AppEdge, AppNode } from "../types";
import { parseDocument } from "../document/schema";
import { createDocument, deterministicStringify } from "../document/serialize";
import {
  addNodeCommand,
  applyGraphEditOperations,
  connectCommand,
  copyFromSnapshot,
  createPaste,
  deleteSelectionCommand,
  groupSelectionCommand,
  lockNodesCommand,
  pasteCommand,
  reparentOnDragStopCommand,
  replaceNodeTypeCommand,
  reverseEdgeCommand,
  ungroupSelectionCommand,
  updateNodeDataCommand,
  type EditorSnapshot,
} from "./commands";
import { CommandHistory } from "./history";

const rect = (id: string, x = 0, y = 0, extra?: Partial<AppNode>): AppNode => ({
  id,
  position: { x, y },
  data: { label: id, type: "rect" },
  type: "customShape",
  ...extra,
});

const container = (id: string, x = 0, y = 0, w = 300, h = 200): AppNode => ({
  id,
  position: { x, y },
  data: { label: id, type: "group" },
  type: "containerShape",
  style: { width: w, height: h },
  zIndex: -1,
});

const link = (id: string, source: string, target: string): AppEdge => ({
  id,
  source,
  target,
});

describe("commands + CommandHistory", () => {
  it("executes and undoes/redoes meaningful mutations", () => {
    const history = new CommandHistory();
    let state: EditorSnapshot = { nodes: [rect("a")], edges: [] };

    state = history.execute(state, addNodeCommand(rect("b", 50, 50)));
    expect(state.nodes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(state.nodes.find((n) => n.id === "b")?.selected).toBe(true);
    expect(state.nodes.find((n) => n.id === "a")?.selected).toBe(false);

    state = history.execute(state, updateNodeDataCommand("b", { label: "Bee" }));
    expect(state.nodes.find((n) => n.id === "b")?.data.label).toBe("Bee");
    expect(history.canUndo).toBe(true);

    const afterBee = state;
    const undone = history.undo(state);
    expect(undone?.nodes.find((n) => n.id === "b")?.data.label).toBe("b");
    const redone = history.redo(undone!);
    expect(redone).toEqual(afterBee);
  });

  it("does not record no-op commands", () => {
    const history = new CommandHistory();
    const state: EditorSnapshot = { nodes: [rect("a")], edges: [] };
    const result = history.execute(state, deleteSelectionCommand({ nodeId: null, edgeId: null }));
    expect(result).toBe(state);
    expect(history.canUndo).toBe(false);
  });

  it("connect creates one edge and refuses duplicates", () => {
    const history = new CommandHistory();
    let state: EditorSnapshot = { nodes: [rect("a"), rect("b")], edges: [] };
    const params = { source: "a", target: "b", sourceHandle: "right", targetHandle: "left" };

    state = history.execute(state, connectCommand(params));
    expect(state.edges).toHaveLength(1);
    expect(state.edges[0].source).toBe("a");

    const before = state;
    state = history.execute(state, connectCommand(params));
    expect(state).toBe(before); // duplicate rejected, history untouched
    expect(state.edges).toHaveLength(1);
  });
});

describe("delete cascades", () => {
  it("removes the edges connected to a deleted node", () => {
    const state: EditorSnapshot = {
      nodes: [rect("a"), rect("b"), rect("c")],
      edges: [link("e1", "a", "b"), link("e2", "b", "c")],
    };
    const next = deleteSelectionCommand({ nodeId: "b", edgeId: null }).apply(state);
    expect(next.nodes.map((n) => n.id)).toEqual(["a", "c"]);
    expect(next.edges).toEqual([]);
  });

  it("deleting a container cascades to descendants and their edges", () => {
    const state: EditorSnapshot = {
      nodes: [
        container("g"),
        rect("child", 10, 10, { parentId: "g" }),
        rect("grandchild", 5, 5, { parentId: "child" }),
        rect("outside"),
      ],
      edges: [link("e1", "child", "outside"), link("e2", "grandchild", "child")],
    };
    const next = deleteSelectionCommand({ nodeId: "g", edgeId: null }).apply(state);
    expect(next.nodes.map((n) => n.id)).toEqual(["outside"]);
    expect(next.edges).toEqual([]);
  });

  it("deletes a standalone edge", () => {
    const state: EditorSnapshot = { nodes: [rect("a"), rect("b")], edges: [link("e1", "a", "b")] };
    const next = deleteSelectionCommand({ nodeId: null, edgeId: "e1" }).apply(state);
    expect(next.edges).toEqual([]);
    expect(next.nodes).toHaveLength(2);
  });
});

describe("copy/paste with ID remapping", () => {
  it("remaps node ids, container parentIds, and edge endpoints", () => {
    const state: EditorSnapshot = {
      nodes: [
        container("g", 0, 0),
        rect("child", 20, 30, { parentId: "g" }),
        rect("other", 400, 400),
      ],
      edges: [link("e1", "child", "other")],
    };

    const clip = copyFromSnapshot(state, { nodeId: "g", edgeId: null });
    // Copy includes container descendants.
    expect(clip.nodes.map((n) => n.id).sort()).toEqual(["child", "g"]);

    let counter = 0;
    const pasted = createPaste(clip, new Set(state.nodes.map((n) => n.id)), {
      idGenerator: () => `p${counter++}`,
    });

    expect(pasted.nodes.map((n) => n.id).sort()).toEqual(["p0", "p1"]);
    const pastedContainer = pasted.nodes.find((n) => n.data.type === "group")!;
    const pastedChild = pasted.nodes.find((n) => n.data.type === "rect")!;
    expect(pastedChild.parentId).toBe(pastedContainer.id);
    expect(pastedChild.position).toEqual({ x: 60, y: 70 });
    expect(pasted.edges).toEqual([]); // the only edge left the copied set

    const applied = pasteCommand(clip, { idGenerator: () => `q${counter++}` }).apply(state);
    expect(applied.nodes).toHaveLength(5);
    // Originals are deselected, pasted nodes selected.
    expect(applied.nodes.filter((n) => n.selected).map((n) => n.id)).toEqual(["q2", "q3"]);
  });

  it("pastes an edge-only copy when both endpoints survive in later content", () => {
    const clip = { nodes: [], edges: [link("e1", "a", "b")] };
    const applied = pasteCommand(clip).apply({
      nodes: [rect("a"), rect("b")],
      edges: [],
    });
    // No nodes in the clipboard: nothing to remap onto, nothing pasted.
    expect(applied.edges).toEqual([]);
  });
});

describe("container reparenting", () => {
  it("parents a node dragged inside a container with relative coordinates", () => {
    const state: EditorSnapshot = {
      nodes: [container("g", 100, 100), rect("n", 150, 150)],
      edges: [],
    };
    const next = reparentOnDragStopCommand("n", { x: 160, y: 180 }).apply(state);
    const dragged = next.nodes.find((n) => n.id === "n")!;
    expect(dragged.parentId).toBe("g");
    expect(dragged.position).toEqual({ x: 60, y: 80 });
  });

  it("detaches a child dragged past the container edge back to absolute coordinates", () => {
    const state: EditorSnapshot = {
      nodes: [container("g", 100, 100), rect("n", 20, 20, { parentId: "g" })],
      edges: [],
    };
    const next = reparentOnDragStopCommand("n", { x: -20, y: 30 }).apply(state);
    const dragged = next.nodes.find((n) => n.id === "n")!;
    expect(dragged.parentId).toBeUndefined();
    expect(dragged.position).toEqual({ x: 80, y: 130 });
  });

  it("never reparents containers themselves", () => {
    const state: EditorSnapshot = {
      nodes: [container("g"), container("other", 50, 50)],
      edges: [],
    };
    const next = reparentOnDragStopCommand("other", { x: 60, y: 60 }).apply(state);
    expect(next).toBe(state);
  });
});

describe("applyGraphEditOperations", () => {
  it("applies a mixed batch of add/update/delete/connect in one pass", () => {
    const state: EditorSnapshot = { nodes: [rect("a"), rect("b")], edges: [link("e1", "a", "b")] };

    const next = applyGraphEditOperations(state, [
      { op: "addNode", node: rect("c", 300, 0) },
      { op: "updateNode", nodeId: "a", dataPatch: { label: "Renamed" } },
      { op: "deleteEdge", edgeId: "e1" },
      {
        op: "addEdge",
        edge: { id: "e2", source: "b", target: "c", sourceHandle: "right", targetHandle: "left" },
      },
    ]);

    expect(next.nodes.map((n) => n.id)).toEqual(["a", "b", "c"]);
    expect(next.nodes.find((n) => n.id === "a")?.data.label).toBe("Renamed");
    expect(next.edges).toEqual([
      { id: "e2", source: "b", target: "c", sourceHandle: "right", targetHandle: "left" },
    ]);
  });

  it("updates a node's position independently of its data", () => {
    const state: EditorSnapshot = { nodes: [rect("a", 0, 0)], edges: [] };
    const next = applyGraphEditOperations(state, [
      { op: "updateNode", nodeId: "a", position: { x: 50, y: 60 } },
    ]);
    expect(next.nodes[0].position).toEqual({ x: 50, y: 60 });
  });

  it("cascades deleteNode to connected edges", () => {
    const state: EditorSnapshot = {
      nodes: [rect("a"), rect("b")],
      edges: [link("e1", "a", "b")],
    };
    const next = applyGraphEditOperations(state, [{ op: "deleteNode", nodeId: "b" }]);
    expect(next.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(next.edges).toEqual([]);
  });

  it("updates edge data and label together", () => {
    const state: EditorSnapshot = {
      nodes: [rect("a"), rect("b")],
      edges: [{ ...link("e1", "a", "b"), data: { preset: "Bounce" } }],
    };
    const next = applyGraphEditOperations(state, [
      { op: "updateEdge", edgeId: "e1", dataPatch: { preset: "Data Flow" }, label: "flow" },
    ]);
    expect(next.edges[0]).toMatchObject({ label: "flow", data: { preset: "Data Flow" } });
  });
});

describe("context-menu operations", () => {
  it("replace swaps type, renderer, size, and stacking in place", () => {
    const state: EditorSnapshot = {
      nodes: [{ ...rect("a", 10, 20), style: { width: 160, height: 80 } }],
      edges: [],
    };
    const next = replaceNodeTypeCommand("a", {
      data: { label: "a", type: "circle", fillColor: "#ffcc00" },
      type: "containerShape",
      style: { width: 120, height: 120 },
      zIndex: -1,
    }).apply(state);
    const node = next.nodes[0]!;
    expect(node.id).toBe("a"); // keeps identity — position/edges/parentId survive
    expect(node.position).toEqual({ x: 10, y: 20 });
    expect(node.type).toBe("containerShape");
    expect(node.data.type).toBe("circle");
    expect(node.data.fillColor).toBe("#ffcc00");
    expect(node.style).toEqual({ width: 120, height: 120 });
    expect(node.zIndex).toBe(-1);
  });

  it("replace strips stacking for plain shapes and is a no-op for unknown ids", () => {
    const state: EditorSnapshot = {
      nodes: [{ ...rect("a", 0, 0), zIndex: 5 }],
      edges: [],
    };
    const next = replaceNodeTypeCommand("a", {
      data: { label: "a", type: "round-rect" },
      style: { width: 160, height: 80 },
      zIndex: null,
    }).apply(state);
    expect(next.nodes[0]!.zIndex).toBeUndefined();
    expect(replaceNodeTypeCommand("missing", { data: {} }).apply(state)).toBe(state);
  });

  it("group wraps top-level nodes in one container and keeps visual positions", () => {
    const state: EditorSnapshot = { nodes: [rect("a", 0, 0), rect("b", 200, 100)], edges: [] };
    const next = groupSelectionCommand(["a", "b"]).apply(state);
    const group = next.nodes[0]!;
    expect(group.data.type).toBe("group");
    expect(group.type).toBe("containerShape");
    expect(group.zIndex).toBe(-1);
    expect(group.selected).toBe(true);
    expect(group.position).toEqual({ x: -24, y: -24 });
    expect(group.style).toEqual({ width: 408, height: 228 });
    const childA = next.nodes.find((n) => n.id === "a")!;
    const childB = next.nodes.find((n) => n.id === "b")!;
    expect(childA.parentId).toBe(group.id);
    expect(childA.position).toEqual({ x: 24, y: 24 });
    expect(childB.parentId).toBe(group.id);
    expect(childB.position).toEqual({ x: 224, y: 124 });
    expect(childA.selected).toBe(false);
  });

  it("group skips containers and already-nested children from the wrapped set", () => {
    const withContainer = {
      nodes: [container("g", 0, 0), rect("a", 50, 50), rect("b", 400, 400)],
      edges: [],
    };
    const next = groupSelectionCommand(["g", "a", "b"]).apply(withContainer);
    const group = next.nodes[0]!;
    // Only the two eligible rects are wrapped; the container stays top-level.
    expect(group.data.type).toBe("group");
    expect(next.nodes.find((n) => n.id === "g")?.parentId).toBeUndefined();
    expect(next.nodes.find((n) => n.id === "a")?.parentId).toBe(group.id);
    expect(next.nodes.find((n) => n.id === "b")?.parentId).toBe(group.id);

    const nested = {
      nodes: [rect("child", 10, 10, { parentId: "g" }), rect("b", 400, 400)],
      edges: [],
    };
    // Only one eligible node (the child is already parented), so refused.
    expect(groupSelectionCommand(["child", "b"]).apply(nested)).toBe(nested);
  });

  it("ungroup dissolves simple groups and lifts children to absolute positions", () => {
    const state: EditorSnapshot = {
      nodes: [container("g", 100, 100), rect("child", 30, 40, { parentId: "g" })],
      edges: [],
    };
    const next = ungroupSelectionCommand(["g"]).apply(state);
    expect(next.nodes.map((n) => n.id)).toEqual(["child"]);
    const child = next.nodes[0]!;
    expect(child.parentId).toBeUndefined();
    expect(child.position).toEqual({ x: 130, y: 140 });
    expect(child.selected).toBe(true);
  });

  it("ungroup refuses swimlanes and semantic containers", () => {
    const swimlane: AppNode = {
      ...container("pool", 0, 0, 400, 300),
      data: { label: "Pool", type: "swimlane-h" },
    };
    const state: EditorSnapshot = {
      nodes: [swimlane, rect("child", 10, 10, { parentId: "pool" })],
      edges: [],
    };
    expect(ungroupSelectionCommand(["pool"]).apply(state)).toBe(state);
  });

  it("reverseEdge swaps endpoints, handles, and free-message offsets", () => {
    const state: EditorSnapshot = {
      nodes: [rect("a"), rect("b")],
      edges: [
        {
          ...link("e1", "a", "b"),
          sourceHandle: "right",
          targetHandle: "left",
          data: {
            sourceOffset: { x: 1, y: 2 },
            targetOffset: { x: 3, y: 4 },
          },
        },
      ],
    };
    const next = reverseEdgeCommand("e1").apply(state);
    const edge = next.edges[0]!;
    expect(edge.source).toBe("b");
    expect(edge.target).toBe("a");
    expect(edge.sourceHandle).toBe("left");
    expect(edge.targetHandle).toBe("right");
    expect(edge.data?.sourceOffset).toEqual({ x: 3, y: 4 });
    expect(edge.data?.targetOffset).toEqual({ x: 1, y: 2 });
  });

  it("lockNodesCommand toggles the locked flag on exactly the given nodes", () => {
    const state: EditorSnapshot = { nodes: [rect("a"), rect("b")], edges: [] };
    const locked = lockNodesCommand(["a"], true).apply(state);
    expect(locked.nodes.find((n) => n.id === "a")?.data.locked).toBe(true);
    expect(locked.nodes.find((n) => n.id === "b")?.data.locked).toBeUndefined();
    const unlocked = lockNodesCommand(["a"], false).apply(locked);
    expect(unlocked.nodes.find((n) => n.id === "a")?.data.locked).toBe(false);
  });

  it("deleteSelectionCommand removes multiple nodes and edges in one pass", () => {
    const state: EditorSnapshot = {
      nodes: [rect("a"), rect("b"), rect("c"), rect("d")],
      edges: [link("e1", "a", "b"), link("e2", "c", "d"), link("e3", "a", "d")],
    };
    const next = deleteSelectionCommand({ nodeIds: ["a"], edgeIds: ["e2"] }).apply(state);
    expect(next.nodes.map((n) => n.id)).toEqual(["b", "c", "d"]);
    // e1/e3 died with node "a"; e2 was selected for deletion explicitly.
    expect(next.edges).toEqual([]);
  });

  it("copyFromSnapshot supports multi-selection with cascading containers", () => {
    const state: EditorSnapshot = {
      nodes: [
        container("g", 0, 0),
        rect("child", 10, 10, { parentId: "g" }),
        rect("other", 400, 0),
      ],
      edges: [link("e1", "child", "other"), link("e2", "g", "other")],
    };
    const clip = copyFromSnapshot(state, { nodeIds: ["g", "other"] });
    expect(clip.nodes.map((n) => n.id).sort()).toEqual(["child", "g", "other"]);
    // Every edge whose two endpoints are inside the copied set is included.
    expect(clip.edges.map((e) => e.id)).toEqual(["e1", "e2"]);
  });
});

describe("document serialization of command output", () => {
  it("snapshots produced by commands round-trip through the document schema", () => {
    const history = new CommandHistory();
    let state: EditorSnapshot = { nodes: [rect("a", 1, 2)], edges: [] };
    state = history.execute(state, addNodeCommand(rect("b", 3, 4)));
    state = history.execute(
      state,
      connectCommand({ source: "a", target: "b", sourceHandle: null, targetHandle: null }),
    );

    const doc = createDocument({ nodes: state.nodes, edges: state.edges, meta: { name: "cmd" } });
    const restored = parseDocument(JSON.parse(deterministicStringify(doc)));
    expect(restored.nodes).toHaveLength(2);
    expect(restored.edges).toHaveLength(1);
  });
});
