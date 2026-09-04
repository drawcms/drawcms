import { SHAPE_CATEGORIES } from "../components/shapes/catalog";
import { getNodeSize } from "../constants";
import type { DrawCMSDocument } from "../document/schema";
import { isSequenceEdgeType } from "../types";
import { sequenceRowFromHandle } from "../sequence-edges";

export const VISUAL_DIAGRAM_TYPES = [
  "general",
  "flowchart",
  "sequence",
  "architecture",
  "data-flow",
  "lifecycle",
  "uml",
  "bpmn",
  "entity-relationship",
] as const;

export type VisualDiagramType = (typeof VISUAL_DIAGRAM_TYPES)[number];
export type VisualElementKind = "node" | "connector" | "dynamic";
export type WebMCPBuildSupport = "full" | "requires-asset";

export interface VisualElementGrammar {
  id: string;
  title: string;
  categoryId: string;
  categoryTitle: string;
  kind: VisualElementKind;
  purpose: string;
  mostlyUsedFor: string[];
  avoidFor: string[];
  diagramTypes: VisualDiagramType[];
  suitableMotionPresets: string[];
  motionGuidance: string;
  keywords: string[];
  defaultLabel?: string;
  buildSupport: WebMCPBuildSupport;
}

export interface VisualMotionGrammar {
  id: string;
  target: "node" | "edge";
  purpose: string;
  mostlyUsedFor: string[];
  avoidFor: string[];
  directionality: "none" | "source-to-target" | "path";
  loopPolicy: "usually-once" | "ambient-loop" | "scene-controlled";
  reducedMotionAlternative: string;
}

export interface VisualRelationshipGrammar {
  id: string;
  purpose: string;
  sequenceConnectorType?: string;
  recommendedMotionPreset?: string;
  routing: "straight" | "elbow" | "curve";
  loop: boolean;
}

export interface VisualGrammarIssue {
  severity: "error" | "warning" | "suggestion";
  code: string;
  message: string;
  elementId?: string;
  suggestedFix?: string;
}

type ElementOverride = Partial<
  Pick<
    VisualElementGrammar,
    | "kind"
    | "purpose"
    | "mostlyUsedFor"
    | "avoidFor"
    | "diagramTypes"
    | "suitableMotionPresets"
    | "motionGuidance"
    | "buildSupport"
  >
>;

const CATEGORY_DEFAULTS: Record<
  string,
  Pick<
    VisualElementGrammar,
    | "purpose"
    | "mostlyUsedFor"
    | "avoidFor"
    | "diagramTypes"
    | "suitableMotionPresets"
    | "motionGuidance"
  >
