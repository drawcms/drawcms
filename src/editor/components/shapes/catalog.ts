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
 * Data-only element catalogue consumed by the agent-facing visual grammar.
 * An exhaustive test compares it with the human palette so the two surfaces
 * cannot drift when an element is added or removed.
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
