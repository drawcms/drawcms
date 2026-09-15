import { describe, expect, it } from "vitest";
import { createDocumentFromWebMCP } from "./tools";
import { boxesOverlap, nodeBox, segmentHitsBox } from "./routing";
import { validateDiagramVisualGrammar } from "./visual-grammar";

function expectClear(input: Parameters<typeof createDocumentFromWebMCP>[0]) {
  const document = createDocumentFromWebMCP(input);
  const boxes = document.nodes.map(nodeBox);
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) expect(boxesOverlap(boxes[i], boxes[j])).toBe(false);
  const labels = document.edges.flatMap((edge) => {
    const route = edge.data?.diagramRoute;
    expect(route, edge.id).toBeDefined();
    expect(route!.issues, edge.id).toEqual([]);
    for (let i = 1; i < route!.points.length; i++) {
      const a = route!.points[i - 1],
        b = route!.points[i];
      expect(a.x === b.x || a.y === b.y).toBe(true);
      for (const box of boxes) expect(segmentHitsBox(a, b, box), edge.id).toBe(false);
    }
    return edge.label
      ? [
          {
            x: route!.label.x - route!.labelWidth / 2,
            y: route!.label.y - route!.labelHeight / 2,
            width: route!.labelWidth,
            height: route!.labelHeight,
          },
        ]
      : [];
  });
  for (const label of labels) {
    for (const box of boxes) expect(boxesOverlap(label, box)).toBe(false);
    for (const edge of document.edges) {
      const points = edge.data!.diagramRoute!.points;
      for (let i = 1; i < points.length; i++)
        expect(segmentHitsBox(points[i - 1], points[i], label)).toBe(false);
    }
  }
  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++)
      expect(boxesOverlap(labels[i], labels[j])).toBe(false);
  return document;
}