> = {
  general: {
    purpose: "A general-purpose visual primitive.",
    mostlyUsedFor: ["lightweight diagrams", "custom notation", "visual emphasis"],
    avoidFor: ["specialized notation when a semantic element exists"],
    diagramTypes: ["general", "flowchart", "architecture"],
    suitableMotionPresets: ["Pulse Node"],
    motionGuidance: "Keep motion restrained unless the element represents an active state.",
  },
  arrows: {
    purpose: "A standalone directional symbol used as visual annotation.",
    mostlyUsedFor: ["direction labels", "navigation cues", "emphasis"],
    avoidFor: ["relationships between nodes; use a connector instead"],
    diagramTypes: ["general", "flowchart"],
    suitableMotionPresets: ["Pulse Node"],
    motionGuidance: "Prefer a connector animation when the arrow represents actual flow.",
  },
  sequence: {
    purpose: "A native sequence-diagram primitive.",
    mostlyUsedFor: ["ordered interactions", "calls and responses", "participant lifetimes"],
    avoidFor: ["unordered architecture topology"],
    diagramTypes: ["sequence"],
    suitableMotionPresets: ["Pulse Node", "Sequence Flow"],
    motionGuidance: "Animate messages once in chronological order; keep lifelines static.",
  },
  architecture: {
    purpose: "A semantic software-architecture component.",
    mostlyUsedFor: ["system boundaries", "service topology", "technical architecture"],
    avoidFor: ["fine-grained chronological steps"],
    diagramTypes: ["architecture"],
    suitableMotionPresets: ["Pulse Node"],
    motionGuidance: "Pulse only the component active in the current explanation step.",
  },
  boundaries: {
    purpose: "A semantic boundary that groups elements sharing a scope.",
    mostlyUsedFor: ["trust zones", "regions", "deployment or data boundaries"],
    avoidFor: ["individual services", "animated flow targets"],
    diagramTypes: ["architecture"],
    suitableMotionPresets: [],
    motionGuidance: "Boundaries should remain static; animate the contents or crossing connector.",
  },
  lifecycle: {
    purpose: "A semantic lifecycle state.",
    mostlyUsedFor: ["state progression", "health", "success and failure paths"],
    avoidFor: ["generic process steps without state meaning"],
    diagramTypes: ["lifecycle", "flowchart"],
    suitableMotionPresets: ["Pulse Node", "Shake"],
    motionGuidance: "Pulse active states; reserve Shake for an error or failed state.",
  },
  dataflow: {
    purpose: "A semantic data-flow stage or endpoint.",
    mostlyUsedFor: ["pipelines", "stream processing", "data lineage"],
    avoidFor: ["human actors", "control-only relationships"],
    diagramTypes: ["data-flow", "architecture"],
    suitableMotionPresets: ["Pulse Node"],
    motionGuidance: "Keep nodes mostly static and animate data-carrying connectors.",
  },
  annotations: {
    purpose: "An explanatory annotation that adds context without changing flow.",
    mostlyUsedFor: ["ownership", "technology", "evidence", "summaries"],
    avoidFor: ["process steps", "flow endpoints"],
    diagramTypes: ["general", "architecture", "data-flow", "lifecycle"],
    suitableMotionPresets: [],
    motionGuidance: "Annotations should remain static so motion retains semantic value.",
  },
  icons: {
    purpose: "A dynamic Iconify pictogram selected by name.",
    mostlyUsedFor: ["recognizable technologies", "compact visual labels", "decorative context"],
    avoidFor: ["unlabeled primary process steps"],
    diagramTypes: ["general", "architecture"],
    suitableMotionPresets: ["Pulse Node"],
    motionGuidance: "Use a subtle pulse only when the represented system becomes active.",
  },
  flowchart: {
    purpose: "A conventional flowchart symbol.",
    mostlyUsedFor: ["procedures", "algorithms", "decision paths"],
    avoidFor: ["sequence lifelines", "cloud-provider topology"],
    diagramTypes: ["flowchart"],
    suitableMotionPresets: ["Pulse Node"],
    motionGuidance: "Highlight the current step; animate connectors to show traversal.",
  },
  uml: {
    purpose: "A UML modeling element.",
    mostlyUsedFor: ["software design", "actors and components", "state or class models"],
    avoidFor: ["informal decoration"],
    diagramTypes: ["uml", "architecture"],
    suitableMotionPresets: ["Pulse Node"],
    motionGuidance: "Use motion only to explain a runtime interaction or active state.",
  },
  bpmn: {
    purpose: "A BPMN business-process element.",
    mostlyUsedFor: ["business workflows", "events", "tasks and gateways"],
    avoidFor: ["software call sequences"],
    diagramTypes: ["bpmn"],
    suitableMotionPresets: ["Pulse Node"],
    motionGuidance: "Animate the active token path rather than every BPMN element.",
  },
  er: {
    purpose: "An entity-relationship modeling element.",
    mostlyUsedFor: ["database models", "entities", "attributes and relationships"],
    avoidFor: ["runtime services", "request flows"],
    diagramTypes: ["entity-relationship"],
    suitableMotionPresets: [],
    motionGuidance: "ER notation is structural and should normally remain static.",
  },
  containers: {
    purpose: "A container for grouping or partitioning related elements.",
    mostlyUsedFor: ["scope", "ownership", "swimlanes", "visual organization"],
    avoidFor: ["atomic processing steps"],
    diagramTypes: ["general", "flowchart", "architecture", "bpmn"],
    suitableMotionPresets: [],
    motionGuidance: "Containers should stay static; animate their contents instead.",
  },
  aws: cloudCategory("AWS"),
  gcp: cloudCategory("Google Cloud"),
  azure: cloudCategory("Microsoft Azure"),
  infra: cloudCategory("infrastructure"),
};

function cloudCategory(provider: string) {
  return {
    purpose: `A recognizable ${provider} infrastructure or platform symbol.`,
    mostlyUsedFor: ["cloud architecture", "deployment topology", "service inventories"],
    avoidFor: ["a different provider", "generic flowchart steps"],
    diagramTypes: ["architecture"] as VisualDiagramType[],
    suitableMotionPresets: ["Pulse Node"],
    motionGuidance: "Pulse only when the service is active; use Data Flow on its connectors.",
  };
}

