export interface SemanticShapeDefinition {
  id: string;
  title: string;
  defaultLabel?: string;
  keywords?: string[];
}

export interface SemanticShapeCategory {
  id: string;
  title: string;
  representativeShapeId: string;
  shapes: SemanticShapeDefinition[];
}

/**
 * Semantic diagram primitives inspired by the vocabulary used by architecture-
 * as-code tools. These are DrawCMS-owned renderers and document types; they
 * do not depend on a third-party runtime or asset catalogue.
 */
export const SEMANTIC_ELEMENT_GROUPS: SemanticShapeCategory[] = [
  {
    id: "sequence",
    title: "Sequence",
    representativeShapeId: "sequence-participant",
    shapes: [
      {
        id: "sequence-actor",
        title: "Actor Lifeline",
        defaultLabel: "Actor",
        keywords: ["user", "person", "lifeline"],
      },
      { id: "sequence-participant", title: "Participant", keywords: ["lifeline", "actor"] },
      {
        id: "sequence-activation",
        title: "Activation",
        defaultLabel: "",
        keywords: ["execution", "focus"],
      },
      {
        id: "sequence-message",
        title: "Message",
        defaultLabel: "request()",
        keywords: ["sync", "call", "request"],
      },
      {
        id: "sequence-message-async",
        title: "Async Message",
        defaultLabel: "event",
        keywords: ["signal", "event", "open arrow"],
      },
      {
        id: "sequence-message-return",
        title: "Return Message",
        defaultLabel: "response",
        keywords: ["response", "reply", "dashed"],
      },
      {
        id: "sequence-message-self",
        title: "Self Message",
        defaultLabel: "self()",
        keywords: ["recursive", "loop"],
      },
      {
        id: "sequence-frame",
        title: "Interaction Frame",
        defaultLabel: "alt",
        keywords: ["segment", "alt", "loop"],
      },
      {
        id: "sequence-reference",
        title: "Reference",
        defaultLabel: "Referenced interaction",
        keywords: ["ref", "interaction"],
      },
      {
        id: "sequence-note",
        title: "Sequence Note",
        defaultLabel: "Note",
        keywords: ["comment", "annotation"],
      },
      {
        id: "sequence-time",
        title: "Time Marker",
        defaultLabel: "Delay",
        keywords: ["delay", "wait", "timer"],
      },
      {
        id: "sequence-destroy",
        title: "Destroy",
        defaultLabel: "Destroyed",
        keywords: ["destroy", "end", "x"],
      },
    ],
  },
  {
    id: "architecture",
    title: "Architecture",
    representativeShapeId: "arch-backend",
    shapes: [
      { id: "arch-frontend", title: "Frontend", keywords: ["browser", "web", "client"] },
      { id: "arch-backend", title: "Backend Service", keywords: ["api", "server", "service"] },
      { id: "arch-database", title: "Database", keywords: ["store", "persistence", "db"] },
      { id: "arch-cloud", title: "Cloud Service", keywords: ["hosted", "platform"] },
      { id: "arch-security", title: "Security", keywords: ["auth", "gateway", "shield"] },
      { id: "arch-messagebus", title: "Message Bus", keywords: ["queue", "events", "stream"] },
      { id: "arch-external", title: "External System", keywords: ["third party", "integration"] },
    ],
  },
  {
    id: "boundaries",
    title: "Boundaries",
    representativeShapeId: "boundary-trust",
    shapes: [
      { id: "boundary-region", title: "Region", keywords: ["location", "zone"] },
      {
        id: "boundary-security-group",
        title: "Security Group",
        keywords: ["network", "firewall", "vpc"],
      },
      { id: "boundary-trust", title: "Trust Boundary", keywords: ["security", "scope"] },
      { id: "boundary-deployment", title: "Deployment Zone", keywords: ["cluster", "runtime"] },
      { id: "boundary-data", title: "Data Zone", keywords: ["pii", "sensitive", "privacy"] },
    ],
  },
  {
    id: "lifecycle",
    title: "Lifecycle",
    representativeShapeId: "lifecycle-active",
    shapes: [
      { id: "lifecycle-start", title: "Start", keywords: ["initial", "begin"] },
      { id: "lifecycle-active", title: "Active", keywords: ["running", "progress"] },
      { id: "lifecycle-waiting", title: "Waiting", keywords: ["paused", "pending", "retry"] },
      { id: "lifecycle-decision", title: "Decision", keywords: ["branch", "condition"] },
      { id: "lifecycle-success", title: "Success", keywords: ["complete", "passed"] },
      { id: "lifecycle-failure", title: "Failure", keywords: ["error", "failed"] },
      { id: "lifecycle-neutral", title: "Neutral", keywords: ["state", "idle"] },
      { id: "lifecycle-external", title: "External", keywords: ["outside", "dependency"] },
    ],
  },
  {
    id: "dataflow",
    title: "Data Flow",
    representativeShapeId: "data-transform",
    shapes: [
      { id: "data-source", title: "Data Source", keywords: ["input", "producer"] },
      { id: "data-transform", title: "Transform", keywords: ["process", "map", "compute"] },
      { id: "data-store", title: "Data Store", keywords: ["database", "warehouse", "lake"] },
      { id: "data-stream", title: "Stream", keywords: ["events", "queue", "topic"] },
      { id: "data-sink", title: "Consumer", keywords: ["sink", "output", "destination"] },
      { id: "data-protected", title: "Protected Data", keywords: ["pii", "encrypted", "secure"] },
      { id: "data-stage", title: "Processing Stage", keywords: ["phase", "column", "group"] },
    ],
  },
  {
    id: "annotations",
    title: "Annotations",
    representativeShapeId: "annotation-summary",
    shapes: [
      {
        id: "annotation-owner",
        title: "Owner Badge",
        defaultLabel: "Owner",
        keywords: ["team", "role", "person"],
      },
      {
        id: "annotation-technology",
        title: "Technology Badge",
        defaultLabel: "Technology",
        keywords: ["stack", "tool"],
      },
      { id: "annotation-legend", title: "Legend", keywords: ["key", "symbols"] },
      {
        id: "annotation-source",
        title: "Source Evidence",
        defaultLabel: "Source",
        keywords: ["file", "code", "reference"],
      },
      {
        id: "annotation-summary",
        title: "Summary Card",
        defaultLabel: "Summary",
        keywords: ["details", "notes", "facts"],
      },
      {
        id: "annotation-callout",
        title: "Callout",
        defaultLabel: "Note",
        keywords: ["note", "important", "tip"],
      },
    ],
  },
];

