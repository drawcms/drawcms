import { nodeBox } from "./routing";
import { SHAPE_CATEGORIES } from "../components/shapes/catalog";
import { SEMANTIC_CONTAINER_TYPES } from "../components/shapes/semantic-elements";
import type { DrawCMSDocument } from "../document/schema";
import {
  STRUCTURAL_NOTATION_DIAGRAM_TYPES,
  type EdgeNotation,
  type RouteIssueCode,
  type VisualDiagramType,
} from "../document/diagram-types";
import { isSequenceEdgeType } from "../types";
import { sequenceRowFromHandle } from "../sequence-edges";

export { VISUAL_DIAGRAM_TYPES } from "../document/diagram-types";
export type { VisualDiagramType } from "../document/diagram-types";
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
  /** The `notation` value to pass for this relationship on a built connector. */
  notation: EdgeNotation;
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
    diagramTypes: ["uml", "architecture", "use-case"],
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
    diagramTypes: ["entity-relationship", "database-model", "data-flow"],
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
  // Structural relationships. These describe how two elements are related
  // rather than something happening between them at runtime, so they carry no
  // motion and no arrowhead — an animated arrow would imply an order that a
  // structural diagram does not describe.
  structuralRelationship(
    "association",
    "An undirected structural link: an ER relationship, a UML association, or an actor's participation in a use case.",
    "association",
  ),
  structuralRelationship(
    "include",
    "A use case that always incorporates another use case's behavior. Points from the base goal to the included goal.",
    "include",
  ),
  structuralRelationship(
    "extend",
    "A use case that conditionally extends another. Points from the extension to the base goal.",
    "extend",
  ),
  structuralRelationship(
    "message-flow",
    "A BPMN message crossing a pool boundary between two participants. Never valid on a gateway.",
    "message-flow",
  ),
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
    notation: "directed",
  };
}

/**
 * A relationship that exists in the model rather than at runtime. It routes as
 * an elbow (structural diagrams read as orthogonal schematics, not flows),
 * never loops, and recommends no motion preset.
 */
function structuralRelationship(
  id: string,
  purpose: string,
  notation: EdgeNotation,
): VisualRelationshipGrammar {
  return { id, purpose, routing: "elbow", loop: false, notation };
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

/**
 * Flatten a role/label to space-delimited words for whole-word matching.
 *
 * Punctuation becomes a space so "third-party API" reads as the three words
 * "third party api", and the result is padded so a term can be matched with
 * surrounding spaces. Without this, substring matching picks the wrong shape
 * for innocent labels: "Build pipeline" contains "ui" and "Circuit breaker"
 * contains "ui", so both used to classify as a frontend.
 */
function searchableWords(...values: Array<string | undefined>): string {
  const flattened = values
    .map((value) => normalize(value))
    .join(" ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return ` ${flattened} `;
}

/**
 * Whole-word / whole-phrase match against text from `searchableWords`,
 * tolerating a simple plural so "Dashboards" still matches "dashboard".
 */
function matchesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => new RegExp(`\\s${term}(?:s|es)?\\s`).test(text));
}

/**
 * Pick the element that best represents a described thing.
 *
 * Both `role` and `label` are searched. The role is the stronger hint so it is
 * listed first, but the label is never discarded — an entity given
 * `{ role: "component", label: "Postgres" }` should still be drawn as a
 * datastore, and the previous `role || label` meant the label was invisible
 * whenever a role was supplied at all.
 */
