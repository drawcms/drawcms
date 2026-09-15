import { describe, expect, it } from "vitest";
import { SHAPE_CATEGORIES as PALETTE_SHAPE_CATEGORIES } from "../components/SidebarLeft";
import { SHAPE_CATEGORIES as GRAMMAR_SHAPE_CATEGORIES } from "../components/shapes/catalog";
import { createDocumentFromWebMCP } from "./tools";
import { defaultNodeData } from "../node-factory";
import type { VisualDiagramType } from "../document/diagram-types";
import {
  DIAGRAM_CONVENTIONS,
  VISUAL_DIAGRAM_TYPES,
  VISUAL_ELEMENT_REGISTRY,
  VISUAL_MOTION_REGISTRY,
  VISUAL_RELATIONSHIP_REGISTRY,
  recommendVisualGrammar,
  validateDiagramVisualGrammar,
} from "./visual-grammar";

describe("DrawCMS visual grammar", () => {
  it("recommends static use-case associations and respects explicit roles", () => {
    const result = recommendVisualGrammar({
      diagramType: "use-case",
      entities: [
        { id: "user", label: "Customer", role: "actor" },
        { id: "goal", label: "View user profile", role: "use case" },
      ],
      relationships: [{ source: "user", target: "goal" }],
    });
    expect(result.elements.map((item) => item.elementId)).toEqual(["actor", "use-case"]);
    expect(result.relationships[0]).toMatchObject({
      notation: "association",
      motionPreset: null,
      loop: false,
    });
  });
  it("does not mistake Send email for a BPMN end event or Notify for a decision", () => {
    expect(
      recommendVisualGrammar({ diagramType: "bpmn", entities: [{ id: "a", label: "Send email" }] })
        .elements[0].elementId,
    ).toBe("bpmn-task");
    expect(
      recommendVisualGrammar({
        diagramType: "flowchart",
        entities: [{ id: "a", label: "Notify customer" }],
      }).elements[0].elementId,
    ).toBe("process");
  });
  it("retains explicit notation through serialization and defaults schemas to static", () => {
    const doc = createDocumentFromWebMCP({
      diagramType: "database-model",
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      edges: [{ source: "a", target: "b" }],
    });
    expect(validateDiagramVisualGrammar(JSON.parse(JSON.stringify(doc))).diagramType).toBe(
      "database-model",
    );
    expect(doc.edges[0].data?.preset).toBeUndefined();
  });

  it("flags a physical table with no primary key and an unstated multiplicity", () => {
    const codes = validateDiagramVisualGrammar(
      createDocumentFromWebMCP({
        diagramType: "database-model",
        nodes: [
          {
            id: "users",
            type: "table",
            label: "users",
            rows: [{ id: "email", name: "email", type: "varchar(255)" }],
          },
          {
            id: "orders",
            type: "table",
            label: "orders",
            rows: [{ id: "id", name: "id PK", type: "uuid" }],
          },
        ],
        edges: [{ source: "users", target: "orders", label: "owns" }],
      }),
    ).issues.map((issue) => `${issue.code}:${issue.elementId ?? ""}`);

    expect(codes).toContain("TABLE_WITHOUT_PRIMARY_KEY:users");
    // orders marks "id PK", so only the first table is flagged.
    expect(codes).not.toContain("TABLE_WITHOUT_PRIMARY_KEY:orders");
    expect(codes.some((code) => code.startsWith("MISSING_CARDINALITY"))).toBe(true);
  });

  it("accepts both endpoint-qualified and bare Chen multiplicities", () => {
    const composed = validateDiagramVisualGrammar(
      createDocumentFromWebMCP({
        diagramType: "database-model",
        nodes: [
          {
            id: "users",
            type: "table",
            label: "users",
            rows: [{ id: "id", name: "id PK", type: "uuid" }],
          },
          {
            id: "orders",
            type: "table",
            label: "orders",
            rows: [{ id: "id", name: "id PK", type: "uuid" }],
          },
        ],
        edges: [
          { source: "users", target: "orders", sourceCardinality: "1", targetCardinality: "0..*" },
        ],
      }),
    ).issues.map((issue) => issue.code);
    expect(composed).not.toContain("MISSING_CARDINALITY");

    // Conceptual Chen notation writes the marker alone against the diamond.
    const chen = validateDiagramVisualGrammar(
      createDocumentFromWebMCP({
        diagramType: "entity-relationship",
        nodes: [
          { id: "customer", type: "er-entity", label: "Customer" },
          { id: "places", type: "er-relationship", label: "Places" },
          { id: "order", type: "er-entity", label: "Order" },
        ],
        edges: [
          { source: "customer", target: "places", label: "1" },
          { source: "places", target: "order", label: "N" },
        ],
      }),
    ).issues.map((issue) => issue.code);
    expect(chen).not.toContain("MISSING_CARDINALITY");
  });

  it("flags use-case diagrams that associate actors or misplace a stereotype", () => {
    const codes = validateDiagramVisualGrammar(
      createDocumentFromWebMCP({
        diagramType: "use-case",
        nodes: [
          { id: "admin", type: "actor", label: "Admin" },
          { id: "customer", type: "actor", label: "Customer" },
          { id: "checkout", type: "use-case", label: "Check out" },
        ],
        edges: [
          { source: "admin", target: "customer", label: "supervises" },
          { source: "customer", target: "checkout", notation: "include" },
        ],
      }),
    ).issues.map((issue) => issue.code);

    expect(codes).toContain("USE_CASE_ACTOR_ASSOCIATION");
    expect(codes).toContain("USE_CASE_STEREOTYPE_ENDPOINT");
  });

  it("flags a use-case diagram with no actor at all", () => {
    const codes = validateDiagramVisualGrammar(
      createDocumentFromWebMCP({
        diagramType: "use-case",
        nodes: [
          { id: "a", type: "use-case", label: "Browse catalog" },
          { id: "b", type: "use-case", label: "Check out" },
        ],
      }),
    ).issues.map((issue) => issue.code);
    expect(codes).toContain("USE_CASE_WITHOUT_ACTOR");
  });

  it("documents every notation an edge can carry as a queryable relationship", () => {
    const byId = new Map(VISUAL_RELATIONSHIP_REGISTRY.map((entry) => [entry.id, entry]));
    for (const id of ["association", "include", "extend", "message-flow"]) {
      const entry = byId.get(id);
      expect(entry, id).toBeDefined();
      // Structural relationships describe the model, not runtime behavior.
      expect(entry!.notation, id).toBe(id);
      expect(entry!.loop, id).toBe(false);
      expect(entry!.recommendedMotionPreset, id).toBeUndefined();
    }
  });

  it("gives every diagram type its own authoring conventions", () => {
    for (const diagramType of VISUAL_DIAGRAM_TYPES) {
      const guidance = recommendVisualGrammar({
        diagramType,
        entities: [{ id: "a", label: "Thing" }],
      }).layout;
      expect(guidance, diagramType).toBe(DIAGRAM_CONVENTIONS[diagramType]);
      expect(guidance.length, diagramType).toBeGreaterThan(40);
    }
  });

  it("builds UML classes with no invented members, and renders authored ones", () => {
    // A human dragging a class off the palette still gets sample members to
    // edit; an agent that supplied only a label must not get fields it never
    // wrote, because a reader cannot tell them from real ones.
    expect(defaultNodeData("uml-class", "Customer").attributes).toHaveLength(2);
    expect(
      defaultNodeData("uml-class", "Customer", { placeholderContent: false }).attributes,
    ).toHaveLength(0);

    const doc = createDocumentFromWebMCP({
      diagramType: "uml",
      nodes: [
        { id: "plain", type: "uml-class", label: "Customer" },
        {
          id: "authored",
          type: "uml-class",
          label: "Order",
          attributes: [{ id: "a1", text: "- total: Money" }],
          methods: [{ id: "m1", text: "+ addLine(item): void" }],
        },
      ],
    });
    expect(doc.nodes[0].data.attributes).toEqual([]);
    expect(doc.nodes[0].data.methods).toEqual([]);
    expect(doc.nodes[1].data.attributes).toEqual([{ id: "a1", text: "- total: Money" }]);
    expect(doc.nodes[1].data.methods).toEqual([{ id: "m1", text: "+ addLine(item): void" }]);
    // Reserved height so routing plans around the box that is actually painted.
    expect(Number(doc.nodes[1].data.layoutHeight)).toBeGreaterThan(40);

    expect(() =>
      createDocumentFromWebMCP({
        nodes: [{ id: "n", type: "process", label: "Step", attributes: [{ id: "a", text: "x" }] }],
      }),
    ).toThrow(/attributes and methods require/);
  });

  it("grows a shape whose geometry leaves less room for the same label", () => {
    const label = "Payment authorization declined?";
    const [rect, diamond] = ["process", "decision"].map(
      (type) =>
        createDocumentFromWebMCP({ nodes: [{ id: "n", type, label }] }).nodes[0] as {
          style?: Record<string, unknown>;
        },
    );
    // A diamond's inscribed box is about half its bounding box on each axis, so
    // it has to be bigger than a rectangle to hold the same text.
    expect(Number(diamond.style?.width)).toBeGreaterThan(Number(rect.style?.width));
    expect(Number(diamond.style?.height)).toBeGreaterThan(Number(rect.style?.height));
  });

  it("picks the element the label describes, not just the role", () => {
    const pick = (diagramType: VisualDiagramType, label: string, role?: string) =>
      recommendVisualGrammar({
        diagramType,
        entities: [{ id: "x", label, ...(role ? { role } : {}) }],
      }).elements[0].elementId;

    // A role must not hide the label: this used to classify on "component".
    expect(pick("architecture", "Postgres", "component")).toBe("infra-postgresql");
    expect(pick("architecture", "Redis")).toBe("infra-redis");
    // Whole-word matching: "ui" no longer matches inside "build"/"circuit".
    expect(pick("architecture", "Build pipeline")).toBe("arch-backend");
    expect(pick("architecture", "Circuit breaker")).toBe("arch-backend");
    // An API gateway routes traffic; it is not a security control.
    expect(pick("architecture", "API gateway")).toBe("arch-backend");
    // Punctuation is flattened, so the hyphenated form matches too.
    expect(pick("architecture", "third-party API")).toBe("arch-external");
    expect(pick("architecture", "S3 bucket")).toBe("arch-database");
    // A trailing question mark is a branch in every notation that has one.
    expect(pick("flowchart", "Payment accepted?")).toBe("decision");
    expect(pick("bpmn", "Complete?")).toBe("bpmn-gateway-exclusive");
    expect(pick("lifecycle", "Approved?")).toBe("lifecycle-decision");
    // Shapes that used to be unreachable.
    expect(pick("flowchart", "Wait 30s")).toBe("delay");
    expect(pick("flowchart", "Manual review")).toBe("manual-operation");
    expect(pick("lifecycle", "Archived")).toBe("lifecycle-neutral");
    expect(pick("bpmn", "Claim closed")).toBe("bpmn-end");
    expect(pick("bpmn", "Claim received")).toBe("bpmn-start");
    // A plain domain noun is a class, not a deployable component.
    expect(pick("uml", "Customer")).toBe("uml-class");
    // Plural tolerance.
    expect(pick("data-flow", "Dashboards")).toBe("data-sink");
    // general has real elements for these; round-rect's own avoidFor listed them.
    expect(pick("general", "Database")).toBe("database");
    expect(pick("general", "User")).toBe("actor");
    expect(pick("general", "Decision")).toBe("diamond");
    // Still true: an explicit software signal beats a human-sounding name.
    expect(pick("sequence", "User service")).toBe("sequence-participant");
    expect(pick("bpmn", "Send email")).toBe("bpmn-task");
  });

  it("flags a shape that contradicts its own label", () => {
    const codes = (input: Parameters<typeof createDocumentFromWebMCP>[0]) =>
      validateDiagramVisualGrammar(createDocumentFromWebMCP(input)).issues.map(
        (issue) => issue.code,
      );

    expect(
      codes({
        diagramType: "architecture",
        nodes: [{ id: "n", type: "arch-backend", label: "Session cache" }],
      }),
    ).toContain("LABEL_DESCRIBES_DATASTORE");

    expect(
      codes({
        diagramType: "architecture",
        nodes: [{ id: "n", type: "arch-backend", label: "Customer" }],
      }),
    ).toContain("LABEL_DESCRIBES_ACTOR");

    expect(
      codes({
        diagramType: "flowchart",
        nodes: [{ id: "n", type: "process", label: "Payment accepted?" }],
      }),
    ).toContain("LABEL_ASKS_A_QUESTION");

    // The pre-existing reverse check still works, now for every store shape.
    expect(
      codes({
        diagramType: "architecture",
        nodes: [{ id: "n", type: "arch-database", label: "Auth service" }],
      }),
    ).toContain("DATASTORE_SEMANTIC_MISMATCH");

    // Mixing notations: a BPMN task has no meaning in an ER model.
    expect(
      codes({
        diagramType: "entity-relationship",
        nodes: [{ id: "n", type: "bpmn-task", label: "Review" }],
      }),
    ).toContain("ELEMENT_OUTSIDE_NOTATION");
  });

  it("stays quiet on a correct diagram in every notation", () => {
    const fixtures: Array<{
      diagramType: VisualDiagramType;
      nodes: Array<Record<string, unknown>>;
    }> = [
      {
        diagramType: "flowchart",
        nodes: [
          { id: "a", type: "terminator", label: "Start" },
          { id: "b", type: "process", label: "Validate cart" },
          { id: "c", type: "decision", label: "Accepted?" },
        ],
      },
      {
        diagramType: "architecture",
        nodes: [
          { id: "a", type: "arch-frontend", label: "Storefront" },
          { id: "b", type: "arch-backend", label: "Orders service" },
          { id: "c", type: "arch-database", label: "Postgres" },
          { id: "d", type: "infra-redis", label: "Redis" },
        ],
      },
      {
        diagramType: "use-case",
        nodes: [
          { id: "a", type: "actor", label: "Shopper" },
          { id: "b", type: "use-case", label: "Check out" },
        ],
      },
      {
        diagramType: "bpmn",
        nodes: [
          { id: "a", type: "bpmn-start", label: "Claim received" },
          { id: "b", type: "bpmn-task", label: "Triage claim" },
          { id: "c", type: "bpmn-gateway-exclusive", label: "Complete?" },
        ],
      },
      {
        diagramType: "entity-relationship",
        nodes: [
          { id: "a", type: "er-entity", label: "Member" },
          { id: "b", type: "er-relationship", label: "Borrows" },
        ],
      },
      {
        diagramType: "database-model",
        nodes: [
          {
            id: "a",
            type: "table",
            label: "customers",
            rows: [{ id: "id", name: "id PK", type: "uuid" }],
          },
        ],
      },
      {
        diagramType: "uml",
        nodes: [
          { id: "a", type: "uml-class", label: "Order" },
          { id: "b", type: "uml-interface", label: "OrderRepository" },
        ],
      },
      {
        diagramType: "lifecycle",
        nodes: [
          { id: "a", type: "lifecycle-start", label: "Draft" },
          { id: "b", type: "lifecycle-success", label: "Published" },
        ],
      },
      {
        diagramType: "data-flow",
        nodes: [
          { id: "a", type: "data-source", label: "Mobile app" },
          { id: "b", type: "data-transform", label: "Normalize" },
          { id: "c", type: "data-store", label: "Data lake" },
        ],
      },
    ];

    const suitabilityCodes = [
      "LABEL_DESCRIBES_DATASTORE",
      "LABEL_DESCRIBES_ACTOR",
      "LABEL_ASKS_A_QUESTION",
      "DATASTORE_SEMANTIC_MISMATCH",
      "ELEMENT_OUTSIDE_NOTATION",
      "UNREGISTERED_ELEMENT",
    ];
    for (const fixture of fixtures) {
      const issues = validateDiagramVisualGrammar(
        createDocumentFromWebMCP(fixture as never),
      ).issues.filter((issue) => suitabilityCodes.includes(issue.code));
      expect(issues, `${fixture.diagramType}: ${issues.map((i) => i.code).join(", ")}`).toEqual([]);
    }
  });

  it("registers every element in the human palette without drift", () => {
    expect(GRAMMAR_SHAPE_CATEGORIES).toEqual(PALETTE_SHAPE_CATEGORIES);

    const paletteIds = GRAMMAR_SHAPE_CATEGORIES.flatMap((category) =>
      category.shapes.map((shape) => shape.id),
    );
    const registryIds = VISUAL_ELEMENT_REGISTRY.map((entry) => entry.id);

    expect(new Set(registryIds).size).toBe(registryIds.length);
    expect(registryIds.sort()).toEqual([...paletteIds, "icon"].sort());
  });

  it("gives every element actionable semantic and motion guidance", () => {
    for (const entry of VISUAL_ELEMENT_REGISTRY) {
      expect(entry.purpose.length, entry.id).toBeGreaterThan(10);
      expect(entry.mostlyUsedFor.length, entry.id).toBeGreaterThan(0);
      expect(entry.avoidFor.length, entry.id).toBeGreaterThan(0);
      expect(entry.diagramTypes.length, entry.id).toBeGreaterThan(0);
      expect(entry.motionGuidance.length, entry.id).toBeGreaterThan(10);
    }
  });

  it("registers every supported node and edge motion preset", () => {
    expect(VISUAL_MOTION_REGISTRY.map((entry) => entry.id).sort()).toEqual(
      [
        "Bounce",
        "Spin",
        "Pulse Node",
        "Shake",
        "Pulse",
        "Data Flow",
        "Sequence Flow",
        "Sequential Glow",
        "Fade Path",
        "Orbit",
      ].sort(),
    );
    expect(new Set(VISUAL_MOTION_REGISTRY.map((entry) => entry.id)).size).toBe(
      VISUAL_MOTION_REGISTRY.length,
    );
    expect(VISUAL_RELATIONSHIP_REGISTRY.length).toBeGreaterThanOrEqual(10);
  });

  it("recommends native sequence notation and one-shot chronological motion", () => {
    const result = recommendVisualGrammar({
      diagramType: "sequence",
      animationGoal: "explain-flow",
      entities: [
        { id: "user", label: "User", role: "human actor" },
        { id: "browser", label: "Browser", role: "client" },
        { id: "dns", label: "DNS Resolver", role: "service" },
      ],
      relationships: [
        { source: "user", target: "browser", kind: "request", label: "Enter URL" },
        { source: "browser", target: "dns", kind: "request", label: "Resolve host" },
        { source: "dns", target: "browser", kind: "response", label: "Return IP" },
      ],
    });

    expect(result.elements.map((entry) => entry.elementId)).toEqual([
      "sequence-actor",
      "sequence-participant",
      "sequence-participant",
    ]);
    expect(result.relationships.map((entry) => entry.connectorType)).toEqual([
      "sequence-message",
      "sequence-message",
      "sequence-message-return",
    ]);
    expect(result.relationships.map((entry) => entry.order)).toEqual([1, 2, 3]);
    expect(result.relationships.every((entry) => entry.loop === false)).toBe(true);
  });

  it("recommends continuously looping flow motion outside sequence chronology", () => {
    const result = recommendVisualGrammar({
      diagramType: "data-flow",
      animationGoal: "explain-flow",
      entities: [
        { id: "client", label: "Client", role: "user" },
        { id: "gateway", label: "API Gateway", role: "api" },
        { id: "queue", label: "Order Queue", role: "queue" },
      ],
      relationships: [
        { source: "client", target: "gateway", kind: "request", label: "POST /checkout" },
        { source: "gateway", target: "queue", kind: "async", label: "enqueue order" },
      ],
    });

    expect(result.relationships.map((entry) => entry.loop)).toEqual([true, true]);
    expect(result.animation).toContain("loop continuously");

    const staticResult = recommendVisualGrammar({
      diagramType: "data-flow",
      animationGoal: "none",
      entities: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      relationships: [{ source: "a", target: "b", label: "depends" }],
    });
    expect(staticResult.relationships.every((entry) => entry.loop === false)).toBe(true);
  });

  it("detects semantic shape and choreography mistakes", () => {
    const document = createDocumentFromWebMCP({
      name: "Sequence mistakes",
      nodes: [
        { id: "browser", label: "Browser", type: "card" },
        { id: "dns", label: "DNS Resolver", type: "database" },
      ],
      edges: [
        {
          id: "request",
          source: "browser",
          target: "dns",
          label: "Request",
          motion: { preset: "Data Flow", loop: true },
        },
        {
          id: "response",
          source: "dns",
          target: "browser",
          label: "Return response",
          motion: { preset: "Data Flow", loop: true },
        },
      ],
    });

    const result = validateDiagramVisualGrammar(document, "sequence");
    const codes = result.issues.map((issue) => issue.code);

    expect(codes).toContain("DATASTORE_SEMANTIC_MISMATCH");
    expect(codes).toContain("RETURN_CONNECTOR_MISMATCH");
    expect(codes).toContain("SIMULTANEOUS_SEQUENCE_LOOPS");
    expect(codes).toContain("USE_NATIVE_SEQUENCE_PARTICIPANTS");
  });

  it("flags two sequence messages sharing the same lifeline row", () => {
    const document = createDocumentFromWebMCP({
      nodes: [
        { id: "user", label: "User", type: "sequence-actor" },
        { id: "api", label: "API", type: "sequence-participant" },
      ],
      edges: [
        { id: "m1", source: "user", target: "api", type: "sequence-message", label: "a" },
        { id: "m2", source: "user", target: "api", type: "sequence-message", label: "b" },
      ],
    });
    // Force both messages onto the same row to simulate a hand-edited collision.
    document.edges[1].sourceHandle = document.edges[0].sourceHandle;
    document.edges[1].targetHandle = document.edges[0].targetHandle;

    const result = validateDiagramVisualGrammar(document, "sequence");
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("SEQUENCE_ROW_COLLISION");
  });

  it("flags a grouping frame wired in as a flow step with nothing inside it", () => {
    const codes = validateDiagramVisualGrammar(
      createDocumentFromWebMCP({
        diagramType: "data-flow",
        nodes: [
          { id: "src", type: "data-source", label: "Web SDK events" },
          { id: "stage", type: "data-stage", label: "Daily rollup" },
          { id: "sink", type: "data-sink", label: "Analytics dashboard" },
        ],
        edges: [
          { source: "src", target: "stage", label: "clean events" },
          { source: "stage", target: "sink", label: "session metrics" },
        ],
      }),
    ).issues.map((issue) => issue.code);

    expect(codes).toContain("CONTAINER_USED_AS_STEP");
  });

  it("accepts a grouping frame that actually holds elements", () => {
    const document = createDocumentFromWebMCP({
      diagramType: "data-flow",
      nodes: [
        { id: "stage", type: "data-stage", label: "Daily rollup" },
        { id: "agg", type: "data-transform", label: "Aggregate sessions" },
        { id: "sink", type: "data-sink", label: "Analytics dashboard" },
      ],
      edges: [{ source: "stage", target: "sink", label: "session metrics" }],
    });
    document.nodes = document.nodes.map((node) =>
      node.id === "agg" ? { ...node, parentId: "stage" } : node,
    );

    const codes = validateDiagramVisualGrammar(document).issues.map((issue) => issue.code);
    expect(codes).not.toContain("CONTAINER_USED_AS_STEP");
  });

  it("flags two sibling nodes with overlapping bounds", () => {
    const document = createDocumentFromWebMCP({
      nodes: [
        { id: "a", label: "A", type: "round-rect", position: { x: 0, y: 0 } },
        { id: "b", label: "B", type: "round-rect", position: { x: 10, y: 10 } },
      ],
    });

    const result = validateDiagramVisualGrammar(document, "general");
    expect(result.issues.map((issue) => issue.code)).toContain("OVERLAPPING_ELEMENTS");
  });

  it("does not flag non-overlapping nodes", () => {
    const document = createDocumentFromWebMCP({
      nodes: [
        { id: "a", label: "A", type: "round-rect", position: { x: 0, y: 0 } },
        { id: "b", label: "B", type: "round-rect", position: { x: 400, y: 400 } },
      ],
    });

    const result = validateDiagramVisualGrammar(document, "general");
    expect(result.issues.map((issue) => issue.code)).not.toContain("OVERLAPPING_ELEMENTS");
  });

  it("suggests dropping an ambient loop off a once-only preset", () => {
    const document = createDocumentFromWebMCP({
      nodes: [
        {
          id: "a",
          label: "A",
          type: "round-rect",
          motion: { preset: "Shake", loop: true },
        },
      ],
    });

    const result = validateDiagramVisualGrammar(document, "general");
    expect(result.issues.map((issue) => issue.code)).toContain("UNSUITABLE_LOOP_POLICY");
  });

  it("suggests enabling loop on an ambient-cycle connector played once", () => {
    const document = createDocumentFromWebMCP({
      nodes: [
        { id: "a", label: "A", type: "round-rect" },
        { id: "b", label: "B", type: "round-rect" },
      ],
      edges: [{ source: "a", target: "b", motion: { preset: "Orbit", loop: false } }],
    });

    const result = validateDiagramVisualGrammar(document, "general");
    expect(result.issues.map((issue) => issue.code)).toContain("UNSUITABLE_LOOP_POLICY");
  });

  it("flags an animated element the narration never mentions", () => {
    const document = createDocumentFromWebMCP({
      nodes: [
        { id: "a", label: "A", type: "round-rect", motion: { preset: "Bounce" } },
        { id: "b", label: "B", type: "round-rect" },
      ],
      beats: [{ title: "Only about B", nodeIds: ["b"], edgeIds: [] }],
    });

    const result = validateDiagramVisualGrammar(document, "general");
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "UNNARRATED_ELEMENT", elementId: "a" }),
    );
  });

  it("flags a presentation step with no description once the diagram is narrating", () => {
    const document = createDocumentFromWebMCP({
      nodes: [{ id: "a", label: "A", type: "round-rect" }],
      beats: [{ title: "Untitled explanation", nodeIds: ["a"], edgeIds: [] }],
    });

    const result = validateDiagramVisualGrammar(document, "general");
    expect(result.issues.map((issue) => issue.code)).toContain("STEP_MISSING_DESCRIPTION");
  });

  it("does not require narration for a diagram with no presentation steps at all", () => {
    const document = createDocumentFromWebMCP({
      nodes: [{ id: "a", label: "A", type: "round-rect", motion: { preset: "Bounce" } }],
    });

    const result = validateDiagramVisualGrammar(document, "general");
    expect(result.issues.map((issue) => issue.code)).not.toContain("UNNARRATED_ELEMENT");
    expect(result.issues.map((issue) => issue.code)).not.toContain("STEP_MISSING_DESCRIPTION");
  });
});
