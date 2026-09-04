import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrateDocument } from "../../document/migrate";
import { parseDrawio, importDrawio, DrawioParseError } from "./parse";

const fixture = (name: string): string =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", name), "utf8");

describe("parseDrawio — representative fixtures", () => {
  it("01 basic-flowchart: nodes, labels, shape mapping, edges", () => {
    const { document, issues } = parseDrawio(fixture("basic-flowchart.drawio"));
    expect(document.name).toBe("Page-1");
    expect(document.nodes).toHaveLength(3);
    expect(document.edges).toHaveLength(2);

    const types = document.nodes.map((n) => n.data.type).sort();
    expect(types).toEqual(["circle", "rect", "round-rect"].sort());
    expect(document.nodes.find((n) => n.data.label === "Start")?.position).toEqual({
      x: 80,
      y: 80,
    });
    expect(document.edges.find((e) => e.label === "done")).toBeDefined();
    expect(issues).toEqual([]);
  });

  it("02 styled-nodes: visual style transfer", () => {
    const { document } = parseDrawio(fixture("styled-nodes.drawio"));
    const fancy = document.nodes.find((n) => n.data.label === "Fancy")!;
    expect(fancy.data.fillColor).toBe("#dbeafe");
    expect(fancy.data.strokeColor).toBe("#3b82f6");
    expect(fancy.data.strokeWidth).toBe(2);
    expect(fancy.data.fontSize).toBe(16);
    expect(fancy.data.textColor).toBe("#1e3a8a");
    expect(fancy.data.opacity).toBeCloseTo(0.8);

    const plain = document.nodes.find((n) => n.data.label === "Plain")!;
    expect(plain.data.fillColor).toBeUndefined(); // fillColor=none teaches nothing
    expect(plain.data.strokeColor).toBe("#000000");
  });

  it("03 diamond-decision: handles from exit/entry, waypoints reported", () => {
    const { document, issues } = parseDrawio(fixture("diamond-decision.drawio"));
    expect(document.nodes.find((n) => n.data.type === "diamond")).toBeDefined();

    const yes = document.edges.find((e) => e.label === "yes")!;
    expect(yes.sourceHandle).toBe("right");
    expect(yes.targetHandle).toBe("left");
    expect(issues.some((i) => i.message.includes("waypoint"))).toBe(true);
  });

  it("04 grouped-nodes: group container with relative children, cross-boundary edges", () => {
    const { document } = parseDrawio(fixture("grouped-nodes.drawio"));
    const group = document.nodes.find((n) => n.data.type === "group")!;
    expect(group.type).toBe("containerShape");

    const child = document.nodes.find((n) => n.data.label === "API")!;
    expect(child.parentId).toBe(group.id);
    // draw.io absolute coords become container-relative.
    expect(child.position).toEqual({ x: 30, y: 40 });

    expect(document.edges).toHaveLength(1);
    const edge = document.edges[0];
    const source = document.nodes.find((n) => n.id === edge.source)!;
    const target = document.nodes.find((n) => n.id === edge.target)!;
    expect([source.data.label, target.data.label].sort()).toEqual(["API", "Client"]);
  });

  it("05 swimlane-pool: pool converted to a group with a report entry", () => {
    const { document, issues } = parseDrawio(fixture("swimlane-pool.drawio"));
    const pool = document.nodes.find((n) => n.data.label === "Checkout")!;
    expect(pool.data.type).toBe("group");
    expect(pool.type).toBe("containerShape");
    expect(document.nodes.filter((n) => n.parentId === pool.id)).toHaveLength(2);
    expect(issues.some((i) => i.message.includes("swimlane"))).toBe(true);
  });

  it("06 shape-zoo: specialized shapes map onto native types", () => {
    const { document } = parseDrawio(fixture("shape-zoo.drawio"));
    const byLabel = Object.fromEntries(document.nodes.map((n) => [n.data.label, n.data.type]));
    expect(byLabel).toMatchObject({
      DB: "cylinder",
      Net: "cloud",
      User: "actor",
      Prep: "hexagon",
      Todo: "note",
    });
  });

  it("07 unsupported-oddballs: image URL kept, unknown shape approximated, metadata ignored", () => {
    const { document, issues } = parseDrawio(fixture("unsupported-oddballs.drawio"));
    const logo = document.nodes.find((n) => n.data.type === "image")!;
    expect(logo.data.imageUrl).toBe("https://example.com/logo.png");

    const custom = document.nodes.find((n) => n.data.label === "Cylinder")!;
    expect(custom.data.type).toBe("rect"); // approximated by report
    expect(issues.some((i) => i.message.includes("approximated"))).toBe(true);
    expect(issues.some((i) => i.message.includes("custom metadata"))).toBe(true);
  });

  it("08 multi-page: imports first page, notes the rest", () => {
    const { document, issues } = parseDrawio(fixture("multi-page.drawio"));
    expect(document.nodes.map((n) => n.data.label)).toEqual(["Page one A"]);
    expect(issues.some((i) => i.message.includes("2 pages"))).toBe(true);
  });

  it("09 nested-groups: parentIds chain correctly", () => {
    const { document } = parseDrawio(fixture("nested-groups.drawio"));
    const system = document.nodes.find((n) => n.data.label === "System")!;
    const service = document.nodes.find((n) => n.data.label === "Service")!;
    const worker = document.nodes.find((n) => n.data.label === "Worker")!;
    expect(service.parentId).toBe(system.id);
    expect(worker.parentId).toBe(service.id);
    expect(worker.position).toEqual({ x: 40, y: 50 }); // relative to inner group
    expect(service.position).toEqual({ x: 40, y: 40 }); // relative to outer group
  });

  it("10 compressed: deflate+base64 payload decodes and imports", () => {
    const { document, issues } = parseDrawio(fixture("compressed.drawio"));
    expect(document.nodes).toHaveLength(2);
    expect(document.edges).toHaveLength(1);
    expect(document.nodes[0].data.fillColor).toBe("#d5e8d4");
    expect(issues).toEqual([]);
  });
});