function chooseElementId(diagramType: VisualDiagramType, role: string, label: string): string {
  const text = searchableWords(role, label);
  // A trailing question mark is the clearest signal a step is a branch, and it
  // survives wording the keyword lists cannot anticipate ("Payment accepted?").
  const asksQuestion = /\?/.test(role) || /\?/.test(label);
  // A named technology should be drawn as itself rather than as a generic box.
  const branded = BRANDED_INFRA_ELEMENTS.find((entry) => matchesAny(text, entry.terms));

  if (diagramType === "sequence") {
    // A software participant can easily carry a human-sounding name ("User
    // service"), so an explicit software signal is checked first.
    if (
      matchesAny(text, ["service", "api", "server", "system", "worker", "job", ...DATASTORE_TERMS])
    )
      return "sequence-participant";
    return matchesAny(text, ACTOR_TERMS) ? "sequence-actor" : "sequence-participant";
  }
  if (diagramType === "architecture") {
    if (branded) return branded.id;
    if (
      matchesAny(text, [
        "browser",
        "frontend",
        "front end",
        "mobile",
        "client",
        "ui",
        "spa",
        "storefront",
        "web app",
        "webapp",
        "portal",
      ])
    )
      return "arch-frontend";
    if (matchesAny(text, DATASTORE_TERMS)) return "arch-database";
    if (matchesAny(text, MESSAGING_TERMS)) return "arch-messagebus";
    // "gateway" deliberately excluded: an API gateway routes traffic, it is not
    // a security control, and drawing it with the shield shape misleads.
    if (
      matchesAny(text, [
        "auth",
        "authentication",
        "authorization",
        "oauth",
        "sso",
        "identity",
        "firewall",
        "waf",
        "security",
        "iam",
        "secret",
        "vault",
        "certificate",
      ])
    )
      return "arch-security";
    if (matchesAny(text, ["external", "third party", "partner", "vendor", "saas", "upstream"]))
      return "arch-external";
    if (matchesAny(text, ["cloud", "hosted", "platform", "serverless"])) return "arch-cloud";
    return "arch-backend";
  }
  if (diagramType === "data-flow") {
    if (
      matchesAny(text, ["sink", "consumer", "destination", "output", "dashboard", "report", "bi"])
    )
      return "data-sink";
    if (matchesAny(text, ["protected", "private", "pii", "encrypted", "vault", "secret"]))
      return "data-protected";
    if (matchesAny(text, DATASTORE_TERMS)) return "data-store";
    if (matchesAny(text, [...MESSAGING_TERMS, "ingest", "feed"])) return "data-stream";
    if (
      matchesAny(text, [
        "source",
        "producer",
        "input",
        "app",
        "client",
        "device",
        "sensor",
        "upload",
      ])
    )
      return "data-source";
    return "data-transform";
  }
  if (diagramType === "lifecycle") {
    if (asksQuestion || matchesAny(text, ["decision", "condition", "branch", "check"]))
      return "lifecycle-decision";
    if (matchesAny(text, ["start", "initial", "begin", "draft", "new", "created"]))
      return "lifecycle-start";
    if (
      matchesAny(text, [
        "wait",
        "waiting",
        "pending",
        "retry",
        "pause",
        "review",
        "queued",
        "blocked",
        "hold",
        "scheduled",
      ])
    )
      return "lifecycle-waiting";
    if (
      matchesAny(text, [
        "success",
        "complete",
        "completed",
        "passed",
        "done",
        "published",
        "live",
        "approved",
      ])
    )
      return "lifecycle-success";
    if (matchesAny(text, ["fail", "failed", "failure", "error", "rejected", "denied"]))
      return "lifecycle-failure";
    if (matchesAny(text, ["external", "dependency", "third party"])) return "lifecycle-external";
    if (matchesAny(text, ["active", "running", "progress", "processing", "open"]))
      return "lifecycle-active";
    // An unclassified state is exactly what lifecycle-neutral is for; calling it
    // "Active" would assert progress the label never claimed.
    return "lifecycle-neutral";
  }
  if (diagramType === "flowchart") {
    if (asksQuestion || matchesAny(text, ["decision", "condition", "branch", "if", "whether"]))
      return "decision";
    if (matchesAny(text, ["start", "end", "finish", "terminator", "begin", "stop"]))
      return "terminator";
    if (matchesAny(text, ["wait", "delay", "sleep", "pause", "timeout"])) return "delay";
    if (matchesAny(text, ["manual review", "manual", "by hand", "offline"]))
      return "manual-operation";
    if (matchesAny(text, ["enter", "form", "user input", "keyed", "type in"]))
      return "manual-input";
    if (matchesAny(text, ["display", "show", "screen", "render"])) return "display";
    if (matchesAny(text, ["initialize", "initialise", "setup", "prepare", "configure"]))
      return "preparation";
    if (matchesAny(text, [...DATASTORE_TERMS, "persist", "lookup", "query"])) return "database";
    if (matchesAny(text, ["document", "report", "invoice", "receipt", "file", "print"]))
      return "document";
    if (matchesAny(text, ["input", "output", "data", "payload"])) return "data";
    return "process";
  }
  if (diagramType === "bpmn") {
    if (asksQuestion || matchesAny(text, ["decision", "exclusive", "xor", "gateway"]))
      return "bpmn-gateway-exclusive";
    if (matchesAny(text, ["parallel", "fork", "join", "and gateway"]))
      return "bpmn-gateway-parallel";
    if (matchesAny(text, ["inclusive", "or gateway"])) return "bpmn-gateway-inclusive";
    if (matchesAny(text, ["start", "begin", "received", "submitted", "triggered", "requested"]))
      return "bpmn-start";
    if (
      matchesAny(text, [
        "end",
        "finish",
        "closed",
        "close",
        "completed",
        "cancelled",
        "canceled",
        "archived",
      ])
    )
      return "bpmn-end";
    if (matchesAny(text, ["timer", "intermediate", "boundary event", "escalation"]))
      return "bpmn-intermediate";
    return "bpmn-task";
  }
  if (diagramType === "use-case") {
    // The goal is checked first: "View user profile" is a use case that merely
    // mentions a user, not an actor.
    if (matchesAny(text, ["use case", "goal", "capability", "feature"])) return "use-case";
    return matchesAny(text, [...ACTOR_TERMS, "external system", "system"]) ? "actor" : "use-case";
  }
  if (diagramType === "database-model") return "table";
  if (diagramType === "entity-relationship") {
    if (matchesAny(text, ["weak entity", "weak"])) return "er-weak-entity";
    if (matchesAny(text, ["relationship", "relation"])) return "er-relationship";
    if (matchesAny(text, ["multivalued", "multi valued", "many valued"])) return "er-multivalued";
    if (matchesAny(text, ["derived", "computed", "calculated"])) return "er-derived";
    if (matchesAny(text, ["key", "primary", "identifier"])) return "er-key-attribute";
    if (matchesAny(text, ["attribute", "field", "column", "property"])) return "er-attribute";
    return "er-entity";
  }
  if (diagramType === "uml") {
    if (matchesAny(text, ["use case", "goal"])) return "use-case";
    // Narrower than ACTOR_TERMS on purpose: "Customer" and "User" are ordinary
    // class names in a domain model, so only an explicit actor word wins here.
    if (matchesAny(text, ["actor", "person", "human", "operator"])) return "actor";
    if (matchesAny(text, ["interface", "contract", "port", "protocol"])) return "uml-interface";
    if (matchesAny(text, ["package", "module", "namespace"])) return "uml-package";
    if (matchesAny(text, ["state", "status"])) return "uml-state";
    if (matchesAny(text, ["note", "comment"])) return "uml-note";
    if (matchesAny(text, ["artifact", "binary", "jar", "config file"])) return "uml-artifact";
    if (matchesAny(text, ["instance", "object"])) return "uml-object";
    if (matchesAny(text, ["component", "adapter", "subsystem", "deployable"]))
      return "uml-component";
    // A plain domain noun is a class, not a deployable component.
    return "uml-class";
  }
  // `general` has proper elements for the common cases; round-rect's own
  // avoidFor calls out decisions, stores and actors, so falling back to it for
  // exactly those was self-contradicting.
  if (asksQuestion || matchesAny(text, ["decision", "condition", "branch"])) return "diamond";
  if (matchesAny(text, DATASTORE_TERMS)) return "database";
  if (matchesAny(text, ACTOR_TERMS)) return "actor";
  if (matchesAny(text, ["note", "comment", "annotation"])) return "note";
  if (matchesAny(text, ["start", "end", "terminator"])) return "terminator";
  return "round-rect";
}

