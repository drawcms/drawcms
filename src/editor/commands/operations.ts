import type { AppEdge, AppNode } from "../types";
import { ALL_CONTAINER_TYPES } from "../constants";
import { generateId } from "../lib/id";

/** The serializable editor state every command reads and rewrites. */
export interface EditorSnapshot {
  nodes: AppNode[];
  edges: AppEdge[];
}

export interface ClipboardPayload {
  nodes: AppNode[];
  edges: AppEdge[];
}

/** Node ids that disappear together: the roots plus all container descendants. */
export function selectCascadeNodeIds(nodes: AppNode[], rootIds: ReadonlySet<string>): Set<string> {
  const ids = new Set(rootIds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of nodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        grew = true;
      }
    }
  }
  return ids;
}

/**
 * Deleting a node removes its connected edges. Deleting a container also
 * removes every descendant and their edges (recursive cascade).
 */
export function deleteNodesFromSnapshot(
  state: EditorSnapshot,
  nodeIds: Iterable<string>,
): EditorSnapshot {
  const ids = selectCascadeNodeIds(state.nodes, new Set(nodeIds));
  if (ids.size === 0) return state;
  return {
    nodes: state.nodes.filter((node) => !ids.has(node.id)),
    edges: state.edges.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target)),
  };
}

export function deleteEdgeFromSnapshot(state: EditorSnapshot, edgeId: string): EditorSnapshot {
  if (!state.edges.some((edge) => edge.id === edgeId)) return state;
  return { ...state, edges: state.edges.filter((edge) => edge.id !== edgeId) };
}

/**
 * Copy includes the selection plus every container descendant, so a pasted
 * group stays intact. When a single edge is selected the edge is copied on
 * its own (it is reattached to pasted nodes when possible). Multi-selection
 * is expressed with `nodeIds` / `edgeIds`; the singular fields select exactly
 * one element and remain the primary public-API path.
 */
export function copyFromSnapshot(
  state: EditorSnapshot,
  selection: {
    nodeId?: string | null;
    edgeId?: string | null;
    nodeIds?: readonly string[];
    edgeIds?: readonly string[];
  },
): ClipboardPayload {
  const nodeIds = selection.nodeIds ?? (selection.nodeId ? [selection.nodeId] : []);
  if (nodeIds.length > 0) {
    const ids = selectCascadeNodeIds(state.nodes, new Set(nodeIds));
    const idSet = (edge: AppEdge) => ids.has(edge.source) && ids.has(edge.target);
    const edgeIds = new Set(selection.edgeIds ?? []);
    return {
      nodes: state.nodes.filter((node) => ids.has(node.id)),
      edges: state.edges.filter((edge) => idSet(edge) || edgeIds.has(edge.id)),
    };
  }
  const explicitEdgeIds = selection.edgeIds ?? (selection.edgeId ? [selection.edgeId] : []);
  if (explicitEdgeIds.length > 0) {
    const ids = new Set(explicitEdgeIds);
    return {
      nodes: [],
      edges: state.edges.filter((edge) => ids.has(edge.id)),
    };
  }
  return { nodes: [], edges: [] };
}

const GROUP_PADDING = 24;

function nodeExtent(node: AppNode): { width: number; height: number } {
  const measured = node.measured as { width?: number; height?: number } | undefined;
  return {
    width: Number(node.style?.width ?? measured?.width ?? 160),
    height: Number(node.style?.height ?? measured?.height ?? 80),
  };
}

/**
 * Wrap the given top-level, non-container nodes in one new group container.
 * Children keep their visual position (converted to group-relative) and their
 * edges. Grouping is refused unless at least two eligible nodes are given.
 */
