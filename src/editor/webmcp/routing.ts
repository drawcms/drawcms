import type { AppEdge, AppNode } from "../types";
import { getNodeSize, TEXT_BELOW_NODE_TYPES } from "../constants";
import { ROUTE_ISSUE_CODES, type RouteIssueCode } from "../document/diagram-types";

export interface Point {
  x: number;
  y: number;
}
export interface Box extends Point {
  width: number;
  height: number;
}
export interface DiagramRoute {
  points: Point[];
  label: Point;
  labelWidth: number;
  labelHeight: number;
  labelText?: string;
  /** Snapshot: discard stored geometry when endpoints are moved or resized. */
  source: Point;
  target: Point;
  sourceBounds?: Box;
  targetBounds?: Box;
  issues: RouteIssueCode[];
}

export function isDiagramRoute(value: unknown): value is DiagramRoute {
  if (!value || typeof value !== "object") return false;
  const route = value as DiagramRoute;
  const point = (p: Point) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  return (
    Array.isArray(route.points) &&
    route.points.length >= 2 &&
    route.points.length <= 20 &&
    route.points.every(point) &&
    point(route.source) &&
    point(route.target) &&
    point(route.label) &&
    Number.isFinite(route.labelWidth) &&
    Number.isFinite(route.labelHeight) &&
    Array.isArray(route.issues) &&
    route.issues.every((code) => (ROUTE_ISSUE_CODES as readonly string[]).includes(code))
  );
}

export function nodeBox(node: AppNode): Box {
  const size = getNodeSize(node.data.type);
  const rows =
    node.data.type === "table"
      ? node.data.rows
      : node.data.type === "uml-class" || node.data.type === "uml-object"
        ? [...(node.data.attributes ?? []), ...(node.data.methods ?? [])]
        : node.data.entityAttributes;
  const contentHeight = Array.isArray(rows) ? 40 + Math.max(1, rows.length) * 24 : 140;
  return {
    ...node.position,
    width: Number(node.style?.width) || size.width || 160,
    height: Math.max(
      Number(node.data.layoutHeight) || Number(node.style?.height) || size.height || contentHeight,
      Array.isArray(rows) ? contentHeight : 0,
    ),
  };
}

export function boxesOverlap(a: Box, b: Box, gap = 0): boolean {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

/** Orthogonal segment intersects the open interior (touching the boundary is allowed). */
export function segmentHitsBox(a: Point, b: Point, box: Box): boolean {
  if (a.x === b.x)
    return (
      a.x > box.x &&
      a.x < box.x + box.width &&
      Math.max(a.y, b.y) > box.y &&
      Math.min(a.y, b.y) < box.y + box.height
    );
  if (a.y === b.y)
    return (
      a.y > box.y &&
      a.y < box.y + box.height &&
      Math.max(a.x, b.x) > box.x &&
      Math.min(a.x, b.x) < box.x + box.width
    );
  return false;
}

function segments(points: Point[]): [Point, Point][] {
  return points.slice(1).map((point, i) => [points[i], point]);
}

/**
 * Per-character width assumed for a connector label.
 *
 * CustomEdge draws labels at 12px/600, where an all-caps run averages a shade
 * over 8px per character. Budgeting exactly 8 left no slack, so a word that
 * measured a fraction wide — "HTTPS" at 40.3px in a 40px content box — broke
 * mid-word into "HTTP" / "S" under the label's `overflow-wrap: anywhere`.
 */
const LABEL_CHAR_WIDTH = 8.5;
/** CustomEdge's label chrome: 8px padding and a 1px border on each side. */
const LABEL_CHROME_WIDTH = 18;

/**
 * How badly a candidate label box is obstructed.
 *
 * Overlapping a shape is scored by area, so a label pushed halfway off a table
 * beats one centred on it; crossing a connector costs a flat amount, which is
 * small next to any real shape overlap because a line through text is far more
 * readable than a box on top of a box. Used only to pick the least-bad spot
 * when no clear one exists — the connector still reports the collision.
 */
function labelObstruction(box: Box, blockers: Box[], lines: [Point, Point][]): number {
  let penalty = 0;
  for (const other of blockers) {
    const overlapX = Math.min(box.x + box.width, other.x + other.width) - Math.max(box.x, other.x);
    const overlapY =
      Math.min(box.y + box.height, other.y + other.height) - Math.max(box.y, other.y);
    if (overlapX > 0 && overlapY > 0) penalty += overlapX * overlapY;
  }
  for (const [p, q] of lines) if (segmentHitsBox(p, q, box)) penalty += 400;
  return penalty;
}
function simplify(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const last = result.at(-1);
    if (last?.x === point.x && last.y === point.y) continue;
    const previous = result.at(-2);
    if (
      last &&
      previous &&
      ((previous.x === last.x && last.x === point.x) ||
        (previous.y === last.y && last.y === point.y))
    )
      result.pop();
    result.push(point);
  }
  return result;
}
function ports(box: Box) {
  return [
    { side: "right", point: { x: box.x + box.width, y: box.y + box.height / 2 }, dx: 1, dy: 0 },
    { side: "left", point: { x: box.x, y: box.y + box.height / 2 }, dx: -1, dy: 0 },
    { side: "bottom", point: { x: box.x + box.width / 2, y: box.y + box.height }, dx: 0, dy: 1 },
    { side: "top", point: { x: box.x + box.width / 2, y: box.y }, dx: 0, dy: -1 },
  ];
}
function sharedLength(a: Point, b: Point, c: Point, d: Point): number {
  if (a.x === b.x && c.x === d.x && a.x === c.x)
    return Math.max(
      0,
      Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) -
        Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)),
    );
  if (a.y === b.y && c.y === d.y && a.y === c.y)
    return Math.max(
      0,
      Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) -
        Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)),
    );
  return 0;
}