const ELEMENT_OVERRIDES: Record<string, ElementOverride> = {
  "round-rect": {
    purpose: "A neutral process, service, or stage when no specialized notation is required.",
    mostlyUsedFor: ["generic steps", "services", "named concepts"],
    avoidFor: ["decisions", "persistent stores", "human actors"],
  },
  diamond: {
    purpose: "A generic branch or decision point.",
    mostlyUsedFor: ["conditions", "yes/no branches", "routing choices"],
    avoidFor: ["ordinary processing steps"],
  },
  cylinder: {
    purpose: "A persistent data store using conventional cylinder notation.",
    mostlyUsedFor: ["databases", "durable storage", "data repositories"],
    avoidFor: ["DNS resolvers", "API servers", "stateless services"],
    suitableMotionPresets: ["Pulse Node"],
  },
  table: {
    purpose: "A structured table with named columns and data types.",
    mostlyUsedFor: ["database schemas", "records", "tabular models"],
    avoidFor: ["generic databases without column detail"],
    diagramTypes: ["entity-relationship", "data-flow"],
    suitableMotionPresets: [],
  },
  image: {
    purpose: "A user-supplied raster or vector image.",
    mostlyUsedFor: ["screenshots", "reference artwork", "visual evidence"],
    avoidFor: ["semantic notation that has a native DrawCMS element"],
    suitableMotionPresets: ["Pulse Node"],
    buildSupport: "requires-asset",
  },
  process: {
    purpose: "A processing or action step in a flowchart.",
    mostlyUsedFor: ["actions", "calculations", "workflow steps"],
    avoidFor: ["decisions", "stored data", "start or end events"],
  },
  decision: {
    purpose: "A decision that branches a flow based on a condition.",
    mostlyUsedFor: ["if/else", "approval gates", "conditional routing"],
    avoidFor: ["ordinary processing"],
  },
  terminator: {
    purpose: "The start or end boundary of a flowchart.",
    mostlyUsedFor: ["start", "end", "entry and exit points"],
    avoidFor: ["intermediate work"],
  },
  document: {
    purpose: "A document or document-shaped output.",
    mostlyUsedFor: ["reports", "files", "rendered documents"],
    avoidFor: ["network requests", "generic data packets"],
  },
  database: {
    purpose: "A persistent database or durable structured store.",
    mostlyUsedFor: ["SQL or NoSQL databases", "persistent application data"],
    avoidFor: ["DNS resolvers", "web servers", "message queues"],
  },
  actor: {
    purpose: "A human or external role interacting with a system.",
    mostlyUsedFor: ["users", "operators", "external roles"],
    avoidFor: ["software services", "databases"],
  },
  "uml-component": {
    purpose: "A deployable or replaceable software component.",
    mostlyUsedFor: ["applications", "services", "modules"],
    avoidFor: ["human actors", "stored data"],
  },
  "sequence-actor": {
    purpose: "A human actor with a native sequence-diagram lifeline.",
    mostlyUsedFor: ["users", "operators", "human participants"],
    avoidFor: ["software participants"],
    suitableMotionPresets: [],
  },
  "sequence-participant": {
    purpose: "A software or system participant with a native sequence lifeline.",
    mostlyUsedFor: ["clients", "services", "databases", "external systems"],
    avoidFor: ["standalone process steps"],
    suitableMotionPresets: [],
  },
  "sequence-activation": {
    purpose: "An activation bar showing when a participant is executing work.",
    mostlyUsedFor: ["processing duration", "nested calls", "participant focus"],
    avoidFor: ["participant identity", "messages"],
    suitableMotionPresets: ["Pulse Node"],
  },
  "sequence-message": sequenceMessage("A synchronous call or request message."),
  "sequence-message-async": sequenceMessage("An asynchronous event or signal message."),
  "sequence-message-return": sequenceMessage("A dashed response or return message."),
  "sequence-message-self": sequenceMessage("A participant calling itself."),
  "arch-frontend": {
    purpose: "A browser, mobile client, or other user-facing frontend.",
    mostlyUsedFor: ["web clients", "mobile apps", "desktop interfaces"],
    avoidFor: ["backend services", "databases"],
  },
  "arch-backend": {
    purpose: "A backend API, worker, or application service.",
    mostlyUsedFor: ["API servers", "workers", "business logic"],
    avoidFor: ["frontends", "persistent stores"],
  },
  "arch-database": {
    purpose: "A semantic persistent store in an architecture diagram.",
    mostlyUsedFor: ["application databases", "warehouses", "durable state"],
    avoidFor: ["caches or queues unless explicitly labeled"],
  },
  "arch-messagebus": {
    purpose: "A queue, topic, event bus, or streaming backbone.",
    mostlyUsedFor: ["asynchronous messaging", "queues", "event streaming"],
    avoidFor: ["synchronous APIs", "databases"],
  },
  "data-source": {
    purpose: "The producer or origin of data entering a pipeline.",
    mostlyUsedFor: ["inputs", "producers", "source systems"],
    avoidFor: ["pipeline destinations"],
  },
  "data-transform": {
    purpose: "A computation that transforms data from one representation to another.",
    mostlyUsedFor: ["ETL", "mapping", "aggregation", "enrichment"],
    avoidFor: ["passive storage"],
  },
  "data-store": {
    purpose: "A durable store within a data pipeline.",
    mostlyUsedFor: ["warehouses", "lakes", "databases"],
    avoidFor: ["streaming transport"],
  },
  "data-stream": {
    purpose: "A stream, topic, or queue carrying data between stages.",
    mostlyUsedFor: ["events", "queues", "streaming pipelines"],
    avoidFor: ["durable databases"],
  },
  "data-sink": {
    purpose: "The consumer or destination of a data pipeline.",
    mostlyUsedFor: ["outputs", "consumers", "downstream systems"],
    avoidFor: ["pipeline sources"],
  },
};

function sequenceMessage(purpose: string): ElementOverride {
  return {
    kind: "connector",
    purpose,
    mostlyUsedFor: ["ordered interactions", "request/response choreography"],
    avoidFor: ["static architecture dependencies"],
    diagramTypes: ["sequence"],
    suitableMotionPresets: ["Sequence Flow"],
    motionGuidance: "Play once at its chronological step; loop only the whole scene.",
  };
}

function buildElementGrammar(): VisualElementGrammar[] {
  const entries = SHAPE_CATEGORIES.flatMap((category) =>
    category.shapes.map((shape) => {
      const defaults = CATEGORY_DEFAULTS[category.id] ?? CATEGORY_DEFAULTS.general;
      const override = ELEMENT_OVERRIDES[shape.id] ?? {};
      return {
        id: shape.id,
        title: shape.title,
        categoryId: category.id,
        categoryTitle: category.title,
        kind: isSequenceEdgeType(shape.id) ? "connector" : "node",
        ...defaults,
        keywords: [...(shape.keywords ?? [])],
        ...(shape.defaultLabel !== undefined ? { defaultLabel: shape.defaultLabel } : {}),
        buildSupport: "full" as WebMCPBuildSupport,
        ...override,
      } satisfies VisualElementGrammar;
    }),
  );

  entries.push({
    id: "icon",
    title: "Icon",
    categoryId: "icons",
    categoryTitle: "Icons",
    kind: "dynamic",
    ...CATEGORY_DEFAULTS.icons,
    keywords: ["iconify", "symbol", "pictogram"],
    defaultLabel: "",
    buildSupport: "requires-asset",
  });
  return entries;
}

