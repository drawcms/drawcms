import { AWS_ICONS, AZURE_ICONS, GCP_ICONS, INFRA_ICONS } from "./cloud-icons";
import { SEMANTIC_ELEMENT_GROUPS } from "./semantic-elements";

export interface ShapeDefinition {
  id: string;
  title: string;
  defaultLabel?: string;
  keywords?: string[];
}

export interface ShapeCategory {
  id: string;
  title: string;
  representativeShapeId: string;
  shapes: ShapeDefinition[];
}

/**
 * Shared by the human palette, replacement picker, and agent visual grammar.
 */
export const SHAPE_CATEGORIES: ShapeCategory[] = [
  {
    id: "general",
    title: "Basic",
    representativeShapeId: "star",
    shapes: [
      { id: "rect", title: "Rectangle", keywords: ["square", "box"] },
      { id: "round-rect", title: "Rounded Rect", keywords: ["rounded", "pill"] },
      { id: "circle", title: "Circle", keywords: ["ellipse", "oval"] },
      { id: "triangle", title: "Triangle" },
      { id: "diamond", title: "Diamond", keywords: ["rhombus"] },
      { id: "pentagon", title: "Pentagon" },
      { id: "hexagon", title: "Hexagon" },
      { id: "octagon", title: "Octagon" },
      { id: "parallelogram", title: "Parallelogram" },
      { id: "trapezoid", title: "Trapezoid" },
      { id: "cylinder", title: "Cylinder", keywords: ["db"] },
      { id: "cloud", title: "Cloud" },
      { id: "star", title: "Star" },
      { id: "cross", title: "Cross", keywords: ["plus"] },
      { id: "callout", title: "Callout", keywords: ["speech", "bubble"] },
      { id: "note", title: "Note", keywords: ["sticky"] },
      { id: "card", title: "Card" },
      { id: "tape", title: "Tape" },
      { id: "step", title: "Step", keywords: ["chevron", "ribbon"] },
      { id: "banner", title: "Banner", keywords: ["flag"] },
      {
        id: "text",
        title: "Text",
        defaultLabel: "",
        keywords: ["label", "annotation", "heading", "caption"],
      },
      { id: "image", title: "Image", keywords: ["photo", "picture"] },
      { id: "table", title: "Table", keywords: ["db", "entity", "model", "schema"] },
    ],
  },
  {
    id: "arrows",
    title: "Arrows",
    representativeShapeId: "arrow-right",
    shapes: [
      { id: "arrow-right", title: "Right Arrow", keywords: ["east"] },
      { id: "arrow-left", title: "Left Arrow", keywords: ["west"] },
      { id: "arrow-up", title: "Up Arrow", keywords: ["north"] },
      { id: "arrow-down", title: "Down Arrow", keywords: ["south"] },
      { id: "arrow-double-h", title: "Double H", keywords: ["horizontal", "bidirectional"] },
      { id: "arrow-double-v", title: "Double V", keywords: ["vertical", "bidirectional"] },
      { id: "chevron", title: "Chevron" },
      { id: "notched-arrow", title: "Notched Arrow" },
    ],
  },
  ...SEMANTIC_ELEMENT_GROUPS,
  {
    id: "icons",
    title: "Icons",
    representativeShapeId: "icon",
    shapes: [],
  },
  {
    id: "flowchart",
    title: "Flowchart",
    representativeShapeId: "decision",
    shapes: [
      { id: "process", title: "Process", keywords: ["step"] },
      { id: "decision", title: "Decision", keywords: ["if", "branch"] },
      { id: "terminator", title: "Terminator", keywords: ["start", "end"] },
      { id: "document", title: "Document", keywords: ["page"] },
      { id: "data", title: "Data (I/O)", keywords: ["input", "output"] },
      { id: "database", title: "Database", keywords: ["db", "storage"] },
      { id: "predefined", title: "Predefined", keywords: ["subroutine"] },
      { id: "internal-storage", title: "Int. Storage" },
      { id: "delay", title: "Delay", keywords: ["wait"] },
      { id: "manual-input", title: "Manual Input" },
      { id: "manual-operation", title: "Manual Op" },
      { id: "display", title: "Display", keywords: ["screen"] },
      { id: "preparation", title: "Preparation", keywords: ["prep"] },
      { id: "loop-limit", title: "Loop Limit" },
    ],
  },
  {
    id: "uml",
    title: "UML",
    representativeShapeId: "actor",
    shapes: [
      { id: "actor", title: "Actor", keywords: ["user", "person", "stick"] },
      { id: "use-case", title: "Use Case", keywords: ["ellipse"] },
      { id: "uml-class", title: "Class", keywords: ["attributes", "methods"] },
      { id: "uml-component", title: "Component" },
      { id: "uml-interface", title: "Interface", keywords: ["lollipop"] },
      { id: "uml-package", title: "Package", keywords: ["module"] },
      { id: "uml-state", title: "State", keywords: ["state machine"] },
      { id: "uml-object", title: "Object", keywords: ["instance"] },
      { id: "uml-note", title: "Note", keywords: ["comment"] },
      { id: "uml-artifact", title: "Artifact", keywords: ["file"] },
    ],
  },
  {
    id: "bpmn",
    title: "BPMN",
    representativeShapeId: "bpmn-gateway-parallel",
    shapes: [
      { id: "bpmn-start", title: "Start Event", keywords: ["begin"] },
      { id: "bpmn-end", title: "End Event", keywords: ["finish"] },
      { id: "bpmn-intermediate", title: "Intermediate", keywords: ["event"] },
      { id: "bpmn-task", title: "Task", keywords: ["activity", "step"] },
      { id: "bpmn-gateway-exclusive", title: "Exclusive GW", keywords: ["xor", "decision"] },
      { id: "bpmn-gateway-parallel", title: "Parallel GW", keywords: ["and", "fork"] },
      { id: "bpmn-gateway-inclusive", title: "Inclusive GW", keywords: ["or"] },
      { id: "bpmn-pool", title: "Pool", keywords: ["lane", "swimlane"] },
    ],
  },
  {
    id: "er",
    title: "Entity Relationship",
    representativeShapeId: "er-multivalued",
    shapes: [
      { id: "er-entity", title: "Entity", keywords: ["table"] },
      { id: "er-weak-entity", title: "Weak Entity" },
      { id: "er-relationship", title: "Relationship" },
      { id: "er-weak-relationship", title: "Weak Relation" },
      { id: "er-attribute", title: "Attribute" },
      { id: "er-key-attribute", title: "Key Attribute", keywords: ["primary"] },
      { id: "er-multivalued", title: "Multi-Valued" },
      { id: "er-derived", title: "Derived", keywords: ["computed"] },
    ],
  },
  {
    id: "containers",
    title: "Containers",
    representativeShapeId: "folder",
    shapes: [
      { id: "group", title: "Group", keywords: ["container"] },
      { id: "folder", title: "Folder", keywords: ["tab", "package"] },
      { id: "swimlane-h", title: "H. Swimlane", keywords: ["horizontal"] },
      { id: "swimlane-v", title: "V. Swimlane", keywords: ["vertical"] },
      { id: "dashed-box", title: "Boundary", keywords: ["dashed"] },
    ],
  },
  {
    id: "aws",
    title: "AWS",
    representativeShapeId: "aws-ec2",
    shapes: AWS_ICONS.map((icon) => ({
      id: icon.id,
      title: icon.title,
      keywords: icon.keywords,
    })),
  },
  {
    id: "gcp",
    title: "GCP",
    representativeShapeId: "gcp-compute-engine",
    shapes: GCP_ICONS.map((icon) => ({
      id: icon.id,
      title: icon.title,
      keywords: icon.keywords,
    })),
  },
  {
    id: "azure",
    title: "Azure",
    representativeShapeId: "azure-vm",
    shapes: AZURE_ICONS.map((icon) => ({
      id: icon.id,
      title: icon.title,
      keywords: icon.keywords,
    })),
  },
  {
    id: "infra",
    title: "Infrastructure",
    representativeShapeId: "infra-kubernetes",
    shapes: INFRA_ICONS.map((icon) => ({
      id: icon.id,
      title: icon.title,
      keywords: icon.keywords,
    })),
  },
];

