export interface TableRow {
  id: string;
  name: string;
  type: string;
}

export interface ListItem {
  id: string;
  text: string;
}

export interface EntityAttribute {
  id: string;
  name: string;
  isKey: boolean;
}

export interface Lane {
  id: string;
  name: string;
}

export interface AppNodeData {
  label: string;
  type: string;
  preset?: string;
  motionSpeed?: number;
  motionLoop?: boolean;
  /** Locked elements refuse drag, resize, connect, and delete (context menu). */
  locked?: boolean;
  // Style
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  headerColor?: string;
  borderRadius?: number;
  // Text
  fontSize?: number;
  fontWeight?: string;
  textColor?: string;
  textAlign?: string;
  fontFamily?: "sans" | "hand" | "mono";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline";
  lineHeight?: number;
  /** Standalone text grows to its content until the user resizes it manually. */
  textAutoResize?: boolean;
  /** One-shot editor UI hint used when a new standalone text element is inserted. */
  textEditOnMount?: boolean;
  // Table
  rows?: TableRow[];
  // UML Class
  stereotype?: string;
  attributes?: ListItem[];
  methods?: ListItem[];
  // ER Entity
  entityAttributes?: EntityAttribute[];
  // Swimlane / Pool
  lanes?: Lane[];
  // Image
  imageUrl?: string;
  _originalImageUrl?: string;
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
  _naturalW?: number;
  _naturalH?: number;
  // Index signature for React Flow compatibility
  [key: string]: unknown;
}

export interface AppNode {
  id: string;
  position: { x: number; y: number };
  data: AppNodeData;
  type?: string;
  selected?: boolean;
  style?: Record<string, unknown>;
  // Container support (React Flow v12)
  parentId?: string;
  zIndex?: number;
  // Index signature for React Flow and document-schema compatibility
  [key: string]: unknown;
}

export type EdgeRoutingMode = "straight" | "elbow" | "curve";

export const SEQUENCE_EDGE_TYPES = [
  "sequence-message",
  "sequence-message-async",
  "sequence-message-return",
  "sequence-message-self",
] as const;

export type SequenceEdgeType = (typeof SEQUENCE_EDGE_TYPES)[number];

export function isSequenceEdgeType(value: unknown): value is SequenceEdgeType {
  return SEQUENCE_EDGE_TYPES.includes(value as SequenceEdgeType);
}

export interface EdgeBend {
  /** Canvas-space offset from the midpoint between the connector endpoints. */
  x: number;
  /** Canvas-space offset from the midpoint between the connector endpoints. */
  y: number;
  [key: string]: unknown;
}

export interface AppEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  animated?: boolean;
  data?: {
    preset?: string;
    label?: string;
    isAnimating?: boolean;
    motionSpeed?: number;
    motionLoop?: boolean;
    /** User-selected connector geometry. Existing documents default to curve. */
    routingMode?: EdgeRoutingMode;
    /** Draggable canvas-space bend relative to the endpoint midpoint. */
    bend?: EdgeBend;
    /** Visual offset from the attached source anchor for free message pointing. */
    sourceOffset?: EdgeBend;
    /** Visual offset from the attached target anchor for free message pointing. */
    targetOffset?: EdgeBend;
    /** Legacy vertical bend; read for compatibility and superseded by bend. */
    curveOffset?: number;
    /** Sequence-message semantics. These palette elements are attached edges, not nodes. */
    sequenceType?: SequenceEdgeType;
    /** Visual scale for attached sequence messages. */
    scale?: number;
  };
  // Index signature for React Flow and document-schema compatibility
  [key: string]: unknown;
}
