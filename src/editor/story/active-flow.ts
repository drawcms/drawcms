import type { StoryTarget } from "./model";

export interface StoryFlowEdge {
  id: string;
  source: string;
  target: string;
}

export interface ResolvedStoryTargets {
  nodeIds: string[];
  edgeIds: string[];
}

/**
 * Resolve the complete visual focus for a narrative step.
 *
 * Authors who select only nodes get a convenience: direct connectors between
 * two or more selected nodes join the active flow automatically. Explicitly
 * selected connectors remain active even when their endpoints are outside the
 * node selection, and they switch the convenience off — a step that names its
 * connectors has already described the flow, so guessing more can only light
 * up connectors the author deliberately left out. That distinction matters
 * most in sequence diagrams, where every message between the same two
 * lifelines shares those endpoints and only the row says which beat it is.
 */
export function resolveStoryTargets(
  targets: readonly StoryTarget[],
  edges: readonly StoryFlowEdge[],
): ResolvedStoryTargets {
  const nodeIds: string[] = [];
  const edgeIds: string[] = [];
  const nodeIdSet = new Set<string>();
  const edgeIdSet = new Set<string>();

  for (const target of targets) {
    if (target.targetKind === "node") {
      if (nodeIdSet.has(target.targetId)) continue;
      nodeIdSet.add(target.targetId);
      nodeIds.push(target.targetId);
      continue;
    }

    if (edgeIdSet.has(target.targetId)) continue;
    edgeIdSet.add(target.targetId);
    edgeIds.push(target.targetId);
  }

  if (edgeIdSet.size > 0 || nodeIdSet.size < 2) return { nodeIds, edgeIds };

  for (const edge of edges) {
    if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) continue;
    edgeIdSet.add(edge.id);
    edgeIds.push(edge.id);
  }

  return { nodeIds, edgeIds };
}
