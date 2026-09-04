import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrateDocument } from "../../document/migrate";
import { ExcalidrawParseError, importExcalidraw, parseExcalidraw } from "./parse";

const fixture = (name: string): string =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", name), "utf8");

describe("parseExcalidraw — supported scene versions (v2)", () => {
  it("imports common shapes with styling and drops deleted elements", () => {
    const { document, issues } = parseExcalidraw(fixture("basic-shapes.excalidraw"));
    expect(document.name).toBe("Basic shapes");
    expect(document.nodes).toHaveLength(3); // the deleted rectangle is gone

    const byType = document.nodes.map((n) => n.data.type).sort();
    expect(byType).toEqual(["circle", "diamond", "rect"]);

    const ellipse = document.nodes.find((n) => n.data.type === "circle")!;
    expect(ellipse.data.strokeColor).toBe("#e03131");
    expect(ellipse.data.fillColor).toBeUndefined(); // transparent teaches nothing
    expect(ellipse.data.opacity).toBeCloseTo(0.6);
    expect(issues.some((i) => i.message.includes("deleted"))).toBe(true);
    expect(issues.some((i) => i.message.includes("grouping"))).toBe(true); // g1 group flattened
  });

  it("bound text becomes the host label; bound arrows keep their relationship", () => {
    const { document, issues } = parseExcalidraw(fixture("bound-text-arrow.excalidraw"));
    expect(document.nodes).toHaveLength(2); // host+target; text node consumed

    const host = document.nodes.find((n) => n.data.label === "Payment service")!;
    expect(host.data.type).toBe("rect");
    expect(host.data.fillColor).toBe("#ffc9c9");

    expect(document.edges).toHaveLength(1);
    const edge = document.edges[0];
    const endpoints = [edge.source, edge.target];
    expect(endpoints).toContain(host.id);
    expect(endpoints).toContain(document.nodes.find((n) => n.data.type === "circle")!.id);
    expect(issues.some((i) => i.message.includes("relationships intact"))).toBe(true);
  });

  it("unbound arrows snap to bounded shapes; hopeless arrows are reported, not fatal", () => {
    const { document, issues } = parseExcalidraw(fixture("proximity-arrows.excalidraw"));
    expect(document.edges).toHaveLength(1); // freeArrow snapped, "lost" dropped
    expect(
      issues.some((i) => i.severity === "warning" && i.message.includes("no resolvable endpoints")),
    ).toBe(true);
  });

  it("frames become groups, freedraw is reported, images resolve through files", () => {
    const { document, issues } = parseExcalidraw(fixture("frames-freedraw-images.excalidraw"));
    expect(document.name).toBe("Mixed scene");

    const frame = document.nodes.find((n) => n.data.type === "group")!;
    expect(frame.type).toBe("containerShape");
    expect(frame.data.label).toBe("Node group");

    const inside = document.nodes.find((n) => n.data.fillColor === "#b2f2bb")!;
    expect(inside.parentId).toBe(frame.id);
    expect(inside.position).toEqual({ x: 50, y: 70 }); // frame-relative

    const pic = document.nodes.find((n) => n.data.type === "image")!;
    expect(pic.data.imageUrl).toBe("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==");

    expect(issues.some((i) => i.message.includes("freedraw"))).toBe(true);
    expect(issues.some((i) => i.message.includes("frame"))).toBe(true);
    expect(issues.some((i) => i.message.includes("without embedded data"))).toBe(true);
  });

  it("every import migrates into a valid v1 document with collision-safe ids", () => {
    for (const name of [
      "basic-shapes.excalidraw",
      "bound-text-arrow.excalidraw",
      "proximity-arrows.excalidraw",
      "frames-freedraw-images.excalidraw",
    ]) {
      const { document } = importExcalidraw(fixture(name));
      const migrated = migrateDocument(document);
      expect(migrated.schemaVersion).toBe(5);
      const ids = new Set(migrated.nodes.map((n) => n.id));
      expect(ids.size).toBe(migrated.nodes.length);
      for (const edge of migrated.edges) {
        expect(ids.has(edge.source)).toBe(true);
        expect(ids.has(edge.target)).toBe(true);
      }
    }
  });

  it("fails with typed errors for non-scenes and unsupported versions", () => {
    expect(() => parseExcalidraw("not json")).toThrow(ExcalidrawParseError);
    expect(() => parseExcalidraw("{}")).toThrow(ExcalidrawParseError);
    expect(() =>
      parseExcalidraw(JSON.stringify({ type: "excalidraw", version: 3, elements: [] })),
    ).toThrow(/not supported/);
  });
});
