"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import type {
  AppNode,
  AppEdge,
  TableRow,
  ListItem,
  EntityAttribute,
  Lane,
  EdgeRoutingMode,
  SequenceEdgeType,
} from "../types";
import { isSequenceEdgeType } from "../types";
import type { NodeCallbacksType, AnimationStateType, EdgeRoutingCallbacksType } from "../contexts";
import {
  applyGraphEditOperations,
  copyFromSnapshot,
  deleteSelectionCommand,
  groupNodesInSnapshot,
  lockNodesCommand,
  pasteCommand,
  reparentOnDragStop,
  replaceNodeTypeCommand,
  reverseEdgeCommand,
  ungroupContainersInSnapshot,
  type ClipboardPayload,
  type EditorSnapshot,
  type GraphEditOperation,
} from "../commands/commands";
import { getNodeSize, CONTAINER_TYPES, SWIMLANE_TYPES } from "../constants";
import { defaultNodeData, nodeHasAutoHeight, nodeRendererType, nodeZIndex } from "../node-factory";
import { createSequenceEdge, nextSequenceRow, SEQUENCE_LIFELINE_TYPES } from "../sequence-edges";

export interface UseEditorStateOptions {
  initialNodes?: AppNode[];
  initialEdges?: AppEdge[];
  onChange?: (nodes: AppNode[], edges: AppEdge[]) => void;
}

/**
 * React Flow stores selection on the node/edge objects it gives us. Selection
 * is editor UI state, so it must not make the document change stream dirty.
 */
export function editorContentFingerprint(nodes: AppNode[], edges: AppEdge[]): string {
  const withoutSelection = (item: AppNode | AppEdge) => {
    const copy: Record<string, unknown> = { ...item };
    delete copy.selected;
    return copy;
  };

  return JSON.stringify({
    nodes: nodes.map(withoutSelection),
    edges: edges.map(withoutSelection),
  });
}

export interface SequenceEdgeToolState {
  type: SequenceEdgeType;
  label: string;
  sourceId: string | null;
  message?: string;
}

/** An id-addressed element animation patch (agent authoring; see webmcp/tools.ts `drawcms_set_motion`). */
export interface ElementMotionPatch {
  targetId: string;
  targetKind: "node" | "edge";
  /** A string sets the preset; null clears it; omit to leave the current preset untouched. */
  preset?: string | null;
  speed?: number;
  loop?: boolean;
}

interface SequenceInsertionLayout {
  position: { x: number; y: number };
  size: { width: number; height: number };
}

function nodeDimension(node: AppNode, dimension: "width" | "height", fallback: number) {
  const measured = node.measured as { width?: number; height?: number } | undefined;
  return Number(node.style?.[dimension] ?? measured?.[dimension] ?? fallback);
}

/**
 * Palette clicks should immediately produce a recognizable sequence layout.
 * Explicit canvas drops keep their exact pointer position and bypass this.
 */
export function getSequenceInsertionLayout(
  type: string,
  nodes: AppNode[],
  baseSize: { width: number; height: number },
): SequenceInsertionLayout | null {
  if (!type.startsWith("sequence-")) return null;

  const lifelines = nodes
    .filter((node) => SEQUENCE_LIFELINE_TYPES.has(String(node.data.type)) && !node.parentId)
    .sort((left, right) => left.position.x - right.position.x);
  const selectedLifeline = lifelines.find((node) => node.selected) ?? lifelines.at(-1);
  if (SEQUENCE_LIFELINE_TYPES.has(type)) {
    return {
      position: { x: 180 + lifelines.length * 220, y: 120 },
      size: baseSize,
    };
  }

  if (type === "sequence-activation" && selectedLifeline) {
    const center = selectedLifeline.position.x + nodeDimension(selectedLifeline, "width", 140) / 2;
    return {
      position: { x: center - baseSize.width / 2, y: selectedLifeline.position.y + 52 },
      size: baseSize,
    };
  }

  if ((type === "sequence-time" || type === "sequence-destroy") && selectedLifeline) {
    const center = selectedLifeline.position.x + nodeDimension(selectedLifeline, "width", 140) / 2;
    return {
      position: { x: center - baseSize.width / 2, y: selectedLifeline.position.y + 116 },
      size: baseSize,
    };
  }

  if (type === "sequence-reference" && lifelines.length >= 2) {
    const sourceCenter = lifelines[0].position.x + nodeDimension(lifelines[0], "width", 140) / 2;
    const targetCenter = lifelines[1].position.x + nodeDimension(lifelines[1], "width", 140) / 2;
    return {
      position: { x: sourceCenter, y: lifelines[0].position.y + 92 },
      size: {
        width: Math.max(baseSize.width, targetCenter - sourceCenter),
        height: baseSize.height,
      },
    };
  }

  if (type === "sequence-note" && selectedLifeline) {
    const width = nodeDimension(selectedLifeline, "width", 140);
    return {
      position: {
        x: selectedLifeline.position.x + width + 28,
        y: selectedLifeline.position.y + 42,
      },
      size: baseSize,
    };
  }

  if (type === "sequence-frame") {
    if (lifelines.length > 0) {
      const left = Math.min(...lifelines.map((node) => node.position.x)) - 40;
      const top = Math.min(...lifelines.map((node) => node.position.y)) - 40;
      const right =
        Math.max(
          ...lifelines.map(
            (node) => node.position.x + nodeDimension(node, "width", baseSize.width),
          ),
        ) + 40;
      const bottom =
        Math.max(
          ...lifelines.map(
            (node) => node.position.y + nodeDimension(node, "height", baseSize.height),
          ),
        ) + 40;
      return {
        position: { x: left, y: top },
        size: {
          width: Math.max(baseSize.width, right - left),
          height: Math.max(baseSize.height, bottom - top),
        },
      };
    }
    return { position: { x: 120, y: 80 }, size: baseSize };
  }

  return null;
}

