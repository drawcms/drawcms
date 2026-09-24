import type { AppNode } from "./types";

export class NodeHierarchyError extends Error {}

/** React Flow requires parents before children, regardless of authoring order. */
export function orderNodesByParent<T extends { id: string; parentId?: string }>(nodes: T[]): T[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: T[] = [];
  const visit = (node: T) => {
    if (visited.has(node.id)) return;
    if (visiting.has(node.id)) throw new NodeHierarchyError(`Cyclic parentId at ${node.id}.`);
    visiting.add(node.id);
    if (node.parentId) {
      const parent = byId.get(node.parentId);
      if (!parent) throw new NodeHierarchyError(`Unknown parentId ${node.parentId} on ${node.id}.`);
      visit(parent);
    }
    visiting.delete(node.id);
    visited.add(node.id);
    ordered.push(node);
  };
  nodes.forEach(visit);
  return ordered;
}

export function ancestorIds(node: Pick<AppNode, "id" | "parentId">, nodes: readonly AppNode[]) {
  const ids = new Set<string>();
  let parentId = node.parentId;
  while (parentId && !ids.has(parentId)) {
    ids.add(parentId);
    parentId = nodes.find((candidate) => candidate.id === parentId)?.parentId;
  }
  return ids;
}

export function absoluteNodePosition(node: AppNode, nodes: readonly AppNode[]) {
  const position = { ...node.position };
  for (const id of ancestorIds(node, nodes)) {
    const parent = nodes.find((candidate) => candidate.id === id);
    if (parent) {
      position.x += parent.position.x;
      position.y += parent.position.y;
    }
  }
  return position;
}

export function rootNodeId(id: string, nodes: readonly { id: string; parentId?: string }[]) {
  const seen = new Set<string>();
  let current = id;
  while (!seen.has(current)) {
    seen.add(current);
    const parent = nodes.find((node) => node.id === current)?.parentId;
    if (!parent) break;
    current = parent;
  }
  return current;
}