describe("parseDrawio — cross-fixture guarantees", () => {
  it("imported ids are collision safe and unique per import", () => {
    const first = parseDrawio(fixture("basic-flowchart.drawio")).document;
    const second = parseDrawio(fixture("basic-flowchart.drawio")).document;
    const firstIds = new Set(first.nodes.map((n) => n.id));
    expect(firstIds.size).toBe(first.nodes.length);
    for (const node of second.nodes) {
      expect(firstIds.has(node.id)).toBe(false);
    }
    // Edge endpoints always reference imported nodes.
    const allNodeIds = new Set(second.nodes.map((n) => n.id));
    for (const edge of second.edges) {
      expect(allNodeIds.has(edge.source)).toBe(true);
      expect(allNodeIds.has(edge.target)).toBe(true);
    }
  });

  it("every fixture import migrates into a valid v1 document", () => {
    for (const name of [
      "basic-flowchart.drawio",
      "styled-nodes.drawio",
      "diamond-decision.drawio",
      "grouped-nodes.drawio",
      "swimlane-pool.drawio",
      "shape-zoo.drawio",
      "unsupported-oddballs.drawio",
      "multi-page.drawio",
      "nested-groups.drawio",
      "compressed.drawio",
      "html-labels.drawio",
    ]) {
      const { document } = importDrawio(fixture(name));
      const migrated = migrateDocument(document);
      expect(migrated.schemaVersion).toBe(5);
    }
  });

  it("11 html-labels: markup is stripped, entities decoded, multiline kept", () => {
    const { document } = parseDrawio(fixture("html-labels.drawio"));
    const rich = document.nodes.find((n) => n.data.label.includes("note"))!;
    expect(rich.data.label).toBe("Line 1\nLine 2\nnote");
    expect(document.nodes.find((n) => n.data.type === "text")?.data.label).toBe("Just text");
  });

  it("fails with a typed error when the payload is not a drawio file", () => {
    expect(() => parseDrawio("definitely not xml")).toThrow(DrawioParseError);
    expect(() => parseDrawio("<mxfile></mxfile>")).toThrow(DrawioParseError);
    expect(() => parseDrawio("<mxfile><diagram name='x'></diagram></mxfile>")).toThrow(
      DrawioParseError,
    );
  });
});