export const VISUAL_ELEMENT_REGISTRY = buildElementGrammar();

export const VISUAL_MOTION_REGISTRY: VisualMotionGrammar[] = [
  {
    id: "Bounce",
    target: "node",
    purpose: "Draw attention with playful vertical movement.",
    mostlyUsedFor: ["new arrivals", "lightweight success", "optional emphasis"],
    avoidFor: ["servers", "databases", "formal sequence diagrams", "continuous processing"],
    directionality: "none",
    loopPolicy: "usually-once",
    reducedMotionAlternative: "Briefly highlight the node border.",
  },
  {
    id: "Spin",
    target: "node",
    purpose: "Communicate rotation or an intentionally playful loading state.",
    mostlyUsedFor: ["rotation", "loading indicators"],
    avoidFor: ["ordinary services", "databases", "documents", "actors"],
    directionality: "none",
    loopPolicy: "usually-once",
    reducedMotionAlternative: "Use a static loading badge.",
  },
  {
    id: "Pulse Node",
    target: "node",
    purpose: "Highlight the component or state currently active.",
    mostlyUsedFor: ["active processing", "current focus", "state emphasis"],
    avoidFor: ["every node simultaneously", "static containers and annotations"],
    directionality: "none",
    loopPolicy: "scene-controlled",
    reducedMotionAlternative: "Increase border contrast for the active step.",
  },
  {
    id: "Shake",
    target: "node",
    purpose: "Signal an error, rejection, or invalid state.",
    mostlyUsedFor: ["failures", "validation errors", "retries"],
    avoidFor: ["healthy processing", "ambient decoration", "persistent looping"],
    directionality: "none",
    loopPolicy: "usually-once",
    reducedMotionAlternative: "Show a red error highlight or badge.",
  },
  {
    id: "Pulse",
    target: "edge",
    purpose: "Emphasize a relationship without implying packet movement.",
    mostlyUsedFor: ["active dependency", "selected relationship"],
    avoidFor: ["ordered request/response messages", "high-volume data streams"],
    directionality: "path",
    loopPolicy: "scene-controlled",
    reducedMotionAlternative: "Increase connector contrast.",
  },
  {
    id: "Data Flow",
    target: "edge",
    purpose: "Show data moving from a source toward a destination.",
    mostlyUsedFor: ["requests", "responses", "streams", "replication", "reads and writes"],
    avoidFor: ["containment", "static dependencies", "undirected associations"],
    directionality: "source-to-target",
    loopPolicy: "scene-controlled",
    reducedMotionAlternative: "Use a directional arrow with a highlighted destination.",
  },
  {
    id: "Sequence Flow",
    target: "edge",
    purpose: "Play an ordered message in a sequence or workflow.",
    mostlyUsedFor: ["calls", "returns", "chronological steps"],
    avoidFor: ["simultaneous looping on every message", "static topology"],
    directionality: "source-to-target",
    loopPolicy: "usually-once",
    reducedMotionAlternative: "Reveal or highlight the current message arrow.",
  },
  {
    id: "Sequential Glow",
    target: "edge",
    purpose: "Reveal a path in stages to communicate setup or progression.",
    mostlyUsedFor: ["handshakes", "multi-stage connections", "deployment progress"],
    avoidFor: ["steady data streams", "static relationships"],
    directionality: "source-to-target",
    loopPolicy: "usually-once",
    reducedMotionAlternative: "Highlight path segments in sequence.",
  },
  {
    id: "Fade Path",
    target: "edge",
    purpose: "Subtly reveal a secondary or low-priority relationship.",
    mostlyUsedFor: ["dependencies", "optional paths", "de-emphasized context"],
    avoidFor: ["critical errors", "high-volume data transfer"],
    directionality: "path",
    loopPolicy: "usually-once",
    reducedMotionAlternative: "Use a lower-contrast static connector.",
  },
  {
    id: "Orbit",
    target: "edge",
    purpose: "Show circulation, polling, or a repeated cycle around a relationship.",
    mostlyUsedFor: ["feedback loops", "polling", "cyclic synchronization"],
    avoidFor: ["one-way requests", "responses", "ordinary dependencies"],
    directionality: "path",
    loopPolicy: "ambient-loop",
    reducedMotionAlternative: "Use a loop label or bidirectional cycle marker.",
  },
];

export const VISUAL_RELATIONSHIP_REGISTRY: VisualRelationshipGrammar[] = [
  relationship(
    "request",
    "A call or request sent to another participant.",
    "sequence-message",
    "Sequence Flow",
  ),
  relationship(
    "response",
    "A reply returning to the caller.",
    "sequence-message-return",
    "Sequence Flow",
  ),
  relationship("async", "An asynchronous event or signal.", "sequence-message-async", "Data Flow"),
  relationship(
    "self-call",
    "Internal work performed by the same participant.",
    "sequence-message-self",
    "Pulse",
  ),
  relationship("data-flow", "Data moving from a producer to a consumer.", undefined, "Data Flow"),
  relationship(
    "handshake",
    "Connection negotiation or multi-stage setup.",
    undefined,
    "Sequential Glow",
  ),
  relationship(
    "dependency",
    "A static dependency or supporting relationship.",
    undefined,
    "Fade Path",
  ),
  relationship(
    "state-transition",
    "A transition from one lifecycle state to another.",
    undefined,
    "Sequential Glow",
  ),
  relationship("error", "A failed, rejected, or exceptional path.", undefined, "Pulse"),
  relationship("cycle", "A repeated loop, polling path, or circulation.", undefined, "Orbit", true),
];