export const SEMANTIC_SHAPE_TYPES = new Set(
  SEMANTIC_ELEMENT_GROUPS.flatMap((category) => category.shapes.map((shape) => shape.id)),
);

/** Sequence primitives rendered as nodes. Message tools are attached edges. */
export const SEQUENCE_NODE_TYPES = new Set([
  "sequence-actor",
  "sequence-participant",
  "sequence-activation",
  "sequence-frame",
  "sequence-reference",
  "sequence-note",
  "sequence-time",
  "sequence-destroy",
]);

export const SEMANTIC_CONTAINER_TYPES = new Set([
  "sequence-frame",
  "boundary-region",
  "boundary-security-group",
  "boundary-trust",
  "boundary-deployment",
  "boundary-data",
  "data-stage",
]);

export const SEMANTIC_TEXT_BELOW_TYPES = new Set([
  "sequence-activation",
  "sequence-time",
  "sequence-destroy",
  "lifecycle-start",
  "lifecycle-active",
  "lifecycle-waiting",
  "lifecycle-decision",
  "lifecycle-success",
  "lifecycle-failure",
  "lifecycle-neutral",
  "lifecycle-external",
  "data-source",
  "data-transform",
  "data-store",
  "data-stream",
  "data-sink",
  "data-protected",
]);

/**
 * Artwork that intentionally fills a non-square visual area. All remaining
 * text-below semantic icons retain their square viewBox to avoid distortion.
 */
export const SEMANTIC_STRETCH_ARTWORK_TYPES = new Set(["sequence-activation", "sequence-destroy"]);

export type SemanticLabelPlacement =
  | "center"
  | "participant-header"
  | "actor-header"
  | "message-header"
  | "badge-body"
  | "card-header";

export function getSemanticLabelPlacement(type: string): SemanticLabelPlacement {
  if (type === "sequence-participant") return "participant-header";
  if (type === "sequence-actor") return "actor-header";
  if (
    type === "sequence-message" ||
    type === "sequence-message-async" ||
    type === "sequence-message-return" ||
    type === "sequence-message-self"
  ) {
    return "message-header";
  }
  if (type === "annotation-owner" || type === "annotation-technology") return "badge-body";
  if (
    type === "annotation-legend" ||
    type === "annotation-source" ||
    type === "annotation-summary" ||
    type === "annotation-callout"
  ) {
    return "card-header";
  }
  return "center";
}

/**
 * Every semantic element owns an explicit insertion size. Keeping this list
 * exhaustive prevents a new symbol from silently inheriting the generic
 * 160x100 rectangle and distorting its intended visual proportions.
 */