export function groupNodesInSnapshot(
  state: EditorSnapshot,
  nodeIds: readonly string[],
): EditorSnapshot {
  const ids = new Set(nodeIds);
  const targets = state.nodes.filter(
    (node) => ids.has(node.id) && !node.parentId && !ALL_CONTAINER_TYPES.has(node.data.type),
  );
  if (targets.length < 2) return state;

  const bounds = targets.reduce(
    (box, node) => {
      const { width, height } = nodeExtent(node);
      return {
        left: Math.min(box.left, node.position.x),
        top: Math.min(box.top, node.position.y),
        right: Math.max(box.right, node.position.x + width),
        bottom: Math.max(box.bottom, node.position.y + height),
      };
    },
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
  );
  const groupPosition = {
    x: bounds.left - GROUP_PADDING,
    y: bounds.top - GROUP_PADDING,
  };
  const group: AppNode = {
    id: `group-${generateId()}`,
    position: groupPosition,
    data: { label: "Group", type: "group" },
    type: "containerShape",
    zIndex: -1,
    style: {
      width: bounds.right - bounds.left + GROUP_PADDING * 2,
      height: bounds.bottom - bounds.top + GROUP_PADDING * 2,
    },
    selected: true,
  };

  const targetIds = new Set(targets.map((node) => node.id));
  const nodes = state.nodes.map((node) => {
    if (!targetIds.has(node.id)) return { ...node, selected: false };
    return {
      ...node,
      parentId: group.id,
      position: {
        x: node.position.x - groupPosition.x,
        y: node.position.y - groupPosition.y,
      },
      selected: false,
    };
  });
  return { ...state, nodes: [group, ...nodes] };
}

/** Containers the "Ungroup" action may dissolve (swimlanes keep their lanes). */
export const GROUPABLE_CONTAINER_TYPES = new Set(["group", "dashed-box"]);

/**
 * Dissolve the given simple group/dashed-box containers: children regain
 * absolute positions and the selection, and the container is removed. Swim-
 * lanes and semantic containers carry lane/section structure and are refused.
 */
export function ungroupContainersInSnapshot(
  state: EditorSnapshot,
  containerIds: readonly string[],
): EditorSnapshot {
  const ids = new Set(containerIds);
  const containers = state.nodes.filter(
    (node) => ids.has(node.id) && GROUPABLE_CONTAINER_TYPES.has(node.data.type),
  );
  if (containers.length === 0) return state;
  const containerById = new Map(containers.map((node) => [node.id, node]));

  const nodes: AppNode[] = [];
  for (const node of state.nodes) {
    if (ids.has(node.id)) continue;
    const parent = node.parentId ? containerById.get(node.parentId) : undefined;
    if (parent) {
      nodes.push({
        ...node,
        parentId: undefined,
        position: {
          x: parent.position.x + node.position.x,
          y: parent.position.y + node.position.y,
        },
        selected: true,
      });
    } else {
      nodes.push({ ...node, selected: false });
    }
  }
  return { ...state, nodes };
}

/** Swap an edge's direction, including handles and free-message offsets. */
export function reverseEdgeInSnapshot(state: EditorSnapshot, edgeId: string): EditorSnapshot {
  return {
    ...state,
    edges: state.edges.map((edge) => {
      if (edge.id !== edgeId) return edge;
      return {
        ...edge,
        source: edge.target,
        target: edge.source,
        sourceHandle: edge.targetHandle,
        targetHandle: edge.sourceHandle,
        data: {
          ...edge.data,
          sourceOffset: edge.data?.targetOffset,
          targetOffset: edge.data?.sourceOffset,
        },
      };
    }),
  };
}

/**
 * Swap a node's element type in place (context menu "Replace"): data, renderer
 * type, size, and stacking come from the caller — the node keeps its id, so
 * position, container membership, selection, and connected edges survive.
 * A `null` zIndex strips the field (plain shapes never set one).
 */