function relationship(
  id: string,
  purpose: string,
  sequenceConnectorType?: string,
  recommendedMotionPreset?: string,
  // Relationship flow loops continuously by default, matching the WebMCP
  // motion tools' DEFAULT_MOTION_LOOP so recommend → replace round-trips
  // keep the animation alive. Sequence recommendations override this at
  // recommendation time because looping messages hide chronology.
  loop = true,
): VisualRelationshipGrammar {
  return {
    id,
    purpose,
    ...(sequenceConnectorType ? { sequenceConnectorType } : {}),
    ...(recommendedMotionPreset ? { recommendedMotionPreset } : {}),
    routing: id === "dependency" || id === "cycle" ? "curve" : "straight",
    loop,
  };
}

const ELEMENTS_BY_ID = new Map(VISUAL_ELEMENT_REGISTRY.map((entry) => [entry.id, entry]));
const MOTIONS_BY_ID = new Map(VISUAL_MOTION_REGISTRY.map((entry) => [entry.id, entry]));
const RELATIONSHIPS_BY_ID = new Map(VISUAL_RELATIONSHIP_REGISTRY.map((entry) => [entry.id, entry]));

export function getVisualElementGrammar(id: string): VisualElementGrammar | undefined {
  return ELEMENTS_BY_ID.get(id);
}

export function getVisualMotionGrammar(id: string): VisualMotionGrammar | undefined {
  return MOTIONS_BY_ID.get(id);
}

export function getVisualRelationshipGrammar(id: string): VisualRelationshipGrammar | undefined {
  return RELATIONSHIPS_BY_ID.get(id);
}

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function includesAny(value: string, candidates: string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate));
}

function chooseElementId(diagramType: VisualDiagramType, role: string, label: string): string {
  const meaning = `${normalize(role)} ${normalize(label)}`;
  if (diagramType === "sequence") {
    return includesAny(meaning, ["user", "actor", "person", "operator", "customer"])
      ? "sequence-actor"
      : "sequence-participant";
  }
  if (diagramType === "architecture") {
    if (includesAny(meaning, ["browser", "frontend", "mobile", "client", "ui"]))
      return "arch-frontend";
    if (includesAny(meaning, ["database", "store", "warehouse", "lake", "postgres", "mysql"]))
      return "arch-database";
    if (includesAny(meaning, ["queue", "topic", "stream", "event bus", "message bus"]))
      return "arch-messagebus";
    if (includesAny(meaning, ["auth", "security", "firewall", "gateway"])) return "arch-security";
    if (includesAny(meaning, ["external", "third party", "partner"])) return "arch-external";
    if (includesAny(meaning, ["cloud", "hosted", "platform"])) return "arch-cloud";
    return "arch-backend";
  }
  if (diagramType === "data-flow") {
    if (includesAny(meaning, ["source", "producer", "input"])) return "data-source";
    if (includesAny(meaning, ["database", "store", "warehouse", "lake"])) return "data-store";
    if (includesAny(meaning, ["stream", "queue", "topic", "event"])) return "data-stream";
    if (includesAny(meaning, ["sink", "consumer", "destination", "output"])) return "data-sink";
    if (includesAny(meaning, ["protected", "private", "pii", "encrypted"])) return "data-protected";
    return "data-transform";
  }
  if (diagramType === "lifecycle") {
    if (includesAny(meaning, ["start", "initial", "begin"])) return "lifecycle-start";
    if (includesAny(meaning, ["wait", "pending", "retry", "pause"])) return "lifecycle-waiting";
    if (includesAny(meaning, ["decision", "condition", "branch"])) return "lifecycle-decision";
    if (includesAny(meaning, ["success", "complete", "passed", "done"])) return "lifecycle-success";
    if (includesAny(meaning, ["fail", "error", "rejected"])) return "lifecycle-failure";
    if (includesAny(meaning, ["external", "dependency"])) return "lifecycle-external";
    return "lifecycle-active";
  }
  if (diagramType === "flowchart") {
    if (includesAny(meaning, ["start", "end", "finish", "terminator"])) return "terminator";
    if (includesAny(meaning, ["decision", "condition", "branch", "if"])) return "decision";
    if (includesAny(meaning, ["database", "store", "persist"])) return "database";
    if (includesAny(meaning, ["document", "report", "file"])) return "document";
    if (includesAny(meaning, ["input", "output", "data"])) return "data";
    return "process";
  }
  if (diagramType === "bpmn") {
    if (includesAny(meaning, ["start", "begin"])) return "bpmn-start";
    if (includesAny(meaning, ["end", "finish"])) return "bpmn-end";
    if (includesAny(meaning, ["parallel", "fork", "join"])) return "bpmn-gateway-parallel";
    if (includesAny(meaning, ["decision", "exclusive", "xor"])) return "bpmn-gateway-exclusive";
    return "bpmn-task";
  }
  if (diagramType === "entity-relationship") {
    if (includesAny(meaning, ["relationship", "relation"])) return "er-relationship";
    if (includesAny(meaning, ["key", "primary"])) return "er-key-attribute";
    if (includesAny(meaning, ["attribute", "field", "column"])) return "er-attribute";
    return "er-entity";
  }
  if (diagramType === "uml") {
    if (includesAny(meaning, ["user", "actor", "person"])) return "actor";
    if (includesAny(meaning, ["interface", "contract"])) return "uml-interface";
    if (includesAny(meaning, ["package", "module"])) return "uml-package";
    if (includesAny(meaning, ["state"])) return "uml-state";
    if (includesAny(meaning, ["class", "model", "entity"])) return "uml-class";
    return "uml-component";
  }
  return "round-rect";
}