describe("WebMCP readable diagrams", () => {
  it.each(["LR", "TB"])(
    "routes branching flows with retries and a self-loop in %s",
    (direction) => {
      expectClear({
        diagramType: "flowchart",
        direction,
        nodes: [
          { id: "start", label: "Start", type: "terminator" },
          { id: "check", label: "Payment accepted?", type: "decision" },
          { id: "ship", label: "Ship order", type: "process" },
          { id: "retry", label: "Retry payment", type: "process" },
          { id: "end", label: "Done", type: "terminator" },
        ],
        edges: [
          { source: "start", target: "check" },
          { source: "check", target: "ship", label: "Yes" },
          { source: "check", target: "retry", label: "No" },
          { source: "retry", target: "check", label: "Try again" },
          { source: "ship", target: "end" },
          { source: "retry", target: "retry", label: "Wait" },
        ],
      });
    },
  );
  it("routes BPMN parallel branches and joins", () => {
    expectClear({
      diagramType: "bpmn",
      nodes: [
        { id: "start", type: "bpmn-start", label: "Order received" },
        { id: "fork", type: "bpmn-gateway-parallel", label: "Prepare" },
        { id: "a", type: "bpmn-task", label: "Reserve inventory" },
        { id: "b", type: "bpmn-task", label: "Take payment" },
        { id: "join", type: "bpmn-gateway-parallel", label: "Ready" },
        { id: "end", type: "bpmn-end", label: "Complete" },
      ],
      edges: [
        { source: "start", target: "fork" },
        { source: "fork", target: "a" },
        { source: "fork", target: "b" },
        { source: "a", target: "join" },
        { source: "b", target: "join" },
        { source: "join", target: "end" },
      ],
    });
  });
  it("keeps use-case actors separate and renders include associations", () => {
    const doc = expectClear({
      diagramType: "use-case",
      nodes: [
        { id: "actor", type: "actor", label: "Customer" },
        { id: "order", type: "use-case", label: "Place order" },
        { id: "pay", type: "use-case", label: "Make payment" },
      ],
      edges: [
        { source: "actor", target: "order" },
        { source: "order", target: "pay", notation: "include" },
      ],
    });
    expect(doc.edges[0].data?.notation).toBe("association");
    expect(doc.edges[1].label).toBe("«include»");
  });
  it("writes the include stereotype once when the agent already spelled it", () => {
    const doc = expectClear({
      diagramType: "use-case",
      nodes: [
        { id: "order", type: "use-case", label: "Place order" },
        { id: "pay", type: "use-case", label: "Make payment" },
        { id: "login", type: "use-case", label: "Authenticate" },
      ],
      edges: [
        { source: "order", target: "pay", notation: "include", label: "«include»" },
        { source: "order", target: "login", notation: "include", label: "include after cart" },
      ],
    });
    expect(doc.edges[0].label).toBe("«include»");
    expect(doc.edges[1].label).toBe("«include»\nafter cart");
  });
  it("reserves enough label width that an all-caps protocol name stays on one line", () => {
    const doc = expectClear({
      diagramType: "architecture",
      nodes: [
        { id: "cdn", type: "arch-cloud", label: "Edge CDN" },
        { id: "gw", type: "arch-security", label: "API gateway" },
      ],
      edges: [{ id: "https", source: "cdn", target: "gw", label: "HTTPS" }],
    });
    const route = doc.edges[0].data?.diagramRoute;
    // CustomEdge sizes the label box to labelWidth with border-box and 8px
    // padding plus a 1px border, so the text gets labelWidth - 18. "HTTPS"
    // measures 40.34px at 12px/600; a 40px content box broke it mid-word.
    expect(route!.labelWidth - 18).toBeGreaterThan(41);
    expect(route!.labelHeight).toBeLessThan(30);
  });
  it("sizes physical tables from real fields and disambiguates cardinalities", () => {
    const rows = Array.from({ length: 24 }, (_, i) => ({
      id: `col${i}`,
      name: `column_${i}`,
      type: "varchar(255)",
    }));
    const doc = expectClear({
      diagramType: "database-model",
      nodes: [
        { id: "users", type: "table", label: "Users", rows },
        {
          id: "orders",
          type: "table",
          label: "Orders",
          rows: [{ id: "user", name: "user_id FK", type: "uuid" }],
        },
      ],
      edges: [
        {
          source: "users",
          target: "orders",
          sourceCardinality: "1",
          targetCardinality: "0..*",
          label: "orders.user_id → users.id",
        },
      ],
    });
    expect(doc.nodes[0].data.rows).toEqual(rows);
    expect(doc.edges[0].label).toContain("users [1] — orders [0..*]");
  });
  it("sizes a field list from its own rows and not from the palette default", () => {
    const doc = expectClear({
      diagramType: "database-model",
      nodes: [
        {
          id: "three",
          type: "table",
          label: "three_rows",
          rows: [
            { id: "a", name: "id", type: "uuid" },
            { id: "b", name: "email", type: "text" },
            { id: "c", name: "created_at", type: "timestamptz" },
          ],
        },
        {
          id: "five",
          type: "table",
          label: "five_rows",
          rows: [
            { id: "a", name: "id", type: "uuid" },
            { id: "b", name: "email", type: "text" },
            { id: "c", name: "created_at", type: "timestamptz" },
            { id: "d", name: "status", type: "text" },
            { id: "e", name: "total", type: "integer" },
          ],
        },
        // No columns at all: nothing to size from, so the palette size stands.
        { id: "empty", type: "table", label: "empty_table", rows: [] },
      ],
      edges: [{ source: "three", target: "five", notation: "association" }],
    });
    const height = (id: string) =>
      Number(doc.nodes.find((node) => node.id === id)!.data.layoutHeight);
    expect(height("three")).toBeLessThan(height("five"));
    expect(height("five") - height("three")).toBe(48);
    expect(height("empty")).toBeGreaterThan(height("three"));
  });
  it("sizes ER entities and preserves marked primary keys", () => {
    const doc = expectClear({
      diagramType: "entity-relationship",
      nodes: [
        {
          id: "customer",
          type: "er-entity",
          label: "Customer",
          entityAttributes: [{ id: "id", name: "Customer ID", isKey: true }],
        },
        { id: "owns", type: "er-relationship", label: "Places" },
        { id: "order", type: "er-entity", label: "Order", entityAttributes: [] },
      ],
      edges: [
        { source: "customer", target: "owns", label: "1" },
        { source: "owns", target: "order", label: "N" },
      ],
    });
    expect(doc.nodes[0].data.entityAttributes).toEqual([
      { id: "id", name: "Customer ID", isKey: true },
    ]);
  });
  it("avoids fixed anchors when only some positions are omitted", () => {
    const doc = expectClear({
      diagramType: "flowchart",
      nodes: [
        {
          id: "fixed",
          label: "Fixed",
          type: "process",
          position: { x: 120, y: 100 },
          width: 700,
          height: 300,
        },
        { id: "auto", label: "Automatic", type: "process" },
      ],
      edges: [{ source: "fixed", target: "auto", label: "Continue" }],
    });
    expect(doc.nodes[0].position).toEqual({ x: 120, y: 100 });
  });
  it("keeps parallel/reverse relationship labels distinct", () => {
    expectClear({
      diagramType: "flowchart",
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      edges: [
        { source: "a", target: "b", label: "Request" },
        { source: "b", target: "a", label: "Response" },
        { source: "a", target: "b", label: "Retry request" },
      ],
    });
  });
  it("routes a layered architecture diagram without crossing a tier", () => {
    expectClear({
      diagramType: "architecture",
      nodes: [
        { id: "web", label: "Web app", type: "arch-frontend" },
        { id: "gateway", label: "API gateway", type: "arch-external" },
        { id: "orders", label: "Orders service", type: "arch-backend" },
        { id: "billing", label: "Billing service", type: "arch-backend" },
        { id: "bus", label: "Event bus", type: "arch-messagebus" },
        { id: "db", label: "Primary database", type: "arch-database" },
      ],
      edges: [
        { source: "web", target: "gateway", label: "HTTPS" },
        { source: "gateway", target: "orders", label: "gRPC" },
        { source: "gateway", target: "billing", label: "gRPC" },
        { source: "orders", target: "bus", label: "OrderPlaced" },
        { source: "billing", target: "bus", label: "InvoiceIssued" },
        { source: "orders", target: "db", label: "SQL" },
        { source: "billing", target: "db", label: "SQL" },
      ],
    });
  });

  it("routes a UML component view as static associations", () => {
    const doc = expectClear({
      diagramType: "uml",
      nodes: [
        { id: "order", label: "Order", type: "uml-class" },
        { id: "repo", label: "OrderRepository", type: "uml-interface" },
        { id: "sql", label: "SqlOrderRepository", type: "uml-component" },
        { id: "pkg", label: "billing", type: "uml-package" },
      ],
      edges: [
        { source: "order", target: "repo", label: "persisted by" },
        { source: "sql", target: "repo", label: "implements" },
        { source: "pkg", target: "sql", label: "contains" },
      ],
    });
    // A structural view describes no runtime order, so nothing animates.
    expect(doc.edges.every((edge) => edge.data?.notation === "association")).toBe(true);
    expect(doc.edges.every((edge) => !edge.data?.preset)).toBe(true);
  });

  it("routes a lifecycle diagram with a return transition", () => {
    expectClear({
      diagramType: "lifecycle",
      nodes: [
        { id: "draft", label: "Draft", type: "lifecycle-start" },
        { id: "review", label: "In review", type: "lifecycle-waiting" },
        { id: "check", label: "Approved?", type: "lifecycle-decision" },
        { id: "live", label: "Published", type: "lifecycle-success" },
        { id: "rejected", label: "Rejected", type: "lifecycle-failure" },
      ],
      edges: [
        { source: "draft", target: "review", label: "submit" },
        { source: "review", target: "check", label: "reviewed" },
        { source: "check", target: "live", label: "yes" },
        { source: "check", target: "rejected", label: "no" },
        { source: "rejected", target: "draft", label: "revise" },
      ],
    });
  });

  it("routes a data-flow diagram from sources through stores to sinks", () => {
    expectClear({
      diagramType: "data-flow",
      nodes: [
        { id: "app", label: "Mobile app", type: "data-source" },
        { id: "ingest", label: "Ingest", type: "data-stream" },
        { id: "clean", label: "Normalize", type: "data-transform" },
        { id: "lake", label: "Data lake", type: "data-store" },
        { id: "pii", label: "PII vault", type: "data-protected" },
        { id: "bi", label: "Dashboards", type: "data-sink" },
      ],
      edges: [
        { source: "app", target: "ingest", label: "events" },
        { source: "ingest", target: "clean", label: "raw batches" },
        { source: "clean", target: "lake", label: "normalized rows" },
        { source: "clean", target: "pii", label: "identifiers" },
        { source: "lake", target: "bi", label: "aggregates" },
      ],
    });
  });

  it("flags BPMN event direction and gateway message flow", () => {
    const doc = createDocumentFromWebMCP({
      diagramType: "bpmn",
      nodes: [
        { id: "start", type: "bpmn-start", label: "Received" },
        { id: "gate", type: "bpmn-gateway-exclusive", label: "Valid?" },
        { id: "end", type: "bpmn-end", label: "Done" },
        { id: "other", type: "bpmn-task", label: "Notify partner" },
      ],
      edges: [
        // An end event must not emit flow, and a start event must not receive it.
        { source: "end", target: "start" },
        { source: "gate", target: "other", label: "ping", notation: "message-flow" },
      ],
    });
    const codes = validateDiagramVisualGrammar(doc).issues.map((issue) => issue.code);
    expect(codes).toContain("BPMN_EVENT_DIRECTION");
    expect(codes).toContain("BPMN_GATEWAY_MESSAGE");
  });

  it("reports unlabeled decisions and impossible fixed overlaps", () => {
    const doc = createDocumentFromWebMCP({
      nodes: [
        { id: "a", label: "Choose", type: "decision", position: { x: 0, y: 0 } },
        { id: "b", label: "B", type: "process", position: { x: 0, y: 0 } },
        { id: "c", label: "C", type: "process" },
      ],
      edges: [
        { source: "a", target: "b" },
        { source: "a", target: "c" },
      ],
    });
    const codes = validateDiagramVisualGrammar(doc).issues.map((issue) => issue.code);
    expect(codes).toContain("UNLABELED_BRANCH");
    expect(codes).toContain("OVERLAPPING_ELEMENTS");
  });
  it("rejects invalid structured input and respects explicit routing", () => {
    expect(() =>
      createDocumentFromWebMCP({ nodes: [{ id: "a", label: "Wrong", type: "process", rows: [] }] }),
    ).toThrow(/rows require/);
    const doc = createDocumentFromWebMCP({
      diagramType: "flowchart",
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      edges: [{ source: "a", target: "b", routing: "curve" }],
    });
    expect(doc.edges[0].data?.routingMode).toBe("curve");
    expect(doc.edges[0].data?.diagramRoute).toBeUndefined();
  });
});