export function replaceNodeInSnapshot(
  state: EditorSnapshot,
  nodeId: string,
  patch: {
    data: Record<string, unknown>;
    type?: string;
    style?: Record<string, number>;
    zIndex?: number | null;
  },
): EditorSnapshot {
  if (!state.nodes.some((node) => node.id === nodeId)) return state;
  return {
    ...state,
    nodes: state.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        data: patch.data as typeof node.data,
        style: patch.style,
        zIndex: patch.zIndex ?? undefined,
      };
    }),
  };
}

export interface PasteOptions {
  offset?: number;
  idGenerator?: () => string;
}

/**
 * Paste remaps every id (nodes, container parentIds, edge endpoints) so a
 * paste can never collide with live or previously pasted elements.
 */
export function createPaste(
  clip: ClipboardPayload,
  existingIds: ReadonlySet<string>,
  options?: PasteOptions,
): { nodes: AppNode[]; edges: AppEdge[] } {
  const offset = options?.offset ?? 40;
  const idGenerator = options?.idGenerator ?? generateId;
  const idMap = new Map<string, string>();
  const usedIds = new Set(existingIds);
  const freshId = () => {
    let id = idGenerator();
    while (usedIds.has(id)) id = idGenerator();
    usedIds.add(id);
    return id;
  };

  const nodes = clip.nodes.map((node) => {
    const id = freshId();
    idMap.set(node.id, id);
    return { ...node, id, position: { x: node.position.x + offset, y: node.position.y + offset } };
  });
  // Second pass: parentId remapping needs the complete map.
  const remapped = nodes.map((node) => ({
    ...node,
    parentId: node.parentId ? idMap.get(node.parentId) : undefined,
    selected: true as const,
  }));
  const edges = clip.edges
    .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
    .map((edge) => ({
      ...edge,
      id: `e${freshId()}`,
      source: idMap.get(edge.source)!,
      target: idMap.get(edge.target)!,
    }));
  return { nodes: remapped, edges };
}

/** Hit-test and reparenting rules shared by drag-stop and drop handlers. */
export function findDropContainer(
  nodes: AppNode[],
  position: { x: number; y: number },
  excludeId?: string,
): AppNode | undefined {
  return nodes.find((node) => {
    if (node.id === excludeId) return false;
    if (!ALL_CONTAINER_TYPES.has(node.data.type)) return false;
    if (node.parentId) return false;
    const w = Number(node.style?.width || 300);
    const h = Number(node.style?.height || 200);
    return (
      position.x >= node.position.x &&
      position.x <= node.position.x + w &&
      position.y >= node.position.y &&
      position.y <= node.position.y + h
    );
  });
}

/**
 * Dragging a non-container node inside a container parents it and converts
 * its position to container-relative. Dragging a child past the container's
 * edge detaches it back to absolute coordinates.
 */
export function reparentOnDragStop(
  state: EditorSnapshot,
  nodeId: string,
  position: { x: number; y: number },
): EditorSnapshot {
  const dragged = state.nodes.find((node) => node.id === nodeId);
  if (!dragged || ALL_CONTAINER_TYPES.has(dragged.data.type)) return state;

  if (dragged.parentId) {
    const parent = state.nodes.find((node) => node.id === dragged.parentId);
    if (!parent) return state;
    const pw = Number(parent.style?.width || 300);
    const ph = Number(parent.style?.height || 200);
    const margin = 10;
    const atEdge =
      position.x <= -margin ||
      position.y <= -margin ||
      position.x >= pw - margin ||
      position.y >= ph - margin;
    if (!atEdge) return state;
    const absolute = { x: parent.position.x + position.x, y: parent.position.y + position.y };
    return {
      ...state,
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, position: absolute, parentId: undefined } : node,
      ),
    };
  }

  const container = findDropContainer(state.nodes, position, nodeId);
  if (!container) return state;
  const relative = {
    x: position.x - container.position.x,
    y: position.y - container.position.y,
  };
  return {
    ...state,
    nodes: state.nodes.map((node) =>
      node.id === nodeId ? { ...node, position: relative, parentId: container.id } : node,
    ),
  };
}
