import type { Connection } from "@xyflow/react";
import type { AppEdge, AppNode } from "../types";
import { ALL_CONTAINER_TYPES } from "../constants";
import { generateId } from "../lib/id";
import {
  createPaste,
  deleteEdgeFromSnapshot,
  deleteNodesFromSnapshot,
  groupNodesInSnapshot,
  reparentOnDragStop,
  replaceNodeInSnapshot,
  reverseEdgeInSnapshot,
  ungroupContainersInSnapshot,
  type ClipboardPayload,
  type EditorSnapshot,
  type PasteOptions,
} from "./operations";

export type { ClipboardPayload, EditorSnapshot, PasteOptions } from "./operations";
export {
  copyFromSnapshot,
  createPaste,
  deleteEdgeFromSnapshot,
  deleteNodesFromSnapshot,
  findDropContainer,
  groupNodesInSnapshot,
  GROUPABLE_CONTAINER_TYPES,
  reparentOnDragStop,
  replaceNodeInSnapshot,
  reverseEdgeInSnapshot,
  selectCascadeNodeIds,
  ungroupContainersInSnapshot,
} from "./operations";

/**
 * The explicit boundary every mutating editor action goes through (DM-012).
 * A command is a named, pure state transformation. Commands return the exact
 * same snapshot reference when nothing changes so history never records
 * incidental no-ops.
 */
export interface EditorCommand {
  readonly type: string;
  apply(snapshot: EditorSnapshot): EditorSnapshot;
}

export function addNodeCommand(node: AppNode): EditorCommand {
  return {
    type: "node.add",
    apply: (state) => {
      // Containers render behind everything else and are inserted first.
      const rest = state.nodes.map((n) => ({ ...n, selected: false }));
      const withSelection = { ...node, selected: true };
      return {
        nodes: ALL_CONTAINER_TYPES.has(node.data.type)
          ? [withSelection, ...rest]
          : [...rest, withSelection],
        edges: state.edges,
      };
    },
  };
}

export function updateNodeDataCommand(
  nodeId: string,
  patch: Record<string, unknown>,
  stylePatch?: Record<string, unknown>,
): EditorCommand {
  return {
    type: "node.updateData",
    apply: (state) => ({
      ...state,
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: { ...node.data, ...patch },
              ...(stylePatch ? { style: { ...node.style, ...stylePatch } } : {}),
            }
          : node,
      ),
    }),
  };
}

export function updateNodePositionCommand(
  nodeId: string,
  position: { x: number; y: number },
): EditorCommand {
  return {
    type: "node.updatePosition",
    apply: (state) => ({
      ...state,
      nodes: state.nodes.map((node) => (node.id === nodeId ? { ...node, position } : node)),
    }),
  };
}

/** Attach a fully-built edge (agent authoring; see webmcp/tools.ts `drawcms_edit_diagram`). */
export function addEdgeToSnapshotCommand(edge: AppEdge): EditorCommand {
  return {
    type: "edge.add",
    apply: (state) => ({ ...state, edges: [...state.edges, edge] }),
  };
}

/**
 * A batch of incremental graph edits (agent authoring; see
 * webmcp/tools.ts `drawcms_edit_diagram`). Each operation is a fully
 * resolved change — id validation, node construction, and sequence-row
 * assignment happen in the caller (the WebMCP tool), which has access to
 * the visual grammar and node factory. `applyGraphEditOperations` is the
 * single mechanical apply step shared by the hook and its tests.
 */
export type GraphEditOperation =
  | { op: "addNode"; node: AppNode }
  | {
      op: "updateNode";
      nodeId: string;
      dataPatch?: Record<string, unknown>;
      stylePatch?: Record<string, unknown>;
      position?: { x: number; y: number };
    }
  | { op: "deleteNode"; nodeId: string }
  | { op: "addEdge"; edge: AppEdge }
  | { op: "updateEdge"; edgeId: string; dataPatch?: Record<string, unknown>; label?: string }
  | { op: "deleteEdge"; edgeId: string };

