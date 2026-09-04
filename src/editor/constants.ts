import { isCloudIconType } from "./components/shapes/cloud-icons";
import {
  getSemanticNodeSize,
  SEMANTIC_CONTAINER_TYPES,
} from "./components/shapes/semantic-elements";
import type { TableRow, ListItem, EntityAttribute, Lane } from "./types";

export const getNodeSize = (type: string): { width: number; height: number } => {
  if (isCloudIconType(type)) return { width: 100, height: 100 };
  if (type === "icon") return { width: 100, height: 100 };
  const semanticSize = getSemanticNodeSize(type);
  if (semanticSize) return semanticSize;
  switch (type) {
    // Square / symmetric shapes
    case "circle":
    case "use-case":
    case "diamond":
    case "decision":
    case "octagon":
    case "star":
    case "cross":
    case "pentagon":
    case "er-relationship":
    case "er-weak-relationship":
    case "bpmn-start":
    case "bpmn-end":
    case "bpmn-intermediate":
    case "bpmn-gateway-exclusive":
    case "bpmn-gateway-parallel":
    case "bpmn-gateway-inclusive":
      return { width: 120, height: 120 };
    case "triangle":
      return { width: 120, height: 110 };
    case "hexagon":
    case "preparation":
      return { width: 140, height: 100 };
    case "cloud":
      return { width: 140, height: 110 };
    case "cylinder":
    case "database":
      return { width: 100, height: 120 };
    case "actor":
    case "uml-interface":
      return { width: 80, height: 120 };
    // Wide shapes
    case "parallelogram":
    case "trapezoid":
    case "chevron":
    case "step":
    case "notched-arrow":
    case "er-attribute":
    case "er-key-attribute":
    case "er-multivalued":
    case "er-derived":
      return { width: 160, height: 80 };
    // Arrow shapes
    case "arrow-right":
    case "arrow-left":
    case "arrow-double-h":
      return { width: 140, height: 80 };
    case "arrow-up":
    case "arrow-down":
    case "arrow-double-v":
      return { width: 80, height: 140 };
    // Container shapes
    case "group":
    case "swimlane-h":
    case "swimlane-v":
    case "bpmn-pool":
      return { width: 300, height: 200 };
    // Structured shapes (auto-height)
    case "uml-class":
    case "uml-object":
      return { width: 200, height: 0 };
    case "er-entity":
    case "er-weak-entity":
      return { width: 180, height: 0 };
    case "uml-component":
      return { width: 160, height: 100 };
    case "uml-package":
      return { width: 180, height: 120 };
    case "text":
      return { width: 160, height: 40 };
    case "table":
      return { width: 200, height: 0 };
    default:
      return { width: 160, height: 80 };
  }
};

export const DEFAULT_TABLE_ROWS: TableRow[] = [
  { id: "1", name: "id", type: "int" },
  { id: "2", name: "name", type: "varchar" },
  { id: "3", name: "created_at", type: "timestamp" },
];

export const DEFAULT_UML_ATTRIBUTES: ListItem[] = [
  { id: "1", text: "- id: int" },
  { id: "2", text: "- name: string" },
];

export const DEFAULT_UML_METHODS: ListItem[] = [
  { id: "1", text: "+ getId(): int" },
  { id: "2", text: "+ getName(): string" },
];

export const DEFAULT_ENTITY_ATTRS: EntityAttribute[] = [
  { id: "1", name: "id", isKey: true },
  { id: "2", name: "name", isKey: false },
  { id: "3", name: "description", isKey: false },
];

export const DEFAULT_LANES: Lane[] = [
  { id: "1", name: "Lane 1" },
  { id: "2", name: "Lane 2" },
];

export const UML_CLASS_TYPES = new Set(["uml-class", "uml-object"]);
export const ER_ENTITY_TYPES = new Set(["er-entity", "er-weak-entity"]);
export const CONTAINER_TYPES = new Set([
  "group",
  "folder",
  "dashed-box",
  ...SEMANTIC_CONTAINER_TYPES,
]);
export const SWIMLANE_TYPES = new Set(["swimlane-h", "swimlane-v", "bpmn-pool"]);
export const ALL_CONTAINER_TYPES = new Set([...CONTAINER_TYPES, ...SWIMLANE_TYPES]);