const ACTOR_TERMS = ["user", "actor", "person", "operator", "customer", "admin", "human"];

const DATASTORE_TERMS = [
  "database",
  "db",
  "datastore",
  "data store",
  "store",
  "storage",
  "warehouse",
  "data lake",
  "lake",
  "table",
  "bucket",
  "object storage",
  "blob storage",
  "cache",
  "persistence",
];

const MESSAGING_TERMS = [
  "queue",
  "topic",
  "stream",
  "event bus",
  "message bus",
  "broker",
  "pubsub",
  "pub sub",
  "event",
];

/**
 * Technologies that ship their own recognizable mark. An agent naming one of
 * these should get that logo rather than a generic service box, which is the
 * difference between a reader recognizing "Redis" at a glance and reading it.
 */
const BRANDED_INFRA_ELEMENTS: Array<{ id: string; terms: string[] }> = [
  { id: "infra-redis", terms: ["redis"] },
  { id: "infra-postgresql", terms: ["postgres", "postgresql"] },
  { id: "infra-mongodb", terms: ["mongo", "mongodb"] },
  { id: "infra-elasticsearch", terms: ["elasticsearch", "opensearch"] },
  { id: "infra-rabbitmq", terms: ["rabbitmq", "rabbit"] },
  { id: "infra-kubernetes", terms: ["kubernetes", "k8s"] },
  { id: "infra-docker", terms: ["docker", "container runtime"] },
  { id: "infra-nginx", terms: ["nginx"] },
  { id: "infra-terraform", terms: ["terraform"] },
  { id: "infra-grafana", terms: ["grafana"] },
];

