// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ALL_CONTAINER_TYPES, getNodeSize } from "../../constants";
import { createDocument, deterministicStringify } from "../../document/serialize";
import { parseDocument } from "../../document/schema";
import type { AppNode } from "../../types";
import { ShapeBackground } from "./ShapeBackground";
import {
  getSemanticLabelPlacement,
  getSemanticStyleDefaults,
  SEMANTIC_CONTAINER_TYPES,
  SEMANTIC_ELEMENT_GROUPS,
  SEMANTIC_NODE_SIZES,
  SEMANTIC_SHAPE_TYPES,
  SEMANTIC_STRETCH_ARTWORK_TYPES,
  SEQUENCE_NODE_TYPES,
} from "./semantic-elements";

afterEach(cleanup);

describe("semantic element catalogue", () => {
  it("provides every requested group with a distinct, valid representative", () => {
    expect(SEMANTIC_ELEMENT_GROUPS.map((group) => group.id)).toEqual([
      "sequence",
      "architecture",
      "boundaries",
      "lifecycle",
      "dataflow",
      "annotations",
    ]);

    for (const group of SEMANTIC_ELEMENT_GROUPS) {
      expect(group.shapes.length).toBeGreaterThanOrEqual(5);
      expect(group.shapes.some((shape) => shape.id === group.representativeShapeId)).toBe(true);
    }
  });

  it("renders every semantic type through its native SVG renderer", () => {
    for (const type of SEMANTIC_SHAPE_TYPES) {
      const view = render(
        <svg>
          <ShapeBackground type={type} fill="#ffffff" stroke="#475569" strokeWidth="2" />
        </svg>,
      );
      expect(view.container.querySelector(`[data-semantic-shape="${type}"]`)).not.toBeNull();
      view.unmount();
    }
  });

  it("assigns an explicit, usable insertion size to every semantic element", () => {
    expect(Object.keys(SEMANTIC_NODE_SIZES).sort()).toEqual([...SEMANTIC_SHAPE_TYPES].sort());

    for (const type of SEMANTIC_SHAPE_TYPES) {
      const size = getNodeSize(type);
      expect(size.width, `${type} width`).toBeGreaterThanOrEqual(60);
      expect(size.height, `${type} height`).toBeGreaterThanOrEqual(60);
    }
  });

  it("provides a complete sequence-diagram authoring vocabulary", () => {
    const sequence = SEMANTIC_ELEMENT_GROUPS.find((group) => group.id === "sequence");
    expect(sequence?.shapes.map((shape) => shape.id)).toEqual([
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
    ]);
    expect(sequence?.shapes.find((shape) => shape.id === "sequence-message")?.defaultLabel).toBe(
      "request()",
    );
    expect(getSemanticLabelPlacement("sequence-participant")).toBe("participant-header");
    expect(getSemanticLabelPlacement("sequence-message-return")).toBe("message-header");
    expect(SEMANTIC_STRETCH_ARTWORK_TYPES).toEqual(
      new Set(["sequence-activation", "sequence-destroy"]),
    );
    expect(SEQUENCE_NODE_TYPES).toEqual(
      new Set([
        "sequence-actor",
        "sequence-participant",
        "sequence-activation",
        "sequence-frame",
        "sequence-reference",
        "sequence-note",
        "sequence-time",
        "sequence-destroy",
      ]),
    );
    expect([...SEQUENCE_NODE_TYPES].every((type) => SEMANTIC_SHAPE_TYPES.has(type))).toBe(true);
  });

  it("keeps aspect-sensitive artwork isolated from stretchable card geometry", () => {
    const architecture = render(
      <svg>
        <ShapeBackground type="arch-backend" fill="#ffffff" stroke="#475569" strokeWidth="2" />
      </svg>,
    );
    expect(
      architecture.container.querySelector(
        '[data-semantic-shape="arch-backend"] svg[preserveAspectRatio="xMidYMid meet"]',
      ),
    ).not.toBeNull();
    architecture.unmount();

    const participant = render(
      <svg>
        <ShapeBackground
          type="sequence-participant"
          fill="#ffffff"
          stroke="#475569"
          strokeWidth="2"
        />
      </svg>,
    );
    expect(
      participant.container
        .querySelector('[data-semantic-shape="sequence-participant"] rect')
        ?.getAttribute("height"),
    ).toBe("14");
  });

  it("treats semantic frames and stages as real nesting containers", () => {
    expect([...SEMANTIC_CONTAINER_TYPES].every((type) => ALL_CONTAINER_TYPES.has(type))).toBe(true);
    expect(getNodeSize("sequence-frame")).toEqual({ width: 380, height: 280 });
    expect(getNodeSize("boundary-region")).toEqual({ width: 360, height: 260 });
    expect(getNodeSize("sequence-participant")).toEqual({ width: 140, height: 240 });
  });

  it("round-trips semantic nodes and their export-stable styles", () => {
    const nodes: AppNode[] = [...SEMANTIC_SHAPE_TYPES].map((type, index) => ({
      id: `semantic-${index}`,
      position: { x: index * 10, y: index * 5 },
      data: {
        label: type,
        type,
        ...(getSemanticStyleDefaults(type) ?? {}),
      },
      type: SEMANTIC_CONTAINER_TYPES.has(type) ? "containerShape" : "customShape",
      style: getNodeSize(type),
      ...(SEMANTIC_CONTAINER_TYPES.has(type) ? { zIndex: -1 } : {}),
    }));
    const document = createDocument({ nodes, edges: [], meta: { name: "Semantic catalogue" } });
    const restored = parseDocument(JSON.parse(deterministicStringify(document)));

    expect(restored.nodes).toHaveLength(SEMANTIC_SHAPE_TYPES.size);
    expect(restored.nodes.map((node) => node.data.type)).toEqual(
      nodes.map((node) => node.data.type),
    );
    expect(
      restored.nodes.find((node) => node.data.type === "arch-security")?.data.strokeColor,
    ).toBe("#ea580c");
  });
});