export const SEMANTIC_NODE_SIZES: Record<string, { width: number; height: number }> = {
  "sequence-actor": { width: 112, height: 240 },
  "sequence-participant": { width: 140, height: 240 },
  "sequence-activation": { width: 90, height: 182 },
  "sequence-message": { width: 220, height: 64 },
  "sequence-message-async": { width: 220, height: 64 },
  "sequence-message-return": { width: 220, height: 64 },
  "sequence-message-self": { width: 140, height: 92 },
  "sequence-frame": { width: 380, height: 280 },
  "sequence-reference": { width: 220, height: 120 },
  "sequence-note": { width: 170, height: 100 },
  "sequence-time": { width: 104, height: 126 },
  "sequence-destroy": { width: 96, height: 166 },
  "arch-frontend": { width: 160, height: 112 },
  "arch-backend": { width: 160, height: 112 },
  "arch-database": { width: 160, height: 112 },
  "arch-cloud": { width: 160, height: 112 },
  "arch-security": { width: 160, height: 112 },
  "arch-messagebus": { width: 160, height: 112 },
  "arch-external": { width: 160, height: 112 },
  "boundary-region": { width: 360, height: 260 },
  "boundary-security-group": { width: 320, height: 220 },
  "boundary-trust": { width: 340, height: 240 },
  "boundary-deployment": { width: 320, height: 220 },
  "boundary-data": { width: 320, height: 220 },
  "lifecycle-start": { width: 120, height: 142 },
  "lifecycle-active": { width: 120, height: 142 },
  "lifecycle-waiting": { width: 120, height: 142 },
  "lifecycle-decision": { width: 120, height: 142 },
  "lifecycle-success": { width: 120, height: 142 },
  "lifecycle-failure": { width: 120, height: 142 },
  "lifecycle-neutral": { width: 120, height: 142 },
  "lifecycle-external": { width: 120, height: 142 },
  "data-source": { width: 124, height: 146 },
  "data-transform": { width: 124, height: 146 },
  "data-store": { width: 124, height: 146 },
  "data-stream": { width: 124, height: 146 },
  "data-sink": { width: 124, height: 146 },
  "data-protected": { width: 124, height: 146 },
  "data-stage": { width: 300, height: 220 },
  "annotation-owner": { width: 180, height: 64 },
  "annotation-technology": { width: 180, height: 72 },
  "annotation-legend": { width: 180, height: 140 },
  "annotation-source": { width: 140, height: 160 },
  "annotation-summary": { width: 190, height: 140 },
  "annotation-callout": { width: 180, height: 120 },
};

export function getSemanticNodeSize(type: string) {
  if (!SEMANTIC_SHAPE_TYPES.has(type)) return null;
  return SEMANTIC_NODE_SIZES[type] ?? null;
}

type SemanticStyleDefaults = {
  fillColor: string;
  strokeColor: string;
  headerColor?: string;
  borderRadius?: number;
};

const DEFAULT_STYLE: SemanticStyleDefaults = {
  fillColor: "#ffffff",
  strokeColor: "#475569",
};

/**
 * Stored diagram colors intentionally use stable hex values instead of UI CSS
 * tokens so exported SVG/PNG output remains identical in every host theme.
 */
export function getSemanticStyleDefaults(type: string): SemanticStyleDefaults | null {
  if (!SEMANTIC_SHAPE_TYPES.has(type)) return null;

  if (type.startsWith("arch-")) {
    const accents: Record<string, string> = {
      "arch-frontend": "#2563eb",
      "arch-backend": "#4f46e5",
      "arch-database": "#059669",
      "arch-cloud": "#0284c7",
      "arch-security": "#ea580c",
      "arch-messagebus": "#9333ea",
      "arch-external": "#64748b",
    };
    return { fillColor: "#ffffff", strokeColor: accents[type] ?? DEFAULT_STYLE.strokeColor };
  }

  if (type.startsWith("lifecycle-")) {
    const accents: Record<string, string> = {
      "lifecycle-start": "#2563eb",
      "lifecycle-active": "#4f46e5",
      "lifecycle-waiting": "#d97706",
      "lifecycle-decision": "#7c3aed",
      "lifecycle-success": "#059669",
      "lifecycle-failure": "#dc2626",
      "lifecycle-neutral": "#64748b",
      "lifecycle-external": "#475569",
    };
    return { fillColor: "#ffffff", strokeColor: accents[type] ?? DEFAULT_STYLE.strokeColor };
  }

  if (type.startsWith("data-")) {
    return {
      fillColor: type === "data-protected" ? "#fff7ed" : "#f0fdfa",
      strokeColor: type === "data-protected" ? "#c2410c" : "#0f766e",
      ...(type === "data-stage" ? { headerColor: "#ccfbf1", borderRadius: 8 } : {}),
    };
  }

  if (type.startsWith("boundary-")) {
    return {
      fillColor: "#f8fafc",
      strokeColor: type === "boundary-data" ? "#c2410c" : "#475569",
      headerColor: type === "boundary-data" ? "#ffedd5" : "#e2e8f0",
      borderRadius: 8,
    };
  }

  if (type.startsWith("annotation-")) {
    return { fillColor: "#fffbeb", strokeColor: "#a16207" };
  }

  if (type.startsWith("sequence-")) {
    return {
      fillColor: "#ffffff",
      strokeColor: "#475569",
      ...(type === "sequence-frame" ? { headerColor: "#e2e8f0", borderRadius: 4 } : {}),
    };
  }

  return DEFAULT_STYLE;
}