const DEFAULT_NODES: AppNode[] = [
  {
    id: "1",
    position: { x: 250, y: 150 },
    data: { label: "Start", type: "rounded-rect" },
    type: "customShape",
    style: { width: 160, height: 80 },
  },
  {
    id: "2",
    position: { x: 550, y: 150 },
    data: { label: "End", type: "rounded-rect" },
    type: "customShape",
    style: { width: 160, height: 80 },
  },
];

const DEFAULT_EDGES: AppEdge[] = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
    sourceHandle: "right",
    targetHandle: "left",
    label: "Flow",
    data: { label: "Flow" },
  },
];

/**
 * Generic visual fields carried across element types when the context-menu
 * "Replace" action swaps a node's type in place. Type-specific structure
 * (rows, attributes, lanes, …) always resets to the new type's defaults.
 */
const REPLACE_STYLE_KEYS = [
  "fillColor",
  "strokeColor",
  "strokeWidth",
  "opacity",
  "headerColor",
  "borderRadius",
  "textColor",
  "fontSize",
  "fontWeight",
  "fontFamily",
  "fontStyle",
  "textDecoration",
  "textAlign",
  "lineHeight",
  "preset",
] as const;

export function useEditorState(options?: UseEditorStateOptions) {
  const [isGlobalAnimating, setIsGlobalAnimating] = useState(false);
  const [isPreviewingSelected, setIsPreviewingSelected] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [activeSequenceEdgeTool, setActiveSequenceEdgeTool] =
    useState<SequenceEdgeToolState | null>(null);

  const [nodes, setNodes] = useState<AppNode[]>(options?.initialNodes ?? DEFAULT_NODES);
  const [edges, setEdges] = useState<AppEdge[]>(options?.initialEdges ?? DEFAULT_EDGES);

  // Latest-state refs let command-boundary operations read a consistent snapshot
  // outside of React's state updaters (refs are synced after commit, not in render).
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  // ── onChange callback ──
  const onChangeRef = useRef(options?.onChange);
  const initialRenderRef = useRef(true);
  const lastChangeFingerprintRef = useRef(editorContentFingerprint(nodes, edges));

  useEffect(() => {
    onChangeRef.current = options?.onChange;
  }, [options?.onChange]);

  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }
    const fingerprint = editorContentFingerprint(nodes, edges);
    if (fingerprint === lastChangeFingerprintRef.current) return;
    lastChangeFingerprintRef.current = fingerprint;
    onChangeRef.current?.(nodes, edges);
  }, [nodes, edges]);

  // ── Undo / Redo history ──
  const MAX_HISTORY = 50;
  const historyRef = useRef<{ nodes: AppNode[]; edges: AppEdge[] }[]>([]);
  const futureRef = useRef<{ nodes: AppNode[]; edges: AppEdge[] }[]>([]);
  const skipHistoryRef = useRef(false);

  const applySnapshot = useCallback((next: EditorSnapshot) => {
    setEdges(next.edges);
    setNodes(next.nodes);
  }, []);

  // Read the last committed canvas directly from the synced refs. Snapshotting
  // inside setState updaters races with sibling updaters (e.g. the edge added
  // in the same batch as a committed sequence message) and records the
  // post-edit state as "before".
  const currentSnapshot = useCallback(
    (): EditorSnapshot => ({ nodes: nodesRef.current, edges: edgesRef.current }),
    [],
  );

  const pushHistory = useCallback(() => {
    if (skipHistoryRef.current) return;
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), currentSnapshot()];
    futureRef.current = [];
  }, [currentSnapshot]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, currentSnapshot()];
    skipHistoryRef.current = true;
    requestAnimationFrame(() => {
      skipHistoryRef.current = false;
    });
    applySnapshot(prev);
  }, [applySnapshot, currentSnapshot]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    historyRef.current = [...historyRef.current, currentSnapshot()];
    skipHistoryRef.current = true;
    requestAnimationFrame(() => {
      skipHistoryRef.current = false;
    });
    applySnapshot(next);
  }, [applySnapshot, currentSnapshot]);

  // ── Clipboard (cut / copy / paste) — routed through the command boundary ──
  const clipboardRef = useRef<ClipboardPayload | null>(null);
  const [clipboardHasContent, setClipboardHasContent] = useState(false);

  const copySelection = useCallback(() => {
    clipboardRef.current = copyFromSnapshot(currentSnapshot(), {
      nodeId: selectedNodeId,
      edgeId: selectedEdgeId,
    });
    setClipboardHasContent(Boolean(clipboardRef.current && clipboardRef.current.nodes.length > 0));
  }, [currentSnapshot, selectedNodeId, selectedEdgeId]);

  const cutSelection = useCallback(() => {
    if (!selectedNodeId && !selectedEdgeId) return;
    copySelection();
    pushHistory();
    applySnapshot(
      deleteSelectionCommand({ nodeId: selectedNodeId, edgeId: selectedEdgeId }).apply(
        currentSnapshot(),
      ),
    );
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, [copySelection, pushHistory, applySnapshot, currentSnapshot, selectedNodeId, selectedEdgeId]);

  const paste = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip || clip.nodes.length === 0) return;
    pushHistory();
    const before = currentSnapshot();
    const next = pasteCommand(clip).apply(before);
    if (next === before) return;
    applySnapshot(next);
    const firstPasted = next.nodes.find((n) => n.selected);
    if (firstPasted) setSelectedNodeId(firstPasted.id);
  }, [pushHistory, applySnapshot, currentSnapshot]);

  // ── Context-menu operations (duplicate / z-order / group / lock / style) ──
  const selectedIdsForOperations = useCallback(() => {
    const flagged = nodesRef.current.filter((node) => node.selected).map((node) => node.id);
    if (flagged.length > 0) return flagged;
    return selectedNodeId ? [selectedNodeId] : [];
  }, [selectedNodeId]);

  const duplicateSelection = useCallback(() => {
    const before = currentSnapshot();
    if (selectedNodeId) {
      const clip = copyFromSnapshot(before, { nodeId: selectedNodeId });
      if (clip.nodes.length === 0) return;
      pushHistory();
      const next = pasteCommand(clip, { offset: 24 }).apply(before);
      if (next === before) return;
      applySnapshot(next);
      const firstPasted = next.nodes.find((n) => n.selected);
      setSelectedNodeId(firstPasted?.id ?? null);
      setSelectedEdgeId(null);
      return;
    }
    if (!selectedEdgeId) return;
    const edge = before.edges.find((item) => item.id === selectedEdgeId);
    if (!edge) return;
    pushHistory();
    const clone: AppEdge = {
      ...edge,
      id: `e${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      selected: true,
    };
    setEdges((eds) => [...eds.map((item) => ({ ...item, selected: false })), clone]);
  }, [applySnapshot, currentSnapshot, pushHistory, selectedEdgeId, selectedNodeId]);

  /** Multi-aware delete: every selected node (minus locked) and every selected edge. */
  const deleteSelection = useCallback(() => {
    const before = currentSnapshot();
    const flaggedNodes = before.nodes.filter((node) => node.selected).map((node) => node.id);
    const requestedNodeIds =
      flaggedNodes.length > 0 ? flaggedNodes : selectedNodeId ? [selectedNodeId] : [];
    const nodeIds = requestedNodeIds.filter((id) => {
      const node = before.nodes.find((item) => item.id === id);
      return node ? node.data?.locked !== true : false;
    });
    const flaggedEdges = before.edges.filter((edge) => edge.selected).map((edge) => edge.id);
    const edgeIds =
      flaggedEdges.length > 0
        ? flaggedEdges
        : nodeIds.length === 0 && selectedEdgeId
          ? [selectedEdgeId]
          : [];
    if (nodeIds.length === 0 && edgeIds.length === 0) return;
    pushHistory();
    applySnapshot(deleteSelectionCommand({ nodeIds, edgeIds }).apply(before));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, [applySnapshot, currentSnapshot, pushHistory, selectedEdgeId, selectedNodeId]);

  const groupSelection = useCallback(() => {
    const before = currentSnapshot();
    const next = groupNodesInSnapshot(before, selectedIdsForOperations());
    if (next === before) return;
    pushHistory();
    applySnapshot(next);
    setSelectedNodeId(next.nodes[0]?.id ?? null);
    setSelectedEdgeId(null);
  }, [applySnapshot, currentSnapshot, pushHistory, selectedIdsForOperations]);

  const ungroupSelection = useCallback(() => {
    const before = currentSnapshot();
    const next = ungroupContainersInSnapshot(before, selectedIdsForOperations());
    if (next === before) return;
    pushHistory();
    applySnapshot(next);
    setSelectedNodeId(next.nodes.find((node) => node.selected)?.id ?? null);
    setSelectedEdgeId(null);
  }, [applySnapshot, currentSnapshot, pushHistory, selectedIdsForOperations]);

  const toggleLockSelection = useCallback(() => {
    const before = currentSnapshot();
    const ids = selectedIdsForOperations();
    if (ids.length === 0) return;
    const anyUnlocked = ids.some((id) => {
      const node = before.nodes.find((item) => item.id === id);
      return node ? node.data?.locked !== true : false;
    });
    pushHistory();
    applySnapshot(lockNodesCommand(ids, anyUnlocked).apply(before));
  }, [applySnapshot, currentSnapshot, pushHistory, selectedIdsForOperations]);

  const reverseSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    pushHistory();
    applySnapshot(reverseEdgeCommand(selectedEdgeId).apply(currentSnapshot()));
  }, [applySnapshot, currentSnapshot, pushHistory, selectedEdgeId]);

  const selectAll = useCallback(() => {
    setNodes((nds) => nds.map((node) => ({ ...node, selected: true })));
    setEdges((eds) => eds.map((edge) => ({ ...edge, selected: true })));
    const firstNode = nodesRef.current[0];
    if (firstNode) {
      setSelectedNodeId(firstNode.id);
      setSelectedEdgeId(null);
    }
  }, []);

  const deselectAll = useCallback(() => {
    setNodes((nds) => nds.map((node) => ({ ...node, selected: false })));
    setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  /**
   * Swap a node's element type in place (context menu "Replace"): the node
   * keeps its id — position, container membership, selection, and connected
   * edges survive — while data resets to the new type's defaults and generic
   * visual fields (colors, fonts, animation preset) carry across.
   */
  const replaceNode = useCallback(
    (nodeId: string, newType: string) => {
      const original = nodesRef.current.find((item) => item.id === nodeId);
      if (!original || original.data?.locked === true) return;
      const label = typeof original.data?.label === "string" ? original.data.label : "";
      const data = defaultNodeData(newType, label);
      const carry = data as Record<string, unknown>;
      for (const key of REPLACE_STYLE_KEYS) {
        if (original.data[key] !== undefined) carry[key] = original.data[key];
      }
      const size = getNodeSize(newType);
      const autoHeight = nodeHasAutoHeight(newType);
      pushHistory();
      applySnapshot(
        replaceNodeTypeCommand(nodeId, {
          data,
          type: nodeRendererType(newType),
          style: autoHeight ? { width: size.width } : { width: size.width, height: size.height },
          zIndex: nodeZIndex(newType) ?? null,
        }).apply(currentSnapshot()),
      );
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
    },
    [applySnapshot, currentSnapshot, pushHistory],
  );

  const cancelSequenceEdgeTool = useCallback(() => {
    setActiveSequenceEdgeTool(null);
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Escape" && activeSequenceEdgeTool) {
        e.preventDefault();
        cancelSequenceEdgeTool();
      } else if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (mod && e.key === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key === "c") {
        e.preventDefault();
        copySelection();
      } else if (mod && e.key === "x") {
        e.preventDefault();
        cutSelection();
      } else if (mod && e.key === "v") {
        e.preventDefault();
        paste();
      } else if (mod && e.key === "d") {
        e.preventDefault();
        duplicateSelection();
      } else if (mod && e.key === "a") {
        e.preventDefault();
        selectAll();
      } else if ((e.key === "Delete" || e.key === "Backspace") && !mod) {
        if (selectedNodeId || selectedEdgeId) {
          e.preventDefault();
          deleteSelection();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    undo,
    redo,
    copySelection,
    cutSelection,
    paste,
    duplicateSelection,
    selectAll,
    deleteSelection,
    pushHistory,
    applySnapshot,
    currentSnapshot,
    selectedNodeId,
    selectedEdgeId,
    activeSequenceEdgeTool,
    cancelSequenceEdgeTool,
  ]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const meaningful = changes.some((c) => c.type !== "select");
      if (meaningful) pushHistory();
      setNodes((nds) => applyNodeChanges(changes, nds) as AppNode[]);
    },
    [pushHistory],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const meaningful = changes.some((c) => c.type !== "select");
      if (meaningful) pushHistory();
      setEdges((eds) => applyEdgeChanges(changes, eds) as AppEdge[]);
    },
    [pushHistory],
  );

  const commitSequenceEdge = useCallback(
    (tool: SequenceEdgeToolState, source: string, target: string) => {
      const edgeId = `sequence-edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      pushHistory();
      setNodes((currentNodes) => currentNodes.map((node) => ({ ...node, selected: false })));
      setEdges((currentEdges) => {
        const row = nextSequenceRow(currentEdges, tool.type === "sequence-message-self");
        const edge = createSequenceEdge({
          id: edgeId,
          sequenceType: tool.type,
          label: tool.label,
          source,
          target,
          row,
        });
        return [
          ...currentEdges.map((currentEdge) => ({ ...currentEdge, selected: false })),
          { ...edge, selected: true },
        ];
      });
      setSelectedNodeId(null);
      setSelectedEdgeId(edgeId);
      setActiveSequenceEdgeTool(null);
    },
    [pushHistory],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (activeSequenceEdgeTool && params.source && params.target) {
        commitSequenceEdge(activeSequenceEdgeTool, params.source, params.target);
        return;
      }
      pushHistory();
      setEdges((eds) => addEdge(params, eds) as AppEdge[]);
    },
    [activeSequenceEdgeTool, commitSequenceEdge, pushHistory],
  );

  const handleSequenceEdgeNodeClick = useCallback(
    (nodeId: string) => {
      if (!activeSequenceEdgeTool) return false;
      const node = nodesRef.current.find((candidate) => candidate.id === nodeId);
      if (!node || !SEQUENCE_LIFELINE_TYPES.has(String(node.data.type))) {
        setActiveSequenceEdgeTool((current) =>
          current ? { ...current, message: "Choose an actor or participant lifeline." } : current,
        );
        return true;
      }

      if (activeSequenceEdgeTool.type === "sequence-message-self") {
        commitSequenceEdge(activeSequenceEdgeTool, nodeId, nodeId);
        return true;
      }

      if (!activeSequenceEdgeTool.sourceId) {
        setActiveSequenceEdgeTool({
          ...activeSequenceEdgeTool,
          sourceId: nodeId,
          message: "Now choose the destination participant.",
        });
        return true;
      }

      if (activeSequenceEdgeTool.sourceId === nodeId) {
        setActiveSequenceEdgeTool({
          ...activeSequenceEdgeTool,
          message: "Choose a different destination, or use Self Message.",
        });
        return true;
      }

      commitSequenceEdge(activeSequenceEdgeTool, activeSequenceEdgeTool.sourceId, nodeId);
      return true;
    },
    [activeSequenceEdgeTool, commitSequenceEdge],
  );

  const handleAddNode = useCallback(
    (type: string, title: string, position?: { x: number; y: number }, parentId?: string) => {
      if (isSequenceEdgeType(type)) {
        setActiveSequenceEdgeTool({
          type,
          label: title,
          sourceId: null,
          message:
            type === "sequence-message-self"
              ? "Choose the participant that sends the message to itself."
              : "Choose the source participant.",
        });
        return;
      }
      setActiveSequenceEdgeTool(null);
      pushHistory();
      const size = getNodeSize(type);
      const isContainer = CONTAINER_TYPES.has(type);
      const isSwimlane = SWIMLANE_TYPES.has(type);
      const autoHeight = nodeHasAutoHeight(type);
      const data = defaultNodeData(type, title, { editOnMount: true });

      const nodeId = Date.now().toString();
      setNodes((nds) => {
        const sequenceLayout = position ? null : getSequenceInsertionLayout(type, nds, size);
        const resolvedSize = sequenceLayout?.size ?? size;
        const resolvedPosition = position ??
          sequenceLayout?.position ?? {
            x: 300 + Math.random() * 50,
            y: 200 + Math.random() * 50,
          };
        const newNode: AppNode = {
          id: nodeId,
          position: resolvedPosition,
          data,
          type: nodeRendererType(type),
          style: autoHeight
            ? { width: resolvedSize.width }
            : { width: resolvedSize.width, height: resolvedSize.height },
          ...(parentId ? { parentId } : {}),
          ...(nodeZIndex(type) !== undefined ? { zIndex: nodeZIndex(type) } : {}),
        };
        const updated = nds.map((n) => ({ ...n, selected: false }));
        if (isContainer || isSwimlane) {
          return [{ ...newNode, selected: true }, ...updated];
        }
        return [...updated, { ...newNode, selected: true }];
      });
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
    },
    [pushHistory],
  );

  const handleAddIcon = useCallback(
    (input: { icon: string; body: string; viewBox: string; label: string }) => {
      setActiveSequenceEdgeTool(null);
      pushHistory();
      const size = getNodeSize("icon");
      const nodeId = Date.now().toString();
      setNodes((nds) => {
        const newNode: AppNode = {
          id: nodeId,
          position: { x: 300 + Math.random() * 50, y: 200 + Math.random() * 50 },
          data: {
            label: input.label,
            type: "icon",
            iconName: input.icon,
            iconBody: input.body,
            iconViewBox: input.viewBox,
          },
          type: "customShape",
          style: { width: size.width, height: size.height },
        };
        const updated = nds.map((n) => ({ ...n, selected: false }));
        return [...updated, { ...newNode, selected: true }];
      });
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
    },
    [pushHistory],
  );
  const handleSelectPreset = useCallback(
    (preset: string) => {
      if (selectedEdgeId) {
        setEdges((eds) =>
          eds.map((e) => {
            if (e.id !== selectedEdgeId) return e;
            const data = { ...e.data };
            if (preset) data.preset = preset;
            else delete data.preset;
            return { ...e, data };
          }),
        );
        setIsPreviewingSelected(Boolean(preset));
        setShowPresets(false);
      } else if (selectedNodeId) {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== selectedNodeId) return n;
            const data = { ...n.data };
            if (preset) data.preset = preset;
            else delete data.preset;
            return { ...n, data };
          }),
        );
        setIsPreviewingSelected(Boolean(preset));
        setShowPresets(false);
      }
    },
    [selectedEdgeId, selectedNodeId],
  );

  const handleLabelChange = useCallback(
    (label: string) => {
      if (selectedNodeId) {
        setNodes((nds) =>
          nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, label } } : n)),
        );
      } else if (selectedEdgeId) {
        setEdges((eds) =>
          eds.map((e) =>
            e.id === selectedEdgeId ? { ...e, label, data: { ...e.data, label } } : e,
          ),
        );
      }
    },
    [selectedNodeId, selectedEdgeId],
  );

  const handleStyleChange = useCallback(
    (props: Record<string, unknown>) => {
      if (selectedNodeId) {
        setNodes((nds) =>
          nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, ...props } } : n)),
        );
      } else if (selectedEdgeId) {
        setEdges((eds) =>
          eds.map((e) => (e.id === selectedEdgeId ? { ...e, data: { ...e.data, ...props } } : e)),
        );
      }
    },
    [selectedNodeId, selectedEdgeId],
  );

  const handleEdgeRoutingModeChange = useCallback(
    (routingMode: EdgeRoutingMode) => {
      if (!selectedEdgeId) return;
      pushHistory();
      setEdges((currentEdges) =>
        currentEdges.map((edge) => {
          if (edge.id !== selectedEdgeId) return edge;
          const data = { ...edge.data, routingMode };
          if (routingMode !== "straight" && !data.bend && data.curveOffset === undefined) {
            const source = nodesRef.current.find((node) => node.id === edge.source);
            const target = nodesRef.current.find((node) => node.id === edge.target);
            const deltaX = (target?.position.x ?? 0) - (source?.position.x ?? 0);
            const deltaY = (target?.position.y ?? 0) - (source?.position.y ?? 0);
            data.bend = Math.abs(deltaX) >= Math.abs(deltaY) ? { x: 0, y: 64 } : { x: 64, y: 0 };
          }
          return { ...edge, data };
        }),
      );
    },
    [pushHistory, selectedEdgeId],
  );

  const handleResetEdgeBend = useCallback(() => {
    if (!selectedEdgeId) return;
    pushHistory();
    setEdges((currentEdges) =>
      currentEdges.map((edge) => {
        if (edge.id !== selectedEdgeId) return edge;
        const data = { ...edge.data };
        delete data.bend;
        delete data.curveOffset;
        return { ...edge, data };
      }),
    );
  }, [pushHistory, selectedEdgeId]);

  const handleUpdateRows = useCallback(
    (rows: TableRow[]) => {
      if (selectedNodeId) {
        setNodes((nds) =>
          nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, rows } } : n)),
        );
      }
    },
    [selectedNodeId],
  );

  const handleUpdateList = useCallback(
    (section: "attributes" | "methods", items: ListItem[]) => {
      if (selectedNodeId) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === selectedNodeId ? { ...n, data: { ...n.data, [section]: items } } : n,
          ),
        );
      }
    },
    [selectedNodeId],
  );

  const handleUpdateEntityAttributes = useCallback(
    (attrs: EntityAttribute[]) => {
      if (selectedNodeId) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === selectedNodeId ? { ...n, data: { ...n.data, entityAttributes: attrs } } : n,
          ),
        );
      }
    },
    [selectedNodeId],
  );

  const handleUpdateLanes = useCallback(
    (lanes: Lane[]) => {
      if (selectedNodeId) {
        setNodes((nds) =>
          nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, lanes } } : n)),
        );
      }
    },
    [selectedNodeId],
  );

  const handleNodeDragStop = useCallback(
    (nodeId: string, nodePosition: { x: number; y: number }) => {
      // Reparenting rules live in the command boundary (commands/operations).
      setNodes(
        (nds) =>
          reparentOnDragStop({ nodes: nds, edges: edgesRef.current }, nodeId, nodePosition).nodes,
      );
    },
    [],
  );

  /**
   * Id-addressed motion patch for any node or edge, independent of the
   * current selection. Used by agent refinement tools
   * (webmcp/tools.ts `drawcms_set_motion`) so retiming an element does not
   * require it to be selected in the editor first. Unknown ids are ignored
   * here; callers validate ids against the live graph beforehand so an
   * unknown id surfaces as a retryable tool error instead of a silent no-op.
   */
  const applyElementMotionPatches = useCallback(
    (patches: ElementMotionPatch[]) => {
      if (patches.length === 0) return;
      pushHistory();
      const nodePatches = new Map(
        patches
          .filter((patch) => patch.targetKind === "node")
          .map((patch) => [patch.targetId, patch]),
      );
      const edgePatches = new Map(
        patches
          .filter((patch) => patch.targetKind === "edge")
          .map((patch) => [patch.targetId, patch]),
      );
      if (nodePatches.size > 0) {
        setNodes((nds) =>
          nds.map((node) => {
            const patch = nodePatches.get(node.id);
            if (!patch) return node;
            const data = { ...node.data };
            if (patch.preset === null) delete data.preset;
            else if (patch.preset !== undefined) data.preset = patch.preset;
            if (patch.speed !== undefined) data.motionSpeed = patch.speed;
            if (patch.loop !== undefined) data.motionLoop = patch.loop;
            return { ...node, data };
          }),
        );
      }
      if (edgePatches.size > 0) {
        setEdges((eds) =>
          eds.map((edge) => {
            const patch = edgePatches.get(edge.id);
            if (!patch) return edge;
            const data = { ...edge.data };
            if (patch.preset === null) delete data.preset;
            else if (patch.preset !== undefined) data.preset = patch.preset;
            if (patch.speed !== undefined) data.motionSpeed = patch.speed;
            if (patch.loop !== undefined) data.motionLoop = patch.loop;
            return { ...edge, data };
          }),
        );
      }
    },
    [pushHistory],
  );

  /**
   * Batched incremental structural edit — add/update/delete nodes and edges
   * — applied as one undo entry (agent authoring; see webmcp/tools.ts
   * `drawcms_edit_diagram`). Unlike `loadSnapshot` (whole-document
   * replacement, which resets history), this goes through the same
   * pushHistory-then-mutate path a human edit would, so a user can undo an
   * entire agent-authored batch with one Cmd+Z. Callers validate every id
   * against the live graph beforehand — a no-op batch (all commands return
   * the same reference) still records history, matching the cost of a
   * single explicit human action.
   */
  const applyGraphEdit = useCallback(
    (operations: GraphEditOperation[]) => {
      if (operations.length === 0) return;
      pushHistory();
      const next = applyGraphEditOperations(currentSnapshot(), operations);
      applySnapshot(next);
    },
    [pushHistory, currentSnapshot, applySnapshot],
  );

  /**
   * Replace the whole canvas (file open, import, "New document"): history,
   * selection, and previews reset; the replacement itself never enters undo.
   */
  const loadSnapshot = useCallback((nextNodes: AppNode[], nextEdges: AppEdge[]) => {
    skipHistoryRef.current = true;
    historyRef.current = [];
    futureRef.current = [];
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setIsPreviewingSelected(false);
    setShowPresets(false);
    setActiveSequenceEdgeTool(null);
    requestAnimationFrame(() => {
      skipHistoryRef.current = false;
    });
  }, []);

  // Derived values
  const currentEdge = edges.find((e) => e.id === selectedEdgeId);
  const currentNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedPreset = currentEdge?.data?.preset || currentNode?.data?.preset || null;
  const panelType = selectedEdgeId ? "edge" : "node";
  const selectedLabel = selectedNodeId
    ? currentNode?.data?.label || ""
    : currentEdge?.label || currentEdge?.data?.label || "";
  const selectedRoutingMode: EdgeRoutingMode =
    currentEdge?.data?.routingMode === "straight" ||
    currentEdge?.data?.routingMode === "elbow" ||
    currentEdge?.data?.routingMode === "curve"
      ? currentEdge.data.routingMode
      : "curve";
  const isSelectedSequenceEdge = isSequenceEdgeType(currentEdge?.data?.sequenceType);
  const selectedEdgeScale =
    typeof currentEdge?.data?.scale === "number" && Number.isFinite(currentEdge.data.scale)
      ? Math.max(0.5, Math.min(2, currentEdge.data.scale))
      : 1;

  const edgeRoutingCallbacks = useMemo<EdgeRoutingCallbacksType>(
    () => ({
      onRoutingChangeStart: pushHistory,
      onRoutingChange: (edgeId, routingMode, bend) => {
        setEdges((currentEdges) =>
          currentEdges.map((edge) => {
            if (edge.id !== edgeId) return edge;
            const data = { ...edge.data, routingMode };
            if (bend) data.bend = bend;
            else delete data.bend;
            delete data.curveOffset;
            return { ...edge, data };
          }),
        );
      },
      onSequenceEndpointChange: (edgeId, endpoint, offset) => {
        setEdges((currentEdges) =>
          currentEdges.map((edge) => {
            if (edge.id !== edgeId) return edge;
            const data = { ...edge.data };
            const key = endpoint === "source" ? "sourceOffset" : "targetOffset";
            if (offset) data[key] = offset;
            else delete data[key];
            return { ...edge, data };
          }),
        );
      },
      onSequenceMessageMove: (edgeId, sourceOffset, targetOffset) => {
        setEdges((currentEdges) =>
          currentEdges.map((edge) => {
            if (edge.id !== edgeId) return edge;
            return { ...edge, data: { ...edge.data, sourceOffset, targetOffset } };
          }),
        );
      },
    }),
    [pushHistory],
  );

  // Stable callbacks via ref
  const nodeCallbacksRef = useRef<NodeCallbacksType>({
    onSelectNode: (nodeId, { additive }) => {
      const node = nodesRef.current.find((item) => item.id === nodeId);
      const shouldSelect = additive ? !node?.selected : true;

      setNodes((nds) =>
        nds.map((item) => {
          if (item.id === nodeId) return { ...item, selected: shouldSelect };
          return additive ? item : { ...item, selected: false };
        }),
      );
      if (!additive) {
        setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })));
      }
      setSelectedNodeId(shouldSelect ? nodeId : null);
      setSelectedEdgeId(null);
    },
    onLabelChange: (nodeId, label) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label } } : n)),
      );
    },
    onUpdateRows: (nodeId, rows) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, rows } } : n)),
      );
    },
    onUpdateList: (nodeId, section, items) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, [section]: items } } : n)),
      );
    },
    onUpdateEntityAttributes: (nodeId, attrs) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, entityAttributes: attrs } } : n,
        ),
      );
    },
    onUpdateLanes: (nodeId, lanes) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, lanes } } : n)),
      );
    },
    onStyleChange: (nodeId, props, styleProps) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: { ...n.data, ...props },
                ...(styleProps ? { style: { ...n.style, ...styleProps } } : {}),
              }
            : n,
        ),
      );
    },
  });

  const animationState = useMemo<AnimationStateType>(
    () => ({
      isGlobalAnimating,
      isPreviewingSelected,
      selectedNodeId,
      activeStoryNodeIds: [],
      activeStoryEdgeIds: [],
      isStoryStepPlaying: false,
      prefersReducedMotion: false,
    }),
    [isGlobalAnimating, isPreviewingSelected, selectedNodeId],
  );

  // Sort only: parents before children. Preserve references.
  const flowNodes = useMemo(() => {
    const parents = nodes.filter((n) => !n.parentId);
    const children = nodes.filter((n) => !!n.parentId);
    return [...parents, ...children];
  }, [nodes]);

  const flowEdges = useMemo(() => {
    return edges.map((e) => {
      const isThisAnimating =
        isGlobalAnimating || (isPreviewingSelected && e.id === selectedEdgeId);
      const isSequenceEdge = isSequenceEdgeType(e.data?.sequenceType);
      const edgeScale =
        typeof e.data?.scale === "number" && Number.isFinite(e.data.scale)
          ? Math.max(0.5, Math.min(2, e.data.scale))
          : 1;
      return {
        ...e,
        type: "custom" as const,
        reconnectable: isSequenceEdge ? false : e.reconnectable,
        ariaLabel: isSequenceEdge
          ? `${String(e.label || e.data?.label || "Sequence message")}, ${Math.round(edgeScale * 100)}% scale`
          : e.ariaLabel,
        data: {
          ...e.data,
          isAnimating: isThisAnimating || e.animated,
          label: e.label || e.data?.label,
        },
      };
    });
  }, [edges, isGlobalAnimating, isPreviewingSelected, selectedEdgeId]);

  return {
    // State
    nodes,
    edges,
    isGlobalAnimating,
    setIsGlobalAnimating,
    isPreviewingSelected,
    setIsPreviewingSelected,
    showPresets,
    setShowPresets,
    showLeftPanel,
    setShowLeftPanel,
    selectedNodeId,
    setSelectedNodeId,
    selectedEdgeId,
    setSelectedEdgeId,
    activeSequenceEdgeTool,

    // Handlers
    onNodesChange,
    onEdgesChange,
    onConnect,
    handleAddNode,
    handleAddIcon,
    handleSequenceEdgeNodeClick,
    cancelSequenceEdgeTool,
    handleSelectPreset,
    handleLabelChange,
    handleStyleChange,
    handleEdgeRoutingModeChange,
    handleResetEdgeBend,
    handleUpdateRows,
    handleUpdateList,
    handleUpdateEntityAttributes,
    handleUpdateLanes,
    handleNodeDragStop,
    applyElementMotionPatches,
    applyGraphEdit,
    loadSnapshot,
    duplicateSelection,
    deleteSelection,
    groupSelection,
    ungroupSelection,
    toggleLockSelection,
    reverseSelectedEdge,
    replaceNode,
    copySelection,
    cutSelection,
    paste,
    selectAll,
    deselectAll,
    clipboardHasContent,

    // Derived
    currentNode,
    currentEdge,
    selectedPreset,
    panelType,
    selectedLabel,
    selectedRoutingMode,
    isSelectedSequenceEdge,
    selectedEdgeScale,
    flowNodes,
    flowEdges,

    // Context values
    nodeCallbacksRef,
    edgeRoutingCallbacks,
    animationState,

    // Stable read paths for document actions (save, rename, export)
    nodesRef,
    edgesRef,
  };
}
