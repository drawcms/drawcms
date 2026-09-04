import { SEQUENCE_LIFELINE_TYPES } from "../sequence-edges";
import type { VisualDiagramType } from "./visual-grammar";

export interface LayoutNode {
  id: string;
  type: string;
  width: number;
  height: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export interface LayoutPosition {
  x: number;
  y: number;
  /** Sequence lifelines get a uniform stretch height regardless of label length. */
  height?: number;
}

/**
 * Diagram types with a directional flow that layered left-to-right ranking
 * suits. Everything else (general, uml, bpmn, entity-relationship, and any
 * graph containing a real multi-node cycle) falls back to the grid — those
 * notations do not have one dominant flow axis, and forcing a rank onto
 * them would misrepresent the diagram rather than clarify it.
 */
const LAYERED_DIAGRAM_TYPES = new Set<VisualDiagramType>([
  "flowchart",
  "architecture",
  "data-flow",
  "lifecycle",
]);

const RANK_GAP = 120;
const LANE_GAP = 40;
const LIFELINE_GAP = 100;
const GRID_MARGIN_X = 120;
const GRID_MARGIN_Y = 100;
const GRID_COLUMN_GAP = 260;
const GRID_ROW_GAP = 180;

/**
 * Shared sequence-diagram geometry. Exported so callers that need to derive
 * a position from row numbers (activation bars in webmcp/tools.ts; see also
 * the equivalent math in document/templates.ts) use the exact same lifeline
 * band this module lays lifelines out in.
 */
export const SEQUENCE_LIFELINE_Y = 40;
export const SEQUENCE_LIFELINE_HEIGHT = 620;

/**
 * Automatic node placement for `drawcms_replace_diagram`, used only for
 * nodes the agent did not supply an explicit position for. Positions are
 * computed once from structure (diagram type + edges), never mutating input.
 *
 * - `sequence`: actor/participant lifelines are placed in columns ordered by
 *   first appearance in the edge list, at uniform height. Other sequence
 *   primitives (activations, notes, frames) are not positioned here — they
 *   depend on the message rows assigned during sequence edge construction
 *   and are positioned there instead (see sequence-edges.ts and
 *   createDocumentFromWebMCP's sequence handling).
 * - `flowchart` / `architecture` / `data-flow` / `lifecycle`: nodes are
 *   ranked by longest path from a source over the edge set (a topological
 *   layering), placed left-to-right by rank and top-to-bottom within a rank,
 *   with a single barycenter sweep to reduce connector crossings.
 * - Everything else, and any graph containing a real cycle: a grid, matching
 *   prior behavior.
 */
export function layoutNodes(
  diagramType: VisualDiagramType,
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): Map<string, LayoutPosition> {
  if (diagramType === "sequence") return layoutSequenceLifelines(nodes, edges);
  if (LAYERED_DIAGRAM_TYPES.has(diagramType)) {
    const layered = layoutLayered(nodes, edges);
    if (layered) return layered;
  }
  return layoutGrid(nodes);
}

function layoutGrid(nodes: LayoutNode[]): Map<string, LayoutPosition> {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const positions = new Map<string, LayoutPosition>();
  nodes.forEach((node, index) => {
    positions.set(node.id, {
      x: GRID_MARGIN_X + (index % columns) * GRID_COLUMN_GAP,
      y: GRID_MARGIN_Y + Math.floor(index / columns) * GRID_ROW_GAP,
    });
  });
  return positions;
}

function layoutSequenceLifelines(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): Map<string, LayoutPosition> {
  const lifelines = nodes.filter((node) => SEQUENCE_LIFELINE_TYPES.has(node.type));
  const appearanceOrder = new Map<string, number>();
  let order = 0;
  for (const edge of edges) {
    if (!appearanceOrder.has(edge.source)) appearanceOrder.set(edge.source, order++);
    if (!appearanceOrder.has(edge.target)) appearanceOrder.set(edge.target, order++);
  }
  for (const node of lifelines) {
    if (!appearanceOrder.has(node.id)) appearanceOrder.set(node.id, order++);
  }
  const ordered = [...lifelines].sort(
    (a, b) => (appearanceOrder.get(a.id) ?? 0) - (appearanceOrder.get(b.id) ?? 0),
  );

  const positions = new Map<string, LayoutPosition>();
  let x = GRID_MARGIN_X;
  for (const lifeline of ordered) {
    positions.set(lifeline.id, { x, y: SEQUENCE_LIFELINE_Y, height: SEQUENCE_LIFELINE_HEIGHT });
    x += lifeline.width + LIFELINE_GAP;
  }
  return positions;
}

/**
 * Longest-path layering (a simplified Sugiyama-style layout): rank every
 * node by the longest directed path reaching it, place ranks left to right,
 * and stack nodes within a rank top to bottom. Returns null when the edge
 * set contains a real multi-node cycle, since longest-path ranking is
 * undefined there — callers fall back to the grid.
 */
function layoutLayered(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): Map<string, LayoutPosition> | null {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  // Self-loops don't affect ranking and would trivially look like a cycle;
  // exclude them from the ranking graph but keep every node reachable.
  const structuralEdges = edges.filter(
    (edge) => edge.source !== edge.target && byId.has(edge.source) && byId.has(edge.target),
  );

  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const node of nodes) {
    outgoing.set(node.id, []);
    indegree.set(node.id, 0);
  }
  for (const edge of structuralEdges) {
    outgoing.get(edge.source)!.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  // Kahn's algorithm: a topological order that also detects cycles (any
  // node whose indegree never reaches zero means a cycle exists).
  const remainingIndegree = new Map(indegree);
  const queue: string[] = nodes
    .filter((node) => remainingIndegree.get(node.id) === 0)
    .map((n) => n.id);
  const topoOrder: string[] = [];
  let cursor = 0;
  while (cursor < queue.length) {
    const id = queue[cursor++];
    topoOrder.push(id);
    for (const next of outgoing.get(id) ?? []) {
      const remaining = (remainingIndegree.get(next) ?? 0) - 1;
      remainingIndegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }
  if (topoOrder.length !== nodes.length) return null; // a real cycle exists

  const rank = new Map<string, number>();
  for (const id of topoOrder) {
    const current = rank.get(id) ?? 0;
    for (const next of outgoing.get(id) ?? []) {
      rank.set(next, Math.max(rank.get(next) ?? 0, current + 1));
    }
    if (!rank.has(id)) rank.set(id, 0);
  }

  const layers = new Map<number, string[]>();
  for (const node of nodes) {
    const r = rank.get(node.id) ?? 0;
    const layer = layers.get(r) ?? [];
    layer.push(node.id);
    layers.set(r, layer);
  }
  const sortedRanks = [...layers.keys()].sort((a, b) => a - b);

  // Barycenter sweep: order each layer by the average lane index of its
  // already-placed predecessors, one downward pass. Isolated nodes and the
  // first layer keep their original (input) order.
  const laneIndex = new Map<string, number>();
  const predecessorsOf = new Map<string, string[]>();
  for (const edge of structuralEdges) {
    const list = predecessorsOf.get(edge.target) ?? [];
    list.push(edge.source);
    predecessorsOf.set(edge.target, list);
  }
  for (const r of sortedRanks) {
    const layer = layers.get(r)!;
    if (r === sortedRanks[0]) {
      layer.forEach((id, index) => laneIndex.set(id, index));
      continue;
    }
    const withBarycenter = layer.map((id) => {
      const predecessors = predecessorsOf.get(id) ?? [];
      const known = predecessors
        .map((p) => laneIndex.get(p))
        .filter((v): v is number => v !== undefined);
      const barycenter =
        known.length > 0 ? known.reduce((a, b) => a + b, 0) / known.length : Infinity;
      return { id, barycenter };
    });
    withBarycenter.sort((a, b) => a.barycenter - b.barycenter);
    withBarycenter.forEach(({ id }, index) => laneIndex.set(id, index));
    layers.set(
      r,
      withBarycenter.map((entry) => entry.id),
    );
  }

  // A single global rank spacing (the widest node overall) guarantees no
  // rank overlaps another regardless of which nodes land where.
  const maxWidth = Math.max(...nodes.map((node) => node.width), 0);
  const positions = new Map<string, LayoutPosition>();
  for (const r of sortedRanks) {
    const layer = layers.get(r)!;
    const x = GRID_MARGIN_X + r * (maxWidth + RANK_GAP);
    let y = GRID_MARGIN_Y;
    for (const id of layer) {
      const node = byId.get(id)!;
      positions.set(id, { x, y });
      y += node.height + LANE_GAP;
    }
  }
  return positions;
}
