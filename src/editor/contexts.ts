"use client";

import { createContext, useContext } from "react";
import type { TableRow, ListItem, EntityAttribute, Lane, EdgeBend, EdgeRoutingMode } from "./types";

// Context for node callbacks — stable ref avoids new node objects on every render,
// which is critical for React Flow's checkEquality optimization in adoptUserNodes.
export interface NodeCallbacksType {
  /** Select a node from a precise visual hit area rather than its resize frame. */
  onSelectNode?: (nodeId: string, options: { additive: boolean }) => void;
  onLabelChange: (nodeId: string, label: string) => void;
  onUpdateRows: (nodeId: string, rows: TableRow[]) => void;
  onUpdateList: (nodeId: string, section: "attributes" | "methods", items: ListItem[]) => void;
  onUpdateEntityAttributes: (nodeId: string, attrs: EntityAttribute[]) => void;
  onUpdateLanes: (nodeId: string, lanes: Lane[]) => void;
  onStyleChange: (
    nodeId: string,
    props: Record<string, unknown>,
    styleProps?: Record<string, unknown>,
  ) => void;
}

export const NodeCallbacksContext = createContext<NodeCallbacksType | null>(null);

export function useNodeCallbacks() {
  return useContext(NodeCallbacksContext);
}

export interface EdgeRoutingCallbacksType {
  /** Capture one undo snapshot before a pointer or keyboard routing edit. */
  onRoutingChangeStart: () => void;
  onRoutingChange: (edgeId: string, routingMode: EdgeRoutingMode, bend: EdgeBend | null) => void;
  /** Move one visual endpoint while retaining its logical lifeline attachment. */
  onSequenceEndpointChange: (
    edgeId: string,
    endpoint: "source" | "target",
    offset: EdgeBend | null,
  ) => void;
  /** Move both endpoints together, shifting the whole message freely. */
  onSequenceMessageMove: (edgeId: string, sourceOffset: EdgeBend, targetOffset: EdgeBend) => void;
}

export const EdgeRoutingCallbacksContext = createContext<EdgeRoutingCallbacksType | null>(null);

export function useEdgeRoutingCallbacks() {
  return useContext(EdgeRoutingCallbacksContext);
}

// Context for animation state — avoids injecting isAnimating into node data
export interface AnimationStateType {
  isGlobalAnimating: boolean;
  isPreviewingSelected: boolean;
  selectedNodeId: string | null;
  /** Presentation-only targets. Kept outside the persisted document model. */
  activeStoryNodeIds: readonly string[];
  activeStoryEdgeIds: readonly string[];
  isStoryStepPlaying: boolean;
  prefersReducedMotion: boolean;
}

export const AnimationStateContext = createContext<AnimationStateType>({
  isGlobalAnimating: false,
  isPreviewingSelected: false,
  selectedNodeId: null,
  activeStoryNodeIds: [],
  activeStoryEdgeIds: [],
  isStoryStepPlaying: false,
  prefersReducedMotion: false,
});

export function useAnimationState() {
  return useContext(AnimationStateContext);
}