/** Classify free-text relationship intent into a registered semantic kind. */
export function normalizeRelationshipKind(
  kind: string,
  label: string,
  diagramType: VisualDiagramType,
) {
  const meaning = `${normalize(kind)} ${normalize(label)}`;
  // Structural notations are matched first: in a use-case or BPMN diagram the
  // word "include" or "message" names the notation itself, and reading it as a
  // runtime flow would attach motion to a static relationship.
  if (diagramType === "use-case" || diagramType === "uml") {
    if (includesAny(meaning, ["include"])) return "include";
    if (includesAny(meaning, ["extend"])) return "extend";
  }
  if (diagramType === "bpmn" && includesAny(meaning, ["message"])) return "message-flow";
  if (STRUCTURAL_NOTATION_DIAGRAM_TYPES.has(diagramType) && includesAny(meaning, ["association"]))
    return "association";
  if (includesAny(meaning, ["response", "return", "reply", "result"])) return "response";
  if (includesAny(meaning, ["async", "event", "publish", "signal", "notify"])) return "async";
  if (includesAny(meaning, ["self", "internal", "recursive"])) return "self-call";
  if (includesAny(meaning, ["handshake", "tls", "connect", "negotiate"])) return "handshake";
  if (includesAny(meaning, ["error", "failure", "reject", "exception"])) return "error";
  if (includesAny(meaning, ["cycle", "poll", "loop", "sync repeatedly"])) return "cycle";
  if (includesAny(meaning, ["dependency", "depends", "uses"])) return "dependency";
  if (includesAny(meaning, ["transition", "state change"])) return "state-transition";
  if (includesAny(meaning, ["data", "stream", "read", "write", "replicate"])) return "data-flow";
  // A structural notation has no runtime meaning to fall back on.
  if (STRUCTURAL_NOTATION_DIAGRAM_TYPES.has(diagramType)) return "association";
  return diagramType === "sequence" ? "request" : "data-flow";
}

/**
 * Per-notation authoring guidance surfaced by `drawcms_recommend_visuals`.
 *
 * Typed as a total record rather than a Partial so adding a diagram type to
 * `VISUAL_DIAGRAM_TYPES` fails the build until its conventions are written —
 * a missing entry used to silently degrade to generic advice.
 */