function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  if (a.x === b.x && c.y === d.y)
    return (
      a.x > Math.min(c.x, d.x) &&
      a.x < Math.max(c.x, d.x) &&
      c.y > Math.min(a.y, b.y) &&
      c.y < Math.max(a.y, b.y)
    );
  if (a.y === b.y && c.x === d.x) return crosses(c, d, a, b);
  return false;
}

/** Bounded candidate routing: face ports, inner channels and exterior rails.
 * Never silently claims success: unresolved obstruction/label collisions are
 * returned for drawcms_validate_diagram. No DOM measurement or dependencies.
 */
export function routeDiagramEdges(nodes: AppNode[], edges: AppEdge[], eligible: Set<string>): void {
  const boxes = new Map(nodes.map((node) => [node.id, nodeBox(node)]));
  const obstacles = [...boxes.values()];
  const used: [Point, Point][] = [];
  const minX = Math.min(...obstacles.map((b) => b.x));
  const maxX = Math.max(...obstacles.map((b) => b.x + b.width));
  const minY = Math.min(...obstacles.map((b) => b.y));
  const maxY = Math.max(...obstacles.map((b) => b.y + b.height));
  for (const [index, edge] of edges.entries()) {
    if (!eligible.has(edge.id) || edge.data?.sequenceType) continue;
    const source = boxes.get(edge.source)!;
    const target = boxes.get(edge.target)!;
    if (!source || !target) continue;
    const rail = 48 + index * 20;
    const xs = [minX - rail, maxX + rail, (source.x + source.width + target.x) / 2];
    const ys = [minY - rail, maxY + rail, (source.y + source.height + target.y) / 2];
    let best:
      | { score: number; points: Point[]; sourceHandle: string; targetHandle: string; hits: number }
      | undefined;
    const sourcePorts = ports(source).filter(
      (port) =>
        port.side !== "bottom" ||
        !TEXT_BELOW_NODE_TYPES.has(nodes.find((node) => node.id === edge.source)!.data.type),
    );
    const targetPorts = ports(target).filter(
      (port) =>
        port.side !== "bottom" ||
        !TEXT_BELOW_NODE_TYPES.has(nodes.find((node) => node.id === edge.target)!.data.type),
    );
    for (const a of sourcePorts)
      for (const b of targetPorts) {
        if (edge.source === edge.target && a.side === b.side) continue;
        const start = { x: a.point.x + a.dx * 24, y: a.point.y + a.dy * 24 };
        const end = { x: b.point.x + b.dx * 24, y: b.point.y + b.dy * 24 };
        const candidates = [
          [start, { x: end.x, y: start.y }, end],
          [start, { x: start.x, y: end.y }, end],
          ...xs.map((x) => [start, { x, y: start.y }, { x, y: end.y }, end]),
          ...ys.map((y) => [start, { x: start.x, y }, { x: end.x, y }, end]),
        ];
        for (const candidate of candidates) {
          const points = simplify([a.point, ...candidate, b.point]);
          const parts = segments(points);
          const hits = parts.reduce(
            (sum, [p, q]) => sum + obstacles.filter((box) => segmentHitsBox(p, q, box)).length,
            0,
          );
          const length = parts.reduce(
            (sum, [p, q]) => sum + Math.abs(p.x - q.x) + Math.abs(p.y - q.y),
            0,
          );
          const shared = parts.reduce(
            (sum, [p, q]) => sum + used.reduce((n, [r, s]) => n + sharedLength(p, q, r, s), 0),
            0,
          );
          const crossingCount = parts.reduce(
            (sum, [p, q]) => sum + used.filter(([r, s]) => crosses(p, q, r, s)).length,
            0,
          );
          const score = hits * 1e9 + shared * 20 + crossingCount * 80 + length + points.length * 16;
          if (!best || score < best.score)
            best = { score, points, sourceHandle: a.side, targetHandle: b.side, hits };
        }
      }
    if (!best) continue;
    edge.sourceHandle = best.sourceHandle;
    edge.targetHandle = best.targetHandle;
    const route: DiagramRoute = {
      sourceBounds: source,
      targetBounds: target,
      points: best.points,
      source: best.points[0],
      target: best.points.at(-1)!,
      label: best.points[0],
      labelWidth: 0,
      labelHeight: 0,
      issues: best.hits ? ["CONNECTOR_NODE_COLLISION"] : [],
    };
    edge.data = { ...edge.data, routingMode: "elbow", diagramRoute: route };
    used.push(...segments(best.points));
  }
  // Labels are placed after all routes, avoiding every connector as well as
  // nodes and earlier labels. Text bounds match CustomEdge's 12px wrapped label.
  const labels: Box[] = [];
  for (const edge of edges) {
    const route = edge.data?.diagramRoute;
    if (!route) continue;
    const text = edge.label ?? edge.data?.label ?? "";
    const width = Math.min(
      220,
      Math.max(40, Math.ceil([...text].length * LABEL_CHAR_WIDTH) + LABEL_CHROME_WIDTH),
    );
    const lines = text
      .split("\n")
      .reduce(
        (n, line) =>
          n +
          Math.max(
            1,
            Math.ceil(([...line].length * LABEL_CHAR_WIDTH) / (width - LABEL_CHROME_WIDTH)),
          ),
        0,
      );
    const height = lines * 15 + 12;
    const parts = segments(route.points).sort(
      ([a, b], [c, d]) =>
        Math.abs(c.x - d.x) + Math.abs(c.y - d.y) - (Math.abs(a.x - b.x) + Math.abs(a.y - b.y)),
    );
    let chosen: Box | undefined;
    // When nothing is clear, remember the emptiest candidate. Dropping the
    // label at a fixed offset from the midpoint instead put it squarely on top
    // of whatever shape happened to be there.
    let leastBad: { box: Box; penalty: number } | undefined;
    for (const [a, b] of parts) {
      for (const fraction of [0.5, 0.35, 0.65, 0.2, 0.8])
        for (const side of [-1, 1])
          for (const spread of [1, 1.9]) {
            const vertical = a.x === b.x;
            const offset = spread * (vertical ? width / 2 + 10 : height / 2 + 10);
            const center = {
              x: a.x + (b.x - a.x) * fraction + (vertical ? side * offset : 0),
              y: a.y + (b.y - a.y) * fraction + (vertical ? 0 : side * offset),
            };
            const box = { x: center.x - width / 2, y: center.y - height / 2, width, height };
            const blockers = [...obstacles, ...labels];
            if (
              !blockers.some((other) => boxesOverlap(box, other, 8)) &&
              !used.some(([p, q]) => segmentHitsBox(p, q, box))
            ) {
              chosen ??= box;
            } else if (!chosen) {
              const penalty = labelObstruction(box, blockers, used);
              if (!leastBad || penalty < leastBad.penalty) leastBad = { box, penalty };
            }
          }
    }
    const fallback = parts[0];
    const box = chosen ??
      leastBad?.box ?? {
        x: (fallback[0].x + fallback[1].x) / 2 - width / 2,
        y: (fallback[0].y + fallback[1].y) / 2 - height - 10,
        width,
        height,
      };
    route.labelText = text;
    route.label = { x: box.x + width / 2, y: box.y + height / 2 };
    route.labelWidth = width;
    route.labelHeight = height;
    if (text) {
      labels.push(box);
      if (!chosen) route.issues.push("CONNECTOR_LABEL_COLLISION");
    }
  }
}