export const SHAPE_CATEGORY_IDS = SHAPE_CATEGORIES.map((category) => category.id);

export const PALETTE_ELEMENT_IDS = SHAPE_CATEGORIES.flatMap((category) =>
  category.shapes.map((shape) => shape.id),
);

export interface DiagramCollection {
  id: string;
  title: string;
  keywords: string[];
  elementIds: string[];
  hint: string;
}

/** Curated views reuse stable element IDs; a shape belongs to one base category. */
export const DIAGRAM_COLLECTIONS: DiagramCollection[] = [
  {
    id: "flowchart",
    title: "Flowchart",
    keywords: ["flow chart", "workflow"],
    elementIds: [
      "process",
      "decision",
      "terminator",
      "document",
      "data",
      "database",
      "predefined",
      "delay",
    ],
    hint: "Connect steps with arrows. Label decision branches Yes and No.",
  },
  {
    id: "mind-map",
    title: "Mind Map",
    keywords: ["brainstorm", "mindmap"],
    elementIds: ["mind-topic", "mind-branch", "text"],
    hint: "Place a central topic, then connect ideas around it with plain lines.",
  },
  {
    id: "org-chart",
    title: "Org Chart",
    keywords: ["organization", "organisation", "hierarchy"],
    elementIds: ["org-role", "rect", "text", "group"],
    hint: "Arrange roles in levels and connect them with elbow lines.",
  },
  {
    id: "erd",
    title: "ERD",
    keywords: ["entity relationship", "database model", "schema"],
    elementIds: [
      "er-entity",
      "er-weak-entity",
      "table",
      "er-relationship",
      "er-attribute",
      "er-key-attribute",
      "er-multivalued",
      "er-derived",
    ],
    hint: "Edit entity attributes or table rows. Use connector labels such as 1 and 0..* for cardinality.",
  },
  {
    id: "sequence",
    title: "Sequence Diagram",
    keywords: ["interaction", "request response"],
    elementIds: [
      "sequence-actor",
      "sequence-participant",
      "sequence-activation",
      "sequence-message",
      "sequence-message-async",
      "sequence-message-return",
      "sequence-message-self",
      "sequence-frame",
      "sequence-reference",
      "sequence-note",
      "sequence-time",
      "sequence-destroy",
    ],
    hint: "Place lifelines, then choose a message tool and connect participants in time order.",
  },
  {
    id: "data-flow",
    title: "Data Flow Diagram",
    keywords: ["dfd"],
    elementIds: ["dfd-external", "dfd-process", "dfd-store", "data-stream", "data-stage", "text"],
    hint: "Connect entities, processes, and stores. Name each arrow for the data it carries.",
  },
  {
    id: "timeline",
    title: "Timeline Diagram",
    keywords: ["roadmap", "milestones", "schedule"],
    elementIds: ["timeline-axis", "timeline-milestone", "text", "note"],
    hint: "Place milestones along the axis. Use text above each marker for dates.",
  },
  {
    id: "architecture",
    title: "System Architecture",
    keywords: ["software architecture"],
    elementIds: [
      "arch-frontend",
      "arch-backend",
      "database",
      "arch-database",
      "arch-cloud",
      "arch-security",
      "arch-messagebus",
      "arch-external",
      "boundary-region",
      "boundary-security-group",
      "boundary-trust",
      "boundary-deployment",
    ],
    hint: "Connect services and stores; use boundaries to group deployment or security zones.",
  },
  {
    id: "class",
    title: "Class Diagram",
    keywords: ["uml class", "object model"],
    elementIds: ["uml-class", "uml-object", "uml-interface", "uml-package", "uml-note"],
    hint: "Edit attributes and methods in each class. Label associations with multiplicities such as 1 and 1..*.",
  },
  {
    id: "state",
    title: "State Diagram",
    keywords: ["state machine", "statechart"],
    elementIds: [
      "activity-initial",
      "uml-state",
      "decision",
      "activity-final",
      "state-history",
      "uml-note",
    ],
    hint: "Connect states with transitions and label each transition with its trigger.",
  },
  {
    id: "deployment",
    title: "Deployment Diagram",
    keywords: ["hosts", "runtime"],
    elementIds: [
      "deployment-node",
      "uml-artifact",
      "uml-component",
      "database",
      "arch-backend",
      "boundary-deployment",
    ],
    hint: "Drop services and databases inside deployment nodes to group them by host.",
  },
  {
    id: "component",
    title: "Component Diagram",
    keywords: ["uml component", "modules"],
    elementIds: ["uml-component", "uml-interface", "uml-package", "uml-artifact", "uml-note"],
    hint: "Connect components with dependencies; use dashed lines and interface symbols.",
  },
  {
    id: "use-case",
    title: "Use Case Diagram",
    keywords: ["usecase", "actors"],
    elementIds: ["actor", "use-case", "system-boundary", "uml-note"],
    hint: "Place use cases inside the system boundary and connect actors outside it.",
  },
  {
    id: "network",
    title: "Network Diagram",
    keywords: ["topology", "lan"],
    elementIds: [
      "cloud",
      "network-router",
      "network-switch",
      "network-server",
      "arch-security",
      "boundary-region",
    ],
    hint: "Connect routers, switches, and servers; label links with protocols or ports.",
  },
  {
    id: "activity",
    title: "Activity Diagram",
    keywords: ["parallel", "fork", "join"],
    elementIds: [
      "activity-initial",
      "uml-state",
      "decision",
      "activity-fork",
      "activity-fork-v",
      "activity-final",
      "swimlane-h",
      "swimlane-v",
    ],
    hint: "Use fork/join bars for parallel work and swimlanes for responsibility.",
  },
  {
    id: "cicd",
    title: "CI/CD Pipeline",
    keywords: ["ci cd", "cicd", "continuous integration", "devops"],
    elementIds: [
      "process",
      "decision",
      "terminator",
      "activity-fork",
      "activity-fork-v",
      "data-stage",
      "uml-artifact",
    ],
    hint: "Connect commit, build, test, and deploy stages. Label pass/fail branches.",
  },
  {
    id: "user-flow",
    title: "User Flow Diagram",
    keywords: ["ux", "journey", "navigation"],
    elementIds: ["process", "decision", "terminator", "arch-frontend", "actor", "note"],
    hint: "Connect screens and actions, using decisions for sign-in and other branches.",
  },
];