export const DIAGRAM_CONVENTIONS: Record<VisualDiagramType, string> = {
  general:
    "Group related elements and keep one reading direction. Give every connector a label that names the relationship, minimize crossings, and prefer a few well-named elements over many vague ones.",
  flowchart:
    "Use terminators for start/end, rectangles for actions, diamonds for decisions, parallelograms for input/output. Read left-to-right or top-to-bottom; label every decision branch; route retries outside the main flow.",
  sequence:
    "Participants across the top; time flows downward; use native lifelines and activation bars. Keep messages in chronological order, pair each call with its return, and stay within the 12 message rows.",
  architecture:
    "Group elements by tier or trust boundary and keep dependency direction consistent (clients above or left of the services they call). Label connectors with the protocol or payload, name the technology on the element, and keep datastores visually distinct from services.",
  bpmn: "Use start/end events, tasks and explicit XOR/parallel gateways. Sequence flows stay within a participant; dashed message flows connect different participants and never gateways. Keep lanes by responsibility; label conditions beside outgoing gateway flows. Pools/lanes require explicit grouping, not inferred ownership.",
  uml: "Pick one UML view per diagram — classes, components or states — and do not mix them. Associations are undirected lines without arrowheads; keep the model static because a structural diagram describes no runtime order. Name interfaces by their contract and packages by their module.",
  "use-case":
    "Place actors outside the system scope and use-case ovals in a separate column. Name goals with verb phrases. Actor associations are undirected; dashed «include» points from base to included goal; «extend» points from extension to base. Do not depict chronological control flow.",
  "entity-relationship":
    "Use entities with named attributes and marked primary keys; relationship diamonds are for conceptual Chen notation. State both endpoint multiplicities using sourceCardinality and targetCardinality. Keep the model static; avoid mixing Chen attributes with physical schema tables.",
  "database-model":
    "Use table nodes with rows containing actual column names and SQL types; mark PK/FK in names. Connect related tables and supply both endpoint cardinalities; label foreign-key mappings explicitly (orders.user_id → users.id). Represent many-to-many relations through a junction table in physical schemas. Multiplicity is rendered as endpoint-qualified text, not crow's-foot glyphs.",
  "data-flow":
    "Separate external sources/sinks, transformations and data stores. Label connectors with the data carried, not control conditions; keep processing direction consistent.",
  lifecycle:
    "Use named states and label transitions with their trigger or guard. Keep return transitions outside the main progression.",
};

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
    const structural = STRUCTURAL_NOTATION_DIAGRAM_TYPES.has(input.diagramType);
    const motionPreset =
      input.animationGoal === "none" || structural ? null : grammar.recommendedMotionPreset;
    return {
      relationshipId: item.id ?? `relationship-${index + 1}`,
      semanticType: grammar.id,
      connectorType:
        input.diagramType === "sequence"
          ? (grammar.sequenceConnectorType ?? "sequence-message")
          : null,
      routing: input.diagramType === "sequence" ? grammar.routing : "elbow",
      // The registry owns the notation, so a structural diagram cannot end up
      // recommending a directed arrow for a relationship that has none.
      notation: grammar.notation,
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
    layout: DIAGRAM_CONVENTIONS[input.diagramType],
    authoring:
      "Pass diagramType to drawcms_replace_diagram, omit positions for automatic placement, then inspect returned validation. Explicit coordinates/routing are respected. Resolve warnings before presenting.",
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
  if (nodeTypes.includes("table")) return "database-model";
  if (nodeTypes.includes("use-case")) return "use-case";
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
  if (document.meta.diagramType) return document.meta.diagramType;
  const nodeTypes = document.nodes.map((node) => node.data.type);
  const sequenceEdge = document.edges.some((edge) => isSequenceEdgeType(edge.data?.sequenceType));
  return inferDiagramTypeFromNodeTypes(nodeTypes, sequenceEdge);
}

/**
 * How each routing failure is reported to the agent.
 *
 * A total record, so adding a code to `ROUTE_ISSUE_CODES` fails the build until
 * it has a message. The previous binary check silently described any new code
 * as a node collision.
 */
const ROUTE_ISSUE_REPORTS: Record<RouteIssueCode, { message: string; suggestedFix: string }> = {
  CONNECTOR_NODE_COLLISION: {
    message: "This connector could not avoid every node.",
    suggestedFix:
      "Run drawcms_tidy_diagram to re-space the diagram, or simplify this relationship.",
  },
  CONNECTOR_LABEL_COLLISION: {
    message: "No clear label position was found beside this connector.",
    suggestedFix:
      "Shorten the label or run drawcms_tidy_diagram to open up space around this connector.",
  },
};

/**
 * Does this connector label state a multiplicity?
 *
 * Two conventions are both correct and both accepted: the endpoint-qualified
 * text this build composes from `sourceCardinality`/`targetCardinality`
 * (`Customer [1] — Order [0..*]`), and the bare Chen marker a conceptual ER
 * diagram writes against a relationship diamond (`1`, `N`, `0..*`). Requiring
 * only the first would flag correct Chen notation as a defect.
 */
function statesMultiplicity(label: string): boolean {
  if (/\[[^\]]+\]/.test(label)) return true;
  return label
    .split("\n")
    .some((line) => /^\s*(\*|[0-9]+|[nm]|[0-9]+\.\.(\*|[0-9]+))\s*$/i.test(line));
}

/**
 * The coarse thing a shape asserts about whatever it contains.
 *
 * Used to catch an element whose meaning contradicts its own label. Only
 * unambiguous shapes are classified; anything left `other` is never flagged,
 * which keeps the check quiet for legitimate choices (a `uml-class` named
 * "Customer" is a domain class, not a person).
 */
type ElementShapeRole = "decision" | "datastore" | "actor" | "service" | "annotation" | "other";

const DECISION_SHAPES = new Set([
  "decision",
  "diamond",
  "lifecycle-decision",
  "bpmn-gateway-exclusive",
  "bpmn-gateway-inclusive",
  "bpmn-gateway-parallel",
]);

