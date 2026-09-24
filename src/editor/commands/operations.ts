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
 * Absolute canvas position of a node, walking up through container parents.
 * React Flow stores a child's `position` relative to its parent, so any code
 * that moves a node out of its container has to rebase it first.
 */
function absolutePosition(nodes: readonly AppNode[], node: AppNode): { x: number; y: number } {
  let { x, y } = node.position;
  const seen = new Set<string>([node.id]);
  let parentId = node.parentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = nodes.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

/**
 * Copy includes the selection plus every container descendant, so a pasted
 * group stays intact. When a single edge is selected the edge is copied on
 * its own (it is reattached to pasted nodes when possible). Multi-selection
 * is expressed with `nodeIds` / `edgeIds`; the singular fields select exactly
 * one element and remain the primary public-API path.
 *
 * Nodes whose container is *not* part of the copy are rebased to absolute
 * coordinates and detached. Without this a node copied out of a container kept
 * its parent-relative position but lost its `parentId` on paste, so it landed
 * at those relative coordinates read as absolute — far away from the element it
 * was copied from rather than beside it.
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
      nodes: state.nodes
        .filter((node) => ids.has(node.id))
        .map((node) => {
          if (!node.parentId || ids.has(node.parentId)) return node;
          const detached: AppNode = { ...node, position: absolutePosition(state.nodes, node) };
          delete detached.parentId;
          return detached;
        }),
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

/** Diagonal step used when a new element would land exactly on an existing one. */
const CASCADE_STEP = 28;

/**
 * First spot at or after `anchor` whose corner is not already occupied.
 *
 * New elements are placed at the centre of the visible canvas, so clicking
 * several palette entries in a row would drop them all on the same coordinate
 * and hide every one but the last. This steps diagonally away instead, the way a
 * window manager cascades new windows: each element keeps a visible corner to
 * grab, and the walk is short enough that nothing escapes the viewport.
 *
 * Only top-level nodes count as occupied — a child's position is relative to its
 * container, so it is not comparable to a canvas-space anchor.
 */
export function nextFreePosition(
  nodes: readonly AppNode[],
  anchor: { x: number; y: number },
  maxSteps = 12,
): { x: number; y: number } {
  const corners = nodes.filter((node) => !node.parentId).map((node) => node.position);
  const candidate = { ...anchor };
  for (let step = 0; step < maxSteps; step++) {
    const taken = corners.some(
      (corner) =>
        Math.abs(corner.x - candidate.x) < CASCADE_STEP &&
        Math.abs(corner.y - candidate.y) < CASCADE_STEP,
    );
    if (!taken) return candidate;
    candidate.x += CASCADE_STEP;
    candidate.y += CASCADE_STEP;
  }
  return candidate;
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
 * Re-point one end of an edge at a different node or handle.
 *
 * The id is preserved deliberately, and that is the whole reason this is a
 * mutation rather than delete-then-create. Motion presets and story step targets
 * are keyed by edge id: `reconcileMotionTargets` would see a new id as an
 * orphaned target, `sanitizeStory` would strip it, and any step whose only target
 * was this connector would be deleted outright — silent data loss from what the
 * user experienced as dragging an arrow.
 *
 * Endpoint-scoped geometry does not survive, because it describes an anchor that
 * no longer exists: the offset for the end that moved is dropped (following
 * `onSequenceEndpointChange`), and `bend` plus any precomputed `diagramRoute` go
 * too, since both are measured from endpoints that just changed. The offset for
 * the end that stayed put is kept.
 *
 * Returns the same state reference when nothing would change, so a drag that ends
 * where it started never lands in history.
 */
export function reconnectEdgeInSnapshot(
  state: EditorSnapshot,
  edgeId: string,
  endpoints: {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  },
): EditorSnapshot {
  const existing = state.edges.find((edge) => edge.id === edgeId);
  if (!existing) return state;

  const sourceHandle = endpoints.sourceHandle ?? null;
  const targetHandle = endpoints.targetHandle ?? null;
  const unchanged =
    existing.source === endpoints.source &&
    existing.target === endpoints.target &&
    (existing.sourceHandle ?? null) === sourceHandle &&
    (existing.targetHandle ?? null) === targetHandle;
  if (unchanged) return state;

  const sourceMoved =
    existing.source !== endpoints.source || (existing.sourceHandle ?? null) !== sourceHandle;
  const targetMoved =
    existing.target !== endpoints.target || (existing.targetHandle ?? null) !== targetHandle;

  return {
    ...state,
    edges: state.edges.map((edge) => {
      if (edge.id !== edgeId) return edge;
      const data = { ...edge.data };
      if (sourceMoved) delete data.sourceOffset;
      if (targetMoved) delete data.targetOffset;
      delete data.bend;
      delete data.diagramRoute;
      return {
        ...edge,
        source: endpoints.source,
        target: endpoints.target,
        sourceHandle,
        targetHandle,
        data,
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
  /**
   * Place the clip so the top-left of its bounding box lands here, instead of
   * offsetting from where it was copied. Used for paste-at-pointer.
   */
  at?: { x: number; y: number };
}

/**
 * Paste remaps every id (nodes, container parentIds, edge endpoints) so a
 * paste can never collide with live or previously pasted elements.
 *
 * Only root nodes are repositioned. A container's children are stored relative
 * to it, so translating them as well would shift them a second time *inside* an
 * already-moved parent and pull a pasted group apart.
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

  const clipIds = new Set(clip.nodes.map((node) => node.id));
  const isRoot = (node: AppNode) => !node.parentId || !clipIds.has(node.parentId);
  const roots = clip.nodes.filter(isRoot);
  const translation = (() => {
    if (!options?.at || roots.length === 0) return { x: offset, y: offset };
    const left = Math.min(...roots.map((node) => node.position.x));
    const top = Math.min(...roots.map((node) => node.position.y));
    return { x: options.at.x - left, y: options.at.y - top };
  })();

  const nodes = clip.nodes.map((node) => {
    const id = freshId();
    idMap.set(node.id, id);
    if (!isRoot(node)) return { ...node, id };
    return {
      ...node,
      id,
      position: { x: node.position.x + translation.x, y: node.position.y + translation.y },
    };
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
