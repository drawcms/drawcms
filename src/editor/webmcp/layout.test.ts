import { describe, expect, it } from "vitest";
import { layoutNodes, type LayoutEdge, type LayoutNode } from "./layout";

function node(id: string, type = "round-rect", width = 160, height = 80): LayoutNode {
  return { id, type, width, height };
}

/** Axis-aligned bounding box overlap, given top-left positions and sizes. */
function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

describe("layoutNodes", () => {
  it("places general-diagram nodes on a grid with no overlaps", () => {
    const nodes = [node("a"), node("b", "round-rect", 220, 100), node("c"), node("d")];
    const positions = layoutNodes("general", nodes, []);
    expect(positions.size).toBe(4);

    const boxes = nodes.map((n) => ({ ...positions.get(n.id)!, width: n.width, height: n.height }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(overlaps(boxes[i], boxes[j])).toBe(false);
      }
    }
  });

  it("ranks flowchart nodes by longest path so edges point along increasing x", () => {
    const nodes = [node("start"), node("middle"), node("end")];
    const edges: LayoutEdge[] = [
      { source: "start", target: "middle" },
      { source: "middle", target: "end" },
    ];
    const positions = layoutNodes("flowchart", nodes, edges);

    expect(positions.get("start")!.x).toBeLessThan(positions.get("middle")!.x);
    expect(positions.get("middle")!.x).toBeLessThan(positions.get("end")!.x);
  });

  it("keeps nodes of the same rank clear of each other vertically", () => {
    const nodes = [node("source"), node("a"), node("b"), node("c")];
    const edges: LayoutEdge[] = [
      { source: "source", target: "a" },
      { source: "source", target: "b" },
      { source: "source", target: "c" },
    ];
    const positions = layoutNodes("architecture", nodes, edges);
    // a, b, c all share rank 1 (one hop from source): same x, distinct y.
    const rankX = positions.get("a")!.x;
    expect(positions.get("b")!.x).toBe(rankX);
    expect(positions.get("c")!.x).toBe(rankX);
    const ys = [positions.get("a")!.y, positions.get("b")!.y, positions.get("c")!.y];
    expect(new Set(ys).size).toBe(3);
  });

  it("falls back to a grid when the edge set contains a real cycle", () => {
    const nodes = [node("a"), node("b"), node("c")];
    const edges: LayoutEdge[] = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
      { source: "c", target: "a" },
    ];
    const positions = layoutNodes("data-flow", nodes, edges);
    expect(positions.size).toBe(3);
    // Grid fallback: first node at the grid origin.
    expect(positions.get("a")).toMatchObject({ x: 120, y: 100 });
  });

  it("tolerates self-loops without treating them as a cycle", () => {
    const nodes = [node("a"), node("b")];
    const edges: LayoutEdge[] = [
      { source: "a", target: "a" },
      { source: "a", target: "b" },
    ];
    const positions = layoutNodes("lifecycle", nodes, edges);
    expect(positions.get("a")!.x).toBeLessThan(positions.get("b")!.x);
  });

  it("places sequence lifelines in columns ordered by first appearance, at uniform height", () => {
    const nodes = [
      node("db", "sequence-participant", 140, 240),
      node("api", "sequence-participant", 140, 240),
      node("user", "sequence-actor", 112, 240),
    ];
    const edges: LayoutEdge[] = [
      { source: "user", target: "api" },
      { source: "api", target: "db" },
    ];
    const positions = layoutNodes("sequence", nodes, edges);

    expect(positions.get("user")!.x).toBeLessThan(positions.get("api")!.x);
    expect(positions.get("api")!.x).toBeLessThan(positions.get("db")!.x);
    expect(positions.get("user")!.y).toBe(positions.get("api")!.y);
    expect(positions.get("user")!.height).toBe(positions.get("db")!.height);
  });

  it("does not overlap sequence lifeline columns given their own widths", () => {
    const nodes = [
      node("a", "sequence-actor", 112, 240),
      node("b", "sequence-participant", 300, 240),
      node("c", "sequence-participant", 140, 240),
    ];
    const edges: LayoutEdge[] = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];
    const positions = layoutNodes("sequence", nodes, edges);
    const ax = positions.get("a")!.x;
    const bx = positions.get("b")!.x;
    const cx = positions.get("c")!.x;
    expect(bx).toBeGreaterThanOrEqual(ax + 112);
    expect(cx).toBeGreaterThanOrEqual(bx + 300);
  });
});