const DATASTORE_SHAPES = new Set([
  "database",
  "cylinder",
  "internal-storage",
  "arch-database",
  "data-store",
  "table",
  "infra-redis",
  "infra-postgresql",
  "infra-mongodb",
  "infra-elasticsearch",
  "aws-s3",
  "aws-rds",
  "aws-dynamodb",
  "aws-aurora",
  "aws-redshift",
  "gcp-cloud-storage",
  "gcp-cloud-sql",
  "gcp-bigquery",
  "gcp-firestore",
  "gcp-spanner",
  "gcp-memorystore",
  "azure-blob-storage",
  "azure-sql-db",
  "azure-cosmos-db",
]);

const ACTOR_SHAPES = new Set(["actor", "sequence-actor"]);

const SERVICE_SHAPES = new Set([
  "arch-backend",
  "arch-frontend",
  "arch-external",
  "arch-cloud",
  "arch-security",
  "uml-component",
  "bpmn-task",
  "process",
  "sequence-participant",
  "data-transform",
]);

const ANNOTATION_SHAPES = new Set([
  "note",
  "uml-note",
  "sequence-note",
  "callout",
  "text",
  "annotation-callout",
  "annotation-legend",
  "annotation-summary",
  "annotation-source",
  "annotation-owner",
  "annotation-technology",
]);

/** Labels that describe a running service rather than stored data. */
const SERVICE_LABEL_TERMS = [
  "dns resolver",
  "web server",
  "api server",
  "service",
  "api",
  "worker",
  "gateway",
  "resolver",
];

function elementShapeRole(type: string): ElementShapeRole {
  if (DECISION_SHAPES.has(type)) return "decision";
  if (DATASTORE_SHAPES.has(type)) return "datastore";
  if (ACTOR_SHAPES.has(type)) return "actor";
  if (ANNOTATION_SHAPES.has(type)) return "annotation";
  if (SERVICE_SHAPES.has(type)) return "service";
  return "other";
}

/**
 * Is this label nothing but a role word — "User", "Store admin" — rather than a
 * name that merely contains one? "Customer service" names a service and a
 * `customers` table names data; only a bare role is a person.
 */
function describesOnlyARole(labelWords: string): boolean {
  const words = labelWords.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 3) return false;
  return words.every(
    (word) =>
      ROLE_QUALIFIERS.has(word) || ACTOR_TERMS.some((term) => word === term || word === `${term}s`),
  );
}

/** Words that may accompany a bare role without making it something else. */
const ROLE_QUALIFIERS = new Set(["the", "a", "an", "end", "external", "internal", "store", "site"]);

/**
 * Does this element exist to enclose other elements?
 *
 * Both the semantic frames (`data-stage`, the boundary family) and the plain
 * grouping shapes qualify. They render a large titled frame with the label in a
 * corner, which reads as an empty box when nothing is placed inside.
 */
