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

/** Distance a plain paste moves each copy away from the original, in canvas px. */
export const PASTE_OFFSET = 40;

/** Distance the duplicate action moves its copy; tighter than a paste. */
export const DUPLICATE_OFFSET = 24;

export const MIN_FONT_SIZE = 8;
/** Upper bound for `text` elements, which have no box to overflow. */
export const MAX_TEXT_FONT_SIZE = 96;
/** Upper bound for labels drawn inside a shape. */
export const MAX_SHAPE_FONT_SIZE = 48;

/**
 * Sizes the font-size shortcuts step through. Coarser as it climbs, so one
 * keypress is always a visible change — the same progression a word processor's
 * size menu offers, rather than ±1px which does nothing perceptible at 72.
 */
export const FONT_SIZE_STEPS: readonly number[] = [
  8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96,
];

/**
 * Next size along the ladder in `direction`, clamped to `max`. Sizes that are
 * not on the ladder (set with the slider) move to the nearest rung that is
 * actually a step in the requested direction.
 */
export function nextFontSize(current: number, direction: 1 | -1, max: number): number {
  const rungs = FONT_SIZE_STEPS.filter((size) => size <= max);
  if (rungs.length === 0) return current;
  const candidate =
    direction === 1
      ? rungs.find((size) => size > current)
      : [...rungs].reverse().find((size) => size < current);
  if (candidate !== undefined) return candidate;
  return direction === 1 ? Math.min(max, rungs[rungs.length - 1]) : rungs[0];
}

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

/** Shapes whose labels sit below their artwork rather than inside it. */
export const TEXT_BELOW_NODE_TYPES = new Set([
  "actor",
  "image",
  "cylinder",
  "database",
  "cloud",
  "star",
  "uml-interface",
  "bpmn-start",
  "bpmn-end",
  "bpmn-intermediate",
  "triangle",
  "cross",
  "pentagon",
  "octagon",
  "bpmn-gateway-exclusive",
  "bpmn-gateway-parallel",
  "bpmn-gateway-inclusive",
]);

/**
 * How far an inside label must be inset from a shape's bounding box, in
 * percent per side, for the text to land inside the *drawn outline*.
 *
 * A rectangle can use almost its whole box, so it needs nothing here and takes
 * `DEFAULT_LABEL_INSET`. Everything else can't: the largest axis-aligned
 * rectangle inside a diamond is half its width and half its height, inside an
 * ellipse it is 1/sqrt(2) of each axis, and a shape with a notch or a slanted
 * side loses room on the affected side only. Insetting every shape by the same
 * flat amount is what makes text spill past a diamond's edges even though it is
 * still technically within the node's box.
 *
 * `webmcp/tools.ts` reads the same table (via `SHAPE_USABLE_AREA`) when it
 * sizes agent-authored nodes, so the space layout reserves and the space the
 * label is painted into cannot disagree.
 */
export const DEFAULT_LABEL_INSET = { top: 10, right: 10, bottom: 10, left: 10 } as const;

export interface LabelInset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const SHAPE_LABEL_INSETS: Record<string, LabelInset> = {
  // Inscribed rectangle of a rhombus is half of each axis.
  diamond: { top: 25, right: 25, bottom: 25, left: 25 },
  decision: { top: 25, right: 25, bottom: 25, left: 25 },
  "er-relationship": { top: 25, right: 25, bottom: 25, left: 25 },
  "er-weak-relationship": { top: 28, right: 28, bottom: 28, left: 28 },
  // Ellipses: 1/sqrt(2) ~= 0.707 of each axis, so ~15% per side.
  circle: { top: 15, right: 15, bottom: 15, left: 15 },
  "use-case": { top: 15, right: 15, bottom: 15, left: 15 },
  "er-attribute": { top: 15, right: 15, bottom: 15, left: 15 },
  "er-key-attribute": { top: 15, right: 15, bottom: 15, left: 15 },
  "er-multivalued": { top: 18, right: 18, bottom: 18, left: 18 },
  "er-derived": { top: 18, right: 18, bottom: 18, left: 18 },
  // Angled left/right edges.
  hexagon: { top: 10, right: 16, bottom: 10, left: 16 },
  preparation: { top: 10, right: 16, bottom: 10, left: 16 },
  parallelogram: { top: 10, right: 18, bottom: 10, left: 18 },
  trapezoid: { top: 12, right: 20, bottom: 10, left: 20 },
  terminator: { top: 12, right: 15, bottom: 12, left: 15 },
  banner: { top: 12, right: 16, bottom: 12, left: 16 },
  // A notch or point consumes one end of the shape.
  chevron: { top: 12, right: 20, bottom: 12, left: 14 },
  "notched-arrow": { top: 14, right: 20, bottom: 14, left: 14 },
  step: { top: 12, right: 12, bottom: 12, left: 20 },
  "arrow-right": { top: 22, right: 24, bottom: 22, left: 12 },
  "arrow-left": { top: 22, right: 12, bottom: 22, left: 24 },
  "arrow-up": { top: 24, right: 22, bottom: 12, left: 22 },
  "arrow-down": { top: 12, right: 22, bottom: 24, left: 22 },
  "arrow-double-h": { top: 22, right: 22, bottom: 22, left: 22 },
  "arrow-double-v": { top: 22, right: 22, bottom: 22, left: 22 },
  // Wavy edges / a pointer tail eat one axis.
  tape: { top: 18, right: 10, bottom: 18, left: 10 },
  callout: { top: 10, right: 12, bottom: 24, left: 12 },
  // The two tabs on a component's left edge sit on top of a centered label.
  "uml-component": { top: 12, right: 10, bottom: 12, left: 20 },
};

/** Fraction of each axis an inside label may occupy, derived from the insets. */
export const DEFAULT_USABLE_AREA = {
  width: (100 - DEFAULT_LABEL_INSET.left - DEFAULT_LABEL_INSET.right) / 100,
  height: (100 - DEFAULT_LABEL_INSET.top - DEFAULT_LABEL_INSET.bottom) / 100,
} as const;

export const SHAPE_USABLE_AREA: Record<string, { width: number; height: number }> =
  Object.fromEntries(
    Object.entries(SHAPE_LABEL_INSETS).map(([type, inset]) => [
      type,
      {
        width: (100 - inset.left - inset.right) / 100,
        height: (100 - inset.top - inset.bottom) / 100,
      },
    ]),
  );
