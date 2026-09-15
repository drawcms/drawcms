/**
 * The canonical list of diagram notations DrawCMS understands.
 *
 * This lives in the document layer, and deliberately has no imports, because
 * both ends of the stack need it: `document/schema.ts` validates the persisted
 * `meta.diagramType` against it, and `webmcp/visual-grammar.ts` builds the
 * agent-facing grammar and layout guidance from it. Importing the grammar
 * module into the schema instead would invert the layering and force every
 * consumer of the document schema to pay for the grammar's module-scope
 * registry build, so the shared enum is hoisted here and re-exported from
 * `visual-grammar.ts` as `VISUAL_DIAGRAM_TYPES` for its existing callers.
 */
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
  "use-case",
  "database-model",
] as const;

export type VisualDiagramType = (typeof VISUAL_DIAGRAM_TYPES)[number];

/**
 * How a connector should be read. `directed` is an ordinary flow arrow;
 * `association` is an undirected structural link (ER, UML, use-case);
 * `include`/`extend` are the UML use-case stereotypes; `message-flow` is the
 * BPMN dashed cross-pool message. Shared with `document/schema.ts` so the
 * persisted value and the agent-facing input accept exactly the same set.
 */
export const EDGE_NOTATIONS = [
  "directed",
  "association",
  "include",
  "extend",
  "message-flow",
] as const;

export type EdgeNotation = (typeof EDGE_NOTATIONS)[number];

/**
 * Notations whose connectors describe a *structural* relationship (an ER
 * cardinality, a UML association, a use-case «include») rather than a
 * directional flow. They default to an undirected association with no
 * arrowhead and no motion, because an animated arrow implies a runtime
 * sequence these diagrams do not describe.
 */
export const STRUCTURAL_NOTATION_DIAGRAM_TYPES = new Set<VisualDiagramType>([
  "use-case",
  "entity-relationship",
  "database-model",
  "uml",
]);

/**
 * Problems automatic routing can detect but not solve.
 *
 * The router never silently ships a route it knows is wrong: when no candidate
 * clears every obstacle it records the reason here and the validator turns it
 * into a reviewable warning. Enumerated (rather than free strings) so the
 * persisted document, the router, and the validator's message table are all
 * checked against one list.
 */
export const ROUTE_ISSUE_CODES = ["CONNECTOR_NODE_COLLISION", "CONNECTOR_LABEL_COLLISION"] as const;

export type RouteIssueCode = (typeof ROUTE_ISSUE_CODES)[number];
