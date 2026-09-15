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

export interface LayoutOptions {
  /**
   * Spacing between consecutive ranks along the flow axis. A caller laying the
   * diagram out top-to-bottom passes `VERTICAL_RANK_GAP`, since the horizontal
   * default reserves room for a label box lying beside the connector rather
   * than above it.
   */
  rankGap?: number;
}

/**
 * Diagram types with a directional flow that layered left-to-right ranking
 * suits. Feedback edges are excluded from ranking and routed separately.
 */
const LAYERED_DIAGRAM_TYPES = new Set<VisualDiagramType>([
  "flowchart",
  "architecture",
  "data-flow",
  "lifecycle",
  "bpmn",
  "entity-relationship",
  "database-model",
  "uml",
]);

const RANK_GAP = 240;
/**
 * Rank spacing along a vertical flow.
 *
 * A connector label is a wide, short box. Laid out along a horizontal flow it
 * needs the full `RANK_GAP` of channel to sit beside the line; stacked along a
 * vertical flow it only needs a couple of text lines. Reusing the horizontal
 * figure transposed stretched a ten-step process over thousands of pixels of
 * empty canvas and forced the camera so far out that nothing was legible.
 */
export const VERTICAL_RANK_GAP = 110;
const LANE_GAP = 100;
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
 * - BPMN, UML and data models use layers too; use cases separate actors.
 * - General diagrams use a size-aware grid. Feedback edges retain forward ranks.
 */
export function layoutNodes(
  diagramType: VisualDiagramType,
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: LayoutOptions = {},
): Map<string, LayoutPosition> {
  const rankGap = options.rankGap ?? RANK_GAP;
  if (diagramType === "sequence") return layoutSequenceLifelines(nodes, edges);
  if (diagramType === "use-case") {
    const actors = nodes.filter((node) => node.type === "actor");
    const cases = nodes.filter((node) => node.type !== "actor");
    return (
      layoutLayered(
        nodes,
        cases.flatMap((node) => actors.map((actor) => ({ source: actor.id, target: node.id }))),
        rankGap,
      ) ?? layoutGrid(nodes, rankGap)
    );
  }
  if (LAYERED_DIAGRAM_TYPES.has(diagramType)) {
    const layered = layoutLayered(nodes, edges, rankGap);
    if (layered) return layered;
  }
  return layoutGrid(nodes, rankGap);
}

function layoutGrid(nodes: LayoutNode[], rankGap: number): Map<string, LayoutPosition> {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const positions = new Map<string, LayoutPosition>();
  const widths = Array.from({ length: columns }, (_, column) =>
    Math.max(0, ...nodes.filter((_, i) => i % columns === column).map((n) => n.width)),
  );
  let y = GRID_MARGIN_Y;
  for (let start = 0; start < nodes.length; start += columns) {
    let x = GRID_MARGIN_X;
    const row = nodes.slice(start, start + columns);
    row.forEach((node, column) => {
      positions.set(node.id, { x, y });
      x += Math.max(GRID_COLUMN_GAP, widths[column] + rankGap);
    });
    y += Math.max(GRID_ROW_GAP, ...row.map((node) => node.height + LANE_GAP));
  }
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
 * and stack nodes within a rank top to bottom. Feedback edges are removed
 * only from ranking; all edges remain in the document.
 */
function layoutLayered(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  rankGap: number,
): Map<string, LayoutPosition> | null {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  // Self-loops don't affect ranking and would trivially look like a cycle;
  // exclude them from the ranking graph but keep every node reachable.
  const candidateEdges = edges.filter(
    (edge) => edge.source !== edge.target && byId.has(edge.source) && byId.has(edge.target),
  );

  // Keep a deterministic forward backbone. Feedback edges remain in the
  // document and route outside the ranks; they must not collapse a process
  // with a retry path into a grid. Iterative DFS avoids recursion limits.
  const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of candidateEdges) adjacency.get(edge.source)!.push(edge.target);
  const active = new Set<string>();
  const visited = new Set<string>();
  const feedback = new Set<string>();
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const stack = [{ id: node.id, next: 0 }];
    active.add(node.id);
    visited.add(node.id);
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const children = adjacency.get(frame.id)!;
      if (frame.next === children.length) {
        active.delete(frame.id);
        stack.pop();
        continue;
      }
      const next = children[frame.next++];
      if (active.has(next)) feedback.add(`${frame.id}\0${next}`);
      else if (!visited.has(next)) {
        visited.add(next);
        active.add(next);
        stack.push({ id: next, next: 0 });
      }
    }
  }
  const structuralEdges = candidateEdges.filter(
    (edge) => !feedback.has(`${edge.source}\0${edge.target}`),
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

  // Rank spacing follows the widest node in the rank being left behind rather
  // than the widest in the diagram. A global maximum still guarantees no two
  // ranks touch, but it pushed a rank of small shapes as far apart as the
  // single largest element on the canvas — which, in a transposed vertical
  // layout where "width" is really height, left the diagram almost all gap.
  const positions = new Map<string, LayoutPosition>();
  const layerHeight = (layer: string[]) =>
    layer.reduce((sum, id) => sum + byId.get(id)!.height + LANE_GAP, -LANE_GAP);
  const layerWidth = (layer: string[]) => Math.max(0, ...layer.map((id) => byId.get(id)!.width));
  const maxHeight = Math.max(0, ...[...layers.values()].map(layerHeight));
  let x = GRID_MARGIN_X;
  for (const r of sortedRanks) {
    const layer = layers.get(r)!;
    let y = GRID_MARGIN_Y + (maxHeight - layerHeight(layer)) / 2;
    for (const id of layer) {
      const node = byId.get(id)!;
      positions.set(id, { x, y });
      y += node.height + LANE_GAP;
    }
    x += layerWidth(layer) + rankGap;
  }
  return positions;
}
