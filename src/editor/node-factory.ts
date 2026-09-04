import {
  CONTAINER_TYPES,
  DEFAULT_ENTITY_ATTRS,
  DEFAULT_LANES,
  DEFAULT_TABLE_ROWS,
  DEFAULT_UML_ATTRIBUTES,
  DEFAULT_UML_METHODS,
  ER_ENTITY_TYPES,
  getNodeSize,
  SWIMLANE_TYPES,
  UML_CLASS_TYPES,
} from "./constants";
import { getSemanticStyleDefaults } from "./components/shapes/semantic-elements";
import type { AppNodeData } from "./types";

/**
 * Single source of truth for "what does a brand-new node of this type look
 * like". Both the palette (hooks/useEditorState.ts `handleAddNode`) and the
 * WebMCP agent builder (webmcp/tools.ts `createDocumentFromWebMCP`)
 * construct nodes through these helpers so a palette-created node and an
 * agent-created node of the same type are identical (renderer, style
 * defaults, structured content defaults, and z-index).
 */

/** React Flow node renderer key for a given DrawCMS element type. */
export function nodeRendererType(type: string): string {
  if (type === "table") return "tableShape";
  if (UML_CLASS_TYPES.has(type)) return "umlClassShape";
  if (ER_ENTITY_TYPES.has(type)) return "entityShape";
  if (CONTAINER_TYPES.has(type)) return "containerShape";
  if (SWIMLANE_TYPES.has(type)) return "swimlaneShape";
  return "customShape";
}

export interface DefaultNodeDataOptions {
  /** One-shot UI hint: focus and open the label editor immediately (palette insert only). */
  editOnMount?: boolean;
}

/** Structured content and style defaults (table rows, UML members, ER attributes, lanes, text). */
export function defaultNodeData(
  type: string,
  label: string,
  options?: DefaultNodeDataOptions,
): AppNodeData {
  const data: AppNodeData = {
    label,
    type,
    ...(getSemanticStyleDefaults(type) ?? {}),
  };
  if (type === "text") {
    Object.assign(data, {
      fontSize: 20,
      fontWeight: "400",
      textColor: "#1f2937",
      textAlign: "left",
      fontFamily: "sans",
      fontStyle: "normal",
      textDecoration: "none",
      lineHeight: 1.25,
      textAutoResize: true,
      ...(options?.editOnMount ? { textEditOnMount: true } : {}),
    });
  } else if (type === "table") {
    data.rows = DEFAULT_TABLE_ROWS.map((row) => ({ ...row }));
  } else if (UML_CLASS_TYPES.has(type)) {
    data.attributes = DEFAULT_UML_ATTRIBUTES.map((attribute) => ({ ...attribute }));
    data.methods = DEFAULT_UML_METHODS.map((method) => ({ ...method }));
    data.headerColor = "#dbeafe";
    if (type === "uml-object") data.stereotype = "";
  } else if (ER_ENTITY_TYPES.has(type)) {
    data.entityAttributes = DEFAULT_ENTITY_ATTRS.map((attribute) => ({ ...attribute }));
    data.headerColor = "#fef3c7";
  } else if (SWIMLANE_TYPES.has(type)) {
    data.lanes = DEFAULT_LANES.map((lane) => ({ ...lane }));
  }
  return data;
}

/** Structured element types that measure their own height from content. */
export function nodeHasAutoHeight(type: string): boolean {
  return type === "table" || UML_CLASS_TYPES.has(type) || ER_ENTITY_TYPES.has(type);
}

/** Style block for a node, honoring explicit width/height overrides. */
export function nodeStyle(type: string, width?: number, height?: number): Record<string, number> {
  const defaultSize = getNodeSize(type);
  return nodeHasAutoHeight(type)
    ? { width: width ?? defaultSize.width }
    : { width: width ?? defaultSize.width, height: height ?? defaultSize.height };
}

/** Stacking order: containers and swimlanes render behind their contents. */
export function nodeZIndex(type: string): number | undefined {
  if (CONTAINER_TYPES.has(type) || SWIMLANE_TYPES.has(type)) return -1;
  if (type === "sequence-activation") return 1;
  return undefined;
}

/**
 * Pick a plausible connector handle pair from two node positions when no
 * pointer interaction chose one explicitly (agent-authored connectors; see
 * webmcp/tools.ts and hooks/useEditorState.ts `applyGraphEdit`).
 */
export function defaultEdgeHandles(
  source: { position: { x: number; y: number } },
  target: { position: { x: number; y: number } },
): { sourceHandle: string; targetHandle: string } {
  const dx = target.position.x - source.position.x;
  const dy = target.position.y - source.position.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: "right", targetHandle: "left" }
      : { sourceHandle: "left", targetHandle: "right" };
  }
  return dy >= 0
    ? { sourceHandle: "bottom", targetHandle: "top" }
    : { sourceHandle: "top", targetHandle: "bottom" };
}
