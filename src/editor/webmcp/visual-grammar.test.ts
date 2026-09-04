import { describe, expect, it } from "vitest";
import { SHAPE_CATEGORIES as PALETTE_SHAPE_CATEGORIES } from "../components/SidebarLeft";
import { SHAPE_CATEGORIES as GRAMMAR_SHAPE_CATEGORIES } from "../components/shapes/catalog";
import { createDocumentFromWebMCP } from "./tools";
import {
  VISUAL_ELEMENT_REGISTRY,
  VISUAL_MOTION_REGISTRY,
  VISUAL_RELATIONSHIP_REGISTRY,
  recommendVisualGrammar,
  validateDiagramVisualGrammar,
} from "./visual-grammar";

describe("DrawCMS visual grammar", () => {
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