/** Classify free-text relationship intent into a registered semantic kind. */
export function normalizeRelationshipKind(
  kind: string,
  label: string,
  diagramType: VisualDiagramType,
) {
  const meaning = `${normalize(kind)} ${normalize(label)}`;
  if (includesAny(meaning, ["response", "return", "reply", "result"])) return "response";
  if (includesAny(meaning, ["async", "event", "publish", "signal", "notify"])) return "async";
  if (includesAny(meaning, ["self", "internal", "recursive"])) return "self-call";
  if (includesAny(meaning, ["handshake", "tls", "connect", "negotiate"])) return "handshake";
  if (includesAny(meaning, ["error", "failure", "reject", "exception"])) return "error";
  if (includesAny(meaning, ["cycle", "poll", "loop", "sync repeatedly"])) return "cycle";
  if (includesAny(meaning, ["dependency", "depends", "uses"])) return "dependency";
  if (includesAny(meaning, ["transition", "state change"])) return "state-transition";
  if (includesAny(meaning, ["data", "stream", "read", "write", "replicate"])) return "data-flow";
  return diagramType === "sequence" ? "request" : "data-flow";
}

export function recommendVisualGrammar(input: {
  diagramType: VisualDiagramType;
  entities: Array<{ id: string; label: string; role?: string }>;
  relationships?: Array<{
    id?: string;
    source: string;
    target: string;
    label?: string;
    kind?: string;
  }>;
  animationGoal?: "explain-flow" | "highlight-change" | "show-state" | "none";
}) {
  const elements = input.entities.map((entity) => {
    const elementId = chooseElementId(input.diagramType, entity.role ?? "", entity.label);
    const grammar = ELEMENTS_BY_ID.get(elementId) ?? ELEMENTS_BY_ID.get("round-rect")!;
    return {
      entityId: entity.id,
      elementId: grammar.id,
      elementTitle: grammar.title,
      rationale: grammar.purpose,
      motionPreset:
        input.animationGoal === "show-state" && grammar.suitableMotionPresets.includes("Pulse Node")
          ? "Pulse Node"
          : null,
      motionGuidance: grammar.motionGuidance,
    };
  });

  const relationships = (input.relationships ?? []).map((item, index) => {
    const relationshipId = normalizeRelationshipKind(
      item.kind ?? "",
      item.label ?? "",
      input.diagramType,
    );
    const grammar =
      RELATIONSHIPS_BY_ID.get(relationshipId) ?? RELATIONSHIPS_BY_ID.get("data-flow")!;
    const motionPreset = input.animationGoal === "none" ? null : grammar.recommendedMotionPreset;
    return {
      relationshipId: item.id ?? `relationship-${index + 1}`,
      semanticType: grammar.id,
      connectorType:
        input.diagramType === "sequence"
          ? (grammar.sequenceConnectorType ?? "sequence-message")
          : null,
      routing: grammar.routing,
      motionPreset: motionPreset ?? null,
      // Loop whenever a flow preset is actually recommended, except sequence
      // diagrams whose numbered message rows must play once in order (the
      // validator flags simultaneous looping sequence messages as
      // SIMULTANEOUS_SEQUENCE_LOOPS). With no preset there is nothing to loop.
      loop: motionPreset !== null && input.diagramType !== "sequence" ? grammar.loop : false,
      order: index + 1,
      startAfterMs: input.animationGoal === "explain-flow" ? index * 1_000 : 0,
      rationale: grammar.purpose,
    };
  });

  return {
    diagramType: input.diagramType,
    layout:
      input.diagramType === "sequence"
        ? "Participants across the top; time flows downward; use native lifelines and activation bars."
        : "Use the semantic conventions of the selected diagram type and minimize connector crossings.",
    animation:
      input.animationGoal === "explain-flow"
        ? "Flow animations loop continuously and start in relationship order; presentation steps sequence the narration."
        : input.animationGoal === "none"
          ? "Keep the diagram static."
          : "Animate only the element or relationship currently being explained.",
    elements,
    relationships,
  };
}

/**
 * Pure classification usable both against a live document's node types
 * (inferVisualDiagramType) and against WebMCP tool input before a document
 * exists (webmcp/layout.ts, which needs a diagram type to choose a layout
 * strategy for nodes with no explicit position).
 */