function isContainerElement(type: string): boolean {
  return (
    SEMANTIC_CONTAINER_TYPES.has(type) || ELEMENTS_BY_ID.get(type)?.categoryId === "containers"
  );
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

    const shapeRole = elementShapeRole(node.data.type);
    const labelWords = searchableWords(node.data.label);
    if (shapeRole === "datastore" && matchesAny(labelWords, SERVICE_LABEL_TERMS)) {
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
    // The reverse of the rule above, plus the two other cases where a label
    // states plainly what it is and the chosen shape says otherwise. An agent
    // passing an explicit type gets no other feedback that the shape misreads,
    // because the type is only validated for membership in the registry.
    const mentionsService = matchesAny(labelWords, SERVICE_LABEL_TERMS);
    if (shapeRole === "service" && matchesAny(labelWords, DATASTORE_TERMS) && !mentionsService) {
      issues.push({
        severity: "warning",
        code: "LABEL_DESCRIBES_DATASTORE",
        elementId: node.id,
        message: `${node.data.label} is drawn as a service even though its label names stored data.`,
        suggestedFix:
          "Use a datastore element such as arch-database, data-store, or the matching provider icon.",
      });
    }
    // Only when the label is *nothing but* a role word. "Customer service" is a
    // service and a table of `customers` is data, so neither is an actor.
    if (shapeRole === "service" && describesOnlyARole(labelWords)) {
      issues.push({
        severity: "warning",
        code: "LABEL_DESCRIBES_ACTOR",
        elementId: node.id,
        message: `${node.data.label} is drawn as a system element even though its label names a person or role.`,
        suggestedFix: diagramType === "sequence" ? "Use sequence-actor." : "Use the actor element.",
      });
    }
    if (/\?/.test(node.data.label) && shapeRole !== "decision" && shapeRole !== "annotation") {
      issues.push({
        severity: "warning",
        code: "LABEL_ASKS_A_QUESTION",
        elementId: node.id,
        message: `${node.data.label} reads as a branch but is not drawn as a decision.`,
        suggestedFix:
          "Use a decision element (decision, lifecycle-decision, or a BPMN gateway) and label each outgoing branch.",
      });
    }
    // An element declares which notations it belongs to; using one outside them
    // mixes visual languages in a single diagram.
    if (!grammar.diagramTypes.includes(diagramType)) {
      issues.push({
        severity: "warning",
        code: "ELEMENT_OUTSIDE_NOTATION",
        elementId: node.id,
        message: `${grammar.title} is not part of the ${diagramType} notation.`,
        suggestedFix: `Choose an element whose diagramTypes include ${diagramType}; drawcms_get_visual_grammar with diagramType filters to those.`,
      });
    }
  }

  for (const node of document.nodes) {
    if (
      [
        "decision",
        "diamond",
        "lifecycle-decision",
        "bpmn-gateway-exclusive",
        "bpmn-gateway-inclusive",
      ].includes(node.data.type)
    ) {
      const outgoing = document.edges.filter((edge) => edge.source === node.id);
      if (
        outgoing.length > 1 &&
        outgoing.some((edge) => !String(edge.label ?? edge.data?.label ?? "").trim())
      ) {
        issues.push({
          severity: "warning",
          code: "UNLABELED_BRANCH",
          elementId: node.id,
          message: "A decision has unlabeled outgoing branches.",
          suggestedFix:
            "Label each alternative with an unambiguous condition, such as Approved / Rejected or Yes / No.",
        });
      }
    }
  }
  for (const edge of document.edges) {
    const route = edge.data?.diagramRoute;
    if (route) {
      const changed = [
        [edge.source, route.sourceBounds],
        [edge.target, route.targetBounds],
      ] as const;
      const stale =
        changed.some(([id, bounds]) => {
          const node = document.nodes.find((candidate) => candidate.id === id);
          if (!node || !bounds) return false;
          const box = nodeBox(node);
          return (
            box.x !== bounds.x ||
            box.y !== bounds.y ||
            box.width !== bounds.width ||
            box.height !== bounds.height
          );
        }) ||
        (route.labelText !== undefined &&
          route.labelText !== String(edge.label ?? edge.data?.label ?? ""));
      if (stale)
        issues.push({
          severity: "warning",
          code: "STALE_AUTOMATIC_ROUTE",
          elementId: edge.id,
          message: "The connector's endpoints or label changed after automatic layout.",
          suggestedFix: "Rebuild the layout to recalculate connector and label clearance.",
        });
    }
    for (const code of edge.data?.diagramRoute?.issues ?? [])
      issues.push({
        severity: "warning",
        code,
        elementId: edge.id,
        ...ROUTE_ISSUE_REPORTS[code],
      });
    if (diagramType === "bpmn") {
      const source = document.nodes.find((node) => node.id === edge.source);
      const target = document.nodes.find((node) => node.id === edge.target);
      if (source?.data.type === "bpmn-end" || target?.data.type === "bpmn-start")
        issues.push({
          severity: "warning",
          code: "BPMN_EVENT_DIRECTION",
          elementId: edge.id,
          message:
            "An end event should not emit sequence flow, and a start event should not receive it.",
        });
      if (
        edge.data?.notation === "message-flow" &&
        [source, target].some((node) => node?.data.type.startsWith("bpmn-gateway"))
      )
        issues.push({
          severity: "warning",
          code: "BPMN_GATEWAY_MESSAGE",
          elementId: edge.id,
          message: "A BPMN gateway cannot be an endpoint of message flow.",
        });
    }
  }

  // Notation-specific structural checks. These encode the conventions in
  // DIAGRAM_CONVENTIONS as machine-checkable rules so an agent finds out its
  // ER model is missing multiplicities in the same round trip that built it.
  if (diagramType === "database-model" || diagramType === "entity-relationship") {
    for (const node of document.nodes) {
      const rows = node.data.rows;
      if (node.data.type === "table" && Array.isArray(rows)) {
        if (rows.length === 0) {
          issues.push({
            severity: "warning",
            code: "TABLE_WITHOUT_COLUMNS",
            elementId: node.id,
            message: `Table ${node.data.label} declares no columns.`,
            suggestedFix:
              "Pass rows with the real column names and SQL types, or use a conceptual ER entity instead.",
          });
        } else if (
          !rows.some((row: { name?: string }) => /\bp\.?k\.?\b|\bprimary\b/i.test(row.name ?? ""))
        ) {
          issues.push({
            severity: "warning",
            code: "TABLE_WITHOUT_PRIMARY_KEY",
            elementId: node.id,
            message: `Table ${node.data.label} does not mark a primary key.`,
            suggestedFix: "Mark the identifying column, for example \u201cid PK\u201d.",
          });
        }
      }
      const attributes = node.data.entityAttributes;
      if (
        ["er-entity", "er-weak-entity"].includes(node.data.type) &&
        Array.isArray(attributes) &&
        attributes.length > 0 &&
        !attributes.some((attribute: { isKey?: boolean }) => attribute.isKey)
      ) {
        issues.push({
          severity: "suggestion",
          code: "ENTITY_WITHOUT_KEY_ATTRIBUTE",
          elementId: node.id,
          message: `Entity ${node.data.label} has attributes but none is marked as a key.`,
          suggestedFix: "Set isKey on the attribute that identifies the entity.",
        });
      }
    }
    for (const edge of document.edges) {
      const text = String(edge.label ?? edge.data?.label ?? "");
      if (!statesMultiplicity(text)) {
        issues.push({
          severity: "warning",
          code: "MISSING_CARDINALITY",
          elementId: edge.id,
          message: "A relationship does not state its endpoint multiplicities.",
          suggestedFix:
            "Pass sourceCardinality and targetCardinality so both ends read unambiguously.",
        });
      }
    }
  }

  if (diagramType === "use-case") {
    const typesById = new Map(document.nodes.map((node) => [node.id, node.data.type]));
    if (document.nodes.length > 0 && !document.nodes.some((node) => node.data.type === "actor")) {
      issues.push({
        severity: "warning",
        code: "USE_CASE_WITHOUT_ACTOR",
        message: "A use-case diagram has no actor.",
        suggestedFix: "Add an actor element for whoever pursues these goals.",
      });
    }
    for (const edge of document.edges) {
      const source = typesById.get(edge.source);
      const target = typesById.get(edge.target);
      if (source === "actor" && target === "actor") {
        issues.push({
          severity: "warning",
          code: "USE_CASE_ACTOR_ASSOCIATION",
          elementId: edge.id,
          message: "Two actors are associated directly.",
          suggestedFix:
            "Connect each actor to the use case it participates in; actors do not interact with each other in this notation.",
        });
      }
      const stereotype = edge.data?.notation;
      if (
        (stereotype === "include" || stereotype === "extend") &&
        (source !== "use-case" || target !== "use-case")
      ) {
        issues.push({
          severity: "warning",
          code: "USE_CASE_STEREOTYPE_ENDPOINT",
          elementId: edge.id,
          message: `\u00ab${stereotype}\u00bb is only valid between two use cases.`,
          suggestedFix: "Use a plain association for an actor's participation.",
        });
      }
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

  // A grouping element used as a flow step: it draws a large titled frame meant
  // to enclose other elements, so wiring it between two steps with nothing
  // inside renders an empty box whose label sits in a corner rather than a
  // shape that reads as the work it names.
  const childCounts = new Map<string, number>();
  for (const node of document.nodes) {
    if (!node.parentId) continue;
    childCounts.set(node.parentId, (childCounts.get(node.parentId) ?? 0) + 1);
  }
  const connectedIds = new Set(document.edges.flatMap((edge) => [edge.source, edge.target]));
  for (const node of document.nodes) {
    if (!isContainerElement(node.data.type)) continue;
    if ((childCounts.get(node.id) ?? 0) > 0) continue;
    if (!connectedIds.has(node.id)) continue;
    const grammar = ELEMENTS_BY_ID.get(node.data.type);
    issues.push({
      severity: "warning",
      code: "CONTAINER_USED_AS_STEP",
      elementId: node.id,
      message: `${grammar?.title ?? node.data.type} groups other elements, but ${node.id} is empty and wired in like a step.`,
      suggestedFix:
        "Put the elements this frame covers inside it, or use an ordinary element for the step itself.",
    });
  }

  // Bounding-box overlap: siblings only, since a container is expected to
  // fully enclose its children and comparing across the parent boundary
  // would only produce noise.
  const nodeBounds = document.nodes.map((node) => ({
    id: node.id,
    parentId: node.parentId,
    ...nodeBox(node),
  }));
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