export function filterShapeCategories(query: string, collectionId = "all"): ShapeCategory[] {
  const normalized = query.trim().toLowerCase();
  const collection = DIAGRAM_COLLECTIONS.find((item) => item.id === collectionId);
  const allowed = collection ? new Set(collection.elementIds) : undefined;
  const diagramMatches = new Set(
    DIAGRAM_COLLECTIONS.filter((item) =>
      [item.title, item.id, ...item.keywords].some((text) =>
        text.toLowerCase().includes(normalized),
      ),
    ).flatMap((item) => item.elementIds),
  );
  const categories = SHAPE_CATEGORIES.map((category) => ({
    ...category,
    shapes: category.shapes.filter(
      (shape) =>
        (!allowed || allowed.has(shape.id)) &&
        (!normalized ||
          category.title.toLowerCase().includes(normalized) ||
          diagramMatches.has(shape.id) ||
          [shape.id, shape.title, ...(shape.keywords ?? [])].some((text) =>
            text.toLowerCase().includes(normalized),
          )),
    ),
  })).filter(
    (category) =>
      category.shapes.length > 0 || (!normalized && !allowed && category.id === "icons"),
  );
  if (!collection) return categories;
  const matches = new Map(
    categories.flatMap((category) => category.shapes.map((shape) => [shape.id, shape] as const)),
  );
  const shapes = collection.elementIds.flatMap((id) => {
    const shape = matches.get(id);
    return shape ? [shape] : [];
  });
  return shapes.length
    ? [
        {
          id: `diagram-${collection.id}`,
          title: collection.title,
          representativeShapeId: shapes[0].id,
          shapes,
        },
      ]
    : [];
}