export function inferDiagramTypeFromNodeTypes(
  nodeTypes: readonly string[],
  hasSequenceEdge: boolean,
): VisualDiagramType {
  if (hasSequenceEdge || nodeTypes.some((type) => type.startsWith("sequence-"))) return "sequence";
  if (nodeTypes.some((type) => type.startsWith("bpmn-"))) return "bpmn";
  if (nodeTypes.some((type) => type.startsWith("er-"))) return "entity-relationship";
  if (nodeTypes.some((type) => type.startsWith("data-"))) return "data-flow";
  if (nodeTypes.some((type) => type.startsWith("lifecycle-"))) return "lifecycle";
  if (
    nodeTypes.some(
      (type) =>
        type.startsWith("arch-") ||
        type.startsWith("boundary-") ||
        type.startsWith("aws-") ||
        type.startsWith("gcp-") ||
        type.startsWith("azure-") ||
        type.startsWith("infra-"),
    )
  )
    return "architecture";
  if (nodeTypes.some((type) => type.startsWith("uml-") || type === "actor" || type === "use-case"))
    return "uml";
  if (
    nodeTypes.some((type) =>
      ["process", "decision", "terminator", "document", "data", "database"].includes(type),
    )
  )
    return "flowchart";
  return "general";
}

export function inferVisualDiagramType(document: DrawCMSDocument): VisualDiagramType {
  const nodeTypes = document.nodes.map((node) => node.data.type);
  const sequenceEdge = document.edges.some((edge) => isSequenceEdgeType(edge.data?.sequenceType));
  return inferDiagramTypeFromNodeTypes(nodeTypes, sequenceEdge);
}