export function applyGraphEditOperations(
  snapshot: EditorSnapshot,
  operations: GraphEditOperation[],
): EditorSnapshot {
  return operations.reduce((current, operation) => {
    switch (operation.op) {
      case "addNode":
        return addNodeCommand(operation.node).apply(current);
      case "updateNode": {
        const withData = updateNodeDataCommand(
          operation.nodeId,
          operation.dataPatch ?? {},
          operation.stylePatch,
        ).apply(current);
        return operation.position
          ? updateNodePositionCommand(operation.nodeId, operation.position).apply(withData)
          : withData;
      }
      case "deleteNode":
        return deleteNodesFromSnapshot(current, [operation.nodeId]);
      case "addEdge":
        return addEdgeToSnapshotCommand(operation.edge).apply(current);
      case "updateEdge":
        return updateEdgeDataCommand(operation.edgeId, {
          ...(operation.dataPatch ?? {}),
          ...(operation.label !== undefined ? { label: operation.label } : {}),
        }).apply(current);
      case "deleteEdge":
        return deleteEdgeFromSnapshot(current, operation.edgeId);
      default:
        return current;
    }
  }, snapshot);
}

export function updateEdgeDataCommand(
  edgeId: string,
  patch: Record<string, unknown>,
): EditorCommand {
  return {
    type: "edge.updateData",
    apply: (state) => ({
      ...state,
      edges: state.edges.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              ...(typeof patch.label === "string" ? { label: patch.label } : {}),
              data: { ...edge.data, ...patch },
            }
          : edge,
      ),
    }),
  };
}

export function connectCommand(params: Connection): EditorCommand {
  return {
    type: "edge.connect",
    apply: (state) => {
      const duplicate = state.edges.some(
        (edge) =>
          edge.source === params.source &&
          edge.target === params.target &&
          edge.sourceHandle === params.sourceHandle &&
          edge.targetHandle === params.targetHandle,
      );
      if (duplicate || !params.source || !params.target) return state;
      const edge: AppEdge = {
        id: `e${params.source}-${params.target}-${generateId()}`,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
      };
      return { ...state, edges: [...state.edges, edge] };
    },
  };
}

export function deleteSelectionCommand(selection: {
  nodeId?: string | null;
  edgeId?: string | null;
  nodeIds?: readonly string[];
  edgeIds?: readonly string[];
}): EditorCommand {
  return {
    type: "selection.delete",
    apply: (state) => {
      const nodeIds = selection.nodeIds ?? (selection.nodeId ? [selection.nodeId] : []);
      const afterNodes = nodeIds.length > 0 ? deleteNodesFromSnapshot(state, nodeIds) : state;
      const edgeIds = selection.edgeIds ?? (selection.edgeId ? [selection.edgeId] : []);
      return edgeIds.reduce(
        (current, edgeId) => deleteEdgeFromSnapshot(current, edgeId),
        afterNodes,
      );
    },
  };
}

export function replaceNodeTypeCommand(
  nodeId: string,
  patch: {
    data: Record<string, unknown>;
    type?: string;
    style?: Record<string, number>;
    zIndex?: number | null;
  },
): EditorCommand {
  return {
    type: "node.replace",
    apply: (state) => replaceNodeInSnapshot(state, nodeId, patch),
  };
}

export function groupSelectionCommand(nodeIds: readonly string[]): EditorCommand {
  return {
    type: "selection.group",
    apply: (state) => groupNodesInSnapshot(state, nodeIds),
  };
}

export function ungroupSelectionCommand(containerIds: readonly string[]): EditorCommand {
  return {
    type: "selection.ungroup",
    apply: (state) => ungroupContainersInSnapshot(state, containerIds),
  };
}

export function reverseEdgeCommand(edgeId: string): EditorCommand {
  return {
    type: "edge.reverse",
    apply: (state) => reverseEdgeInSnapshot(state, edgeId),
  };
}

export function lockNodesCommand(nodeIds: readonly string[], locked: boolean): EditorCommand {
  return {
    type: "node.lock",
    apply: (state) => {
      const ids = new Set(nodeIds);
      return {
        ...state,
        nodes: state.nodes.map((node) =>
          ids.has(node.id) ? { ...node, data: { ...node.data, locked } } : node,
        ),
      };
    },
  };
}

export function pasteCommand(clip: ClipboardPayload, options?: PasteOptions): EditorCommand {
  return {
    type: "clipboard.paste",
    apply: (state) => {
      if (clip.nodes.length === 0) return state;
      const existingIds = new Set(state.nodes.map((node) => node.id));
      const pasted = createPaste(clip, existingIds, options);
      return {
        nodes: [...state.nodes.map((node) => ({ ...node, selected: false })), ...pasted.nodes],
        edges: [...state.edges, ...pasted.edges],
      };
    },
  };
}

export function reparentOnDragStopCommand(
  nodeId: string,
  position: { x: number; y: number },
): EditorCommand {
  return {
    type: "node.reparent",
    apply: (state) => reparentOnDragStop(state, nodeId, position),
  };
}
