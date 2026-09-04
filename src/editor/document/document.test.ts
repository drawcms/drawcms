import { describe, expect, it } from "vitest";
import {
  DOCUMENT_SCHEMA_VERSION,
  DocumentValidationError,
  parseDocument,
  safeParseDocument,
} from "./schema";
import { createDocument, deriveAssets, deterministicStringify } from "./serialize";
import type { AppEdge, AppNode } from "../types";

const nodes: AppNode[] = [
  {
    id: "n1",
    position: { x: 100, y: 200 },
    data: { label: "API", type: "aws-lambda", preset: "Pulse Node", motionSpeed: 0.5 },
    type: "customShape",
    selected: true,
    style: { width: 96, height: 96 },
  },
  {
    id: "n2",
    position: { x: 400, y: 200 },
    data: {
      label: "Avatar",
      type: "image",
      imageUrl: "data:image/png;base64,AAAA",
      _originalImageUrl: "data:image/png;base64,BBBB",
    },
    type: "customShape",
  },
];

const edges: AppEdge[] = [
  {
    id: "e1",
    source: "n1",
    target: "n2",
    selected: true,
    data: {
      preset: "Data Flow",
      motionLoop: true,
      routingMode: "curve",
      bend: { x: 36, y: -18 },
      sourceOffset: { x: -12, y: 8 },
      targetOffset: { x: 20, y: -16 },
    },
  },
];

describe("createDocument", () => {
  it("wraps editor state in a v1 envelope with motion, metadata, and assets", () => {
    const doc = createDocument({ nodes, edges, meta: { name: "System" } });

    expect(doc.schemaVersion).toBe(DOCUMENT_SCHEMA_VERSION);
    expect(doc.meta.name).toBe("System");
    expect(doc.nodes).toHaveLength(2);
    expect(doc.edges).toHaveLength(1);
    // Motion settings live on node and edge data.
    expect(doc.nodes[0].data.preset).toBe("Pulse Node");
    expect(doc.edges[0].data?.preset).toBe("Data Flow");
    // Ephemeral canvas state never enters the document, while authored edge
    // geometry remains part of the saved diagram.
    expect("selected" in doc.nodes[0]).toBe(false);
    expect("selected" in doc.edges[0]).toBe(false);
    expect(doc.edges[0].data?.routingMode).toBe("curve");
    expect(doc.edges[0].data?.bend).toEqual({ x: 36, y: -18 });
    expect(doc.edges[0].data?.sourceOffset).toEqual({ x: -12, y: 8 });
    expect(doc.edges[0].data?.targetOffset).toEqual({ x: 20, y: -16 });
    // Asset references point at the uncropped original; embedded sources keep data URLs.
    expect(doc.assets).toEqual([
      {
        id: "asset-n2",
        kind: "image",
        source: "embedded",
        uri: "data:image/png;base64,BBBB",
      },
    ]);
  });

  it("defaults the document name instead of inventing values that break determinism", () => {
    const doc = createDocument({ nodes: [], edges: [] });
    expect(doc.meta.name).toBe("Untitled diagram");
    expect(doc.canvas).toEqual({});
  });
});

describe("parseDocument", () => {
  it("round-trips a serialized document (v1 -> string -> v1)", () => {
    const doc = createDocument({
      nodes,
      edges,
      meta: { name: "RT" },
      canvas: { background: "dots" },
    });
    const restored = parseDocument(JSON.parse(deterministicStringify(doc)));
    expect(restored).toEqual(doc);
  });

  it("rejects invalid known fields with a typed error", () => {
    const doc = JSON.parse(deterministicStringify(createDocument({ nodes, edges }))) as Record<
      string,
      unknown
    >;
    doc.nodes = "not-an-array";
    expect(() => parseDocument(doc)).toThrow(DocumentValidationError);
    expect(safeParseDocument(doc).success).toBe(false);
  });

  it("persists bounded visual scale for attached sequence messages", () => {
    const doc = JSON.parse(deterministicStringify(createDocument({ nodes, edges })));
    doc.edges[0].data.sequenceType = "sequence-message";
    doc.edges[0].data.scale = 1.5;

    expect(parseDocument(doc).edges[0].data?.scale).toBe(1.5);

    doc.edges[0].data.scale = 2.05;
    expect(() => parseDocument(doc)).toThrow(DocumentValidationError);
  });

  it("preserves unknown future fields at every level", () => {
    const doc = JSON.parse(deterministicStringify(createDocument({ nodes, edges })));
    doc.futureRootField = { experimental: true };
    doc.meta.futureMetaField = 42;
    doc.nodes[0].futureNodeField = ["kept"];
    doc.nodes[0].data.futureDataField = "kept";

    const restored = parseDocument(doc);
    expect((restored as Record<string, unknown>).futureRootField).toEqual({ experimental: true });
    expect((restored.meta as Record<string, unknown>).futureMetaField).toBe(42);
    expect((restored.nodes[0] as Record<string, unknown>).futureNodeField).toEqual(["kept"]);
    expect((restored.nodes[0].data as Record<string, unknown>).futureDataField).toBe("kept");
  });
});

describe("deterministicStringify", () => {
  it("produces identical strings regardless of input key order", () => {
    const a = createDocument({ nodes, edges, meta: { name: "A" } });
    const shuffled = {
      edges: a.edges,
      meta: a.meta,
      motion: a.motion,
      nodes: a.nodes.map((node) => ({
        style: node.style,
        data: node.data,
        position: { y: node.position.y, x: node.position.x },
        type: node.type,
        id: node.id,
      })),
      canvas: a.canvas,
      assets: a.assets,
      schemaVersion: a.schemaVersion,
    };
    expect(deterministicStringify(a)).toBe(deterministicStringify(shuffled as never));
  });

  it("keeps array order because ordering is document state", () => {
    const a = createDocument({ nodes: [nodes[0], nodes[1]], edges });
    const b = createDocument({ nodes: [nodes[1], nodes[0]], edges });
    expect(deterministicStringify(a)).not.toBe(deterministicStringify(b));
  });
});

describe("deriveAssets", () => {
  it("marks remote images as remote references", () => {
    const remote: AppNode = {
      id: "r1",
      position: { x: 0, y: 0 },
      data: { label: "Pic", type: "image", imageUrl: "https://example.com/x.png" },
      type: "customShape",
    };
    expect(deriveAssets([remote])).toEqual([
      { id: "asset-r1", kind: "image", source: "remote", uri: "https://example.com/x.png" },
    ]);
  });

  it("ignores non-image nodes", () => {
    expect(deriveAssets([nodes[0]])).toEqual([]);
  });
});