export function validateDiagramVisualGrammar(
  document: DrawCMSDocument,
  requestedDiagramType?: VisualDiagramType,
) {
  const diagramType = requestedDiagramType ?? inferVisualDiagramType(document);
  const issues: VisualGrammarIssue[] = [];

  for (const node of document.nodes) {
    const grammar = ELEMENTS_BY_ID.get(node.data.type);
    if (!grammar) {
      issues.push({
        severity: "error",
        code: "UNREGISTERED_ELEMENT",
        elementId: node.id,
        message: `Element type ${node.data.type} is not registered in the DrawCMS visual grammar.`,
        suggestedFix: "Choose an element returned by drawcms_get_visual_grammar.",
      });
      continue;
    }
    if (grammar.kind === "connector") {
      issues.push({
        severity: "error",
        code: "CONNECTOR_STORED_AS_NODE",
        elementId: node.id,
        message: `${grammar.title} is a connector element and should be attached between participants.`,
        suggestedFix: "Use the edge type field instead of creating a node.",
      });
    }

    const preset = node.data.preset;
    if (preset) {
      const motion = MOTIONS_BY_ID.get(preset);
      if (!motion || motion.target !== "node") {
        issues.push({
          severity: "error",
          code: "INVALID_NODE_MOTION",
          elementId: node.id,
          message: `${preset} is not a registered node motion preset.`,
        });
      } else if (!grammar.suitableMotionPresets.includes(preset)) {
        issues.push({
          severity: "warning",
          code: "MOTION_ELEMENT_MISMATCH",
          elementId: node.id,
          message: `${preset} is not recommended for ${grammar.title}.`,
          suggestedFix: grammar.motionGuidance,
        });
      }
    }

    const label = normalize(node.data.label);
    if (
      (node.data.type === "database" || node.data.type === "cylinder") &&
      includesAny(label, ["dns resolver", "web server", "api server", "service"])
    ) {
      issues.push({
        severity: "warning",
        code: "DATASTORE_SEMANTIC_MISMATCH",
        elementId: node.id,
        message: `${node.data.label} uses a persistent-store shape even though its label describes a service.`,
        suggestedFix:
          diagramType === "sequence"
            ? "Use sequence-participant."
            : "Use arch-backend or another service/component element.",
      });
    }
  }

  const loopingSequenceEdges: string[] = [];
  for (const edge of document.edges) {
    const preset = edge.data?.preset;
    if (preset) {
      const motion = MOTIONS_BY_ID.get(preset);
      if (!motion || motion.target !== "edge") {
        issues.push({
          severity: "error",
          code: "INVALID_EDGE_MOTION",
          elementId: edge.id,
          message: `${preset} is not a registered edge motion preset.`,
        });
      }
    }
    const sequenceType = edge.data?.sequenceType;
    if (sequenceType && !isSequenceEdgeType(sequenceType)) {
      issues.push({
        severity: "error",
        code: "INVALID_SEQUENCE_CONNECTOR",
        elementId: edge.id,
        message: `${sequenceType} is not a registered sequence connector type.`,
      });
    }
    if (diagramType === "sequence" && preset && edge.data?.motionLoop !== false) {
      loopingSequenceEdges.push(edge.id);
    }
    if (
      diagramType === "sequence" &&
      includesAny(normalize(String(edge.label ?? edge.data?.label ?? "")), [
        "response",
        "return",
        "reply",
      ]) &&
      sequenceType !== "sequence-message-return"
    ) {
      issues.push({
        severity: "warning",
        code: "RETURN_CONNECTOR_MISMATCH",
        elementId: edge.id,
        message: "A response or return should use the native dashed return-message connector.",
        suggestedFix: "Set edge type to sequence-message-return.",
      });
    }
  }

  if (loopingSequenceEdges.length > 1) {
    issues.push({
      severity: "warning",
      code: "SIMULTANEOUS_SEQUENCE_LOOPS",
      message: `${loopingSequenceEdges.length} sequence messages loop independently, which hides chronology.`,
      suggestedFix: "Play each message once in order, then loop the complete scene if needed.",
    });
  }

  if (
    diagramType === "sequence" &&
    !document.nodes.some((node) =>
      ["sequence-actor", "sequence-participant"].includes(node.data.type),
    )
  ) {
    issues.push({
      severity: "suggestion",
      code: "USE_NATIVE_SEQUENCE_PARTICIPANTS",
      message: "The sequence diagram does not use native participant lifelines.",
      suggestedFix: "Use sequence-actor and sequence-participant instead of generic shapes.",
    });
  }

  // A sequence row is a single time slot on the diagram: two messages
  // sharing one collapse into the same visual position and hide their
  // relative order. Self-messages legitimately occupy two rows for their
  // own send/receive pair, so only flag a row shared *across* messages.
  const rowOwners = new Map<number, string>();
  for (const edge of document.edges) {
    for (const handle of [edge.sourceHandle, edge.targetHandle]) {
      const row = sequenceRowFromHandle(handle);
      if (row === null) continue;
      const owner = rowOwners.get(row);
      if (owner && owner !== edge.id) {
        issues.push({
          severity: "error",
          code: "SEQUENCE_ROW_COLLISION",
          elementId: edge.id,
          message: `Sequence row ${row} is shared by ${owner} and ${edge.id}, which hides their chronological order.`,
          suggestedFix: "Give each message its own row, in the order it occurs.",
        });
      } else {
        rowOwners.set(row, edge.id);
      }
    }
  }

  // Bounding-box overlap: siblings only, since a container is expected to
  // fully enclose its children and comparing across the parent boundary
  // would only produce noise.
  const nodeBounds = document.nodes.map((node) => {
    const fallback = getNodeSize(node.data.type);
    const width = Number(node.style?.width ?? fallback.width) || fallback.width || 1;
    const height = Number(node.style?.height ?? fallback.height) || fallback.height || 1;
    return {
      id: node.id,
      parentId: node.parentId,
      x: node.position.x,
      y: node.position.y,
      width,
      height,
    };
  });
  for (let i = 0; i < nodeBounds.length; i++) {
    for (let j = i + 1; j < nodeBounds.length; j++) {
      const a = nodeBounds[i];
      const b = nodeBounds[j];
      if (a.parentId !== b.parentId) continue;
      const overlaps =
        a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      if (overlaps) {
        issues.push({
          severity: "warning",
          code: "OVERLAPPING_ELEMENTS",
          elementId: a.id,
          message: `${a.id} and ${b.id} overlap on the canvas.`,
          suggestedFix: "Reposition one of the elements so they no longer intersect.",
        });
      }
    }
  }

  // Registry-declared unsuitable preset/loop combinations, beyond the
  // element-specific MOTION_ELEMENT_MISMATCH check above (e.g. an
  // error-signaling preset left looping forever, or an ambient-loop preset
  // playing only once).
  for (const node of document.nodes) {
    const motion = node.data.preset ? MOTIONS_BY_ID.get(node.data.preset) : undefined;
    if (!motion) continue;
    const looping = node.data.motionLoop !== false;
    if (motion.loopPolicy === "usually-once" && looping) {
      issues.push({
        severity: "suggestion",
        code: "UNSUITABLE_LOOP_POLICY",
        elementId: node.id,
        message: `${motion.id} usually plays once; looping it forever can read as a stuck or broken state.`,
        suggestedFix: motion.reducedMotionAlternative,
      });
    }
  }
  for (const edge of document.edges) {
    const motion = edge.data?.preset ? MOTIONS_BY_ID.get(edge.data.preset) : undefined;
    if (!motion) continue;
    const looping = edge.data?.motionLoop !== false;
    if (motion.loopPolicy === "ambient-loop" && !looping) {
      issues.push({
        severity: "suggestion",
        code: "UNSUITABLE_LOOP_POLICY",
        elementId: edge.id,
        message: `${motion.id} represents an ongoing cycle; playing it once undersells the relationship it depicts.`,
        suggestedFix: "Enable loop, or choose a once-only preset such as Sequence Flow.",
      });
    }
  }

  // Narrative coverage: every element with motion should be explained by at
  // least one story step, and every story step should carry a description
  // rather than a title alone once the diagram author is narrating at all.
  const story = document.motion.story;
  if (story) {
    const narratedIds = new Set(
      story.scenes.flatMap((scene) =>
        scene.steps.flatMap((step) => step.targets.map((t) => t.targetId)),
      ),
    );
    const isNarrating = story.scenes.some((scene) => scene.steps.length > 0);
    if (isNarrating) {
      for (const node of document.nodes) {
        if (node.data.preset && !narratedIds.has(node.id)) {
          issues.push({
            severity: "suggestion",
            code: "UNNARRATED_ELEMENT",
            elementId: node.id,
            message: `${node.id} animates but is not referenced by any presentation step.`,
            suggestedFix:
              "Add a story step that targets this element, or remove its motion preset.",
          });
        }
      }
      for (const scene of story.scenes) {
        for (const step of scene.steps) {
          if (!step.description?.trim()) {
            issues.push({
              severity: "suggestion",
              code: "STEP_MISSING_DESCRIPTION",
              elementId: step.id,
              message: `Step "${step.title}" has no description explaining what it shows.`,
              suggestedFix: "Add a one-sentence explanation viewers will read during this step.",
            });
          }
        }
      }
    }
  }

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    diagramType,
    issueCount: issues.length,
    issues,
  };
}
