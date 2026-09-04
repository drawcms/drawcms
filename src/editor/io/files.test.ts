import { describe, expect, it } from "vitest";
import {
  createEmptyDocument,
  documentFileSlug,
  DocumentFileError,
  parseDrawcmsFile,
  toDrawcmsFile,
} from "./files";
import { createDocument } from "../document/serialize";

const richDocument = createDocument({
  nodes: [
    {
      id: "a",
      position: { x: 10, y: 20 },
      data: { label: "A", type: "rect" },
      type: "customShape",
    },
    {
      id: "b",
      position: { x: 100, y: 60 },
      data: { label: "B", type: "image", imageUrl: "data:image/png;base64,AA==" },
      type: "customShape",
    },
  ],
  edges: [{ id: "e1", source: "a", target: "b", label: "go" }],
  meta: { name: "My Diagram" },
});

describe("toDrawcmsFile / parseDrawcmsFile", () => {
  it("round-trips documents through the .drawcms file format", () => {
    const { filename, content } = toDrawcmsFile(richDocument);
    expect(filename).toBe("my-diagram.drawcms");
    const restored = parseDrawcmsFile(content);
    expect(restored).toEqual(richDocument);
  });

  it("opens legacy v0 payloads by migrating them", () => {
    const legacy = JSON.stringify({
      nodes: [
        {
          id: "1",
          position: { x: 1, y: 2 },
          data: { label: "Old", type: "rect" },
          type: "customShape",
        },
      ],
      edges: [],
      name: "Legacy file",
    });
    const restored = parseDrawcmsFile(legacy);
    expect(restored.schemaVersion).toBe(5);
    expect(restored.meta.name).toBe("Legacy file");
  });

  it("rejects invalid JSON with recovery guidance", () => {
    try {
      parseDrawcmsFile("{ not json");
      expect.unreachable();
    } catch (error) {
      const fileError = error as DocumentFileError;
      expect(fileError.name).toBe("DocumentFileError");
      expect(fileError.recoveryHint).toMatch(/\.drawcms/);
    }
  });

  it("rejects unknown future versions with update guidance", () => {
    try {
      parseDrawcmsFile(JSON.stringify({ schemaVersion: 99, nodes: [], edges: [] }));
      expect.unreachable();
    } catch (error) {
      const fileError = error as DocumentFileError;
      expect(fileError.message).toMatch(/not supported/);
      expect(fileError.recoveryHint).toMatch(/newer DrawCMS/);
    }
  });

  it("rejects non-document JSON with a readable message", () => {
    expect(() => parseDrawcmsFile(JSON.stringify([1, 2, 3]))).toThrow(DocumentFileError);
    expect(() => parseDrawcmsFile(JSON.stringify({ hello: "world" }))).toThrow(
      /not a readable|not supported/,
    );
  });
});

describe("documentFileSlug / createEmptyDocument", () => {
  it("derives safe file names", () => {
    expect(documentFileSlug("My Cool Diagram!!")).toBe("my-cool-diagram");
    expect(documentFileSlug("")).toBe("diagram");
    expect(documentFileSlug("___")).toBe("diagram");
  });

  it("creates an empty named document", () => {
    const doc = createEmptyDocument("Fresh");
    expect(doc.schemaVersion).toBe(5);
    expect(doc.nodes).toEqual([]);
    expect(doc.edges).toEqual([]);
    expect(doc.meta.name).toBe("Fresh");
  });
});
