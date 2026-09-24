// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDocument } from "../document/serialize";
import { applyGraphEditOperations } from "../commands/commands";
import { absoluteNodePosition } from "../node-hierarchy";
import { createDrawCMSWebMCPTools, type DrawCMSWebMCPAdapter } from "./tools";

afterEach(() => vi.restoreAllMocks());

function editor() {
  let document = createDocument({ nodes: [], edges: [] });
  const adapter: DrawCMSWebMCPAdapter = {
    getDocument: () => document,
    replaceDocument: vi.fn((next) => {
      document = next;
    }),
    applyGraphEdit: vi.fn((operations) => {
      const next = applyGraphEditOperations(document, operations);
      document = { ...document, ...next };
    }),
    setElementMotion: vi.fn(),
    replaceStory: vi.fn(),
  };
  const tools = createDrawCMSWebMCPTools(adapter);
  const call = (name: string, input: unknown, signal?: AbortSignal) =>
    tools.find((tool) => tool.name === `drawcms_${name}`)!.execute(input, { signal });
  return {
    adapter,
    call,
    get document() {
      return document;
    },
  };
}

const svg =
  '<svg viewBox="0 0 24 24"><script>alert(1)</script><path onclick="bad()" d="M1 1h22v22H1z" fill="currentColor"/></svg>';
const card = {
  id: "card",
  type: "round-rect",
  label: "",
  position: { x: 100, y: 200 },
  width: 440,
  height: 120,
  borderRadius: 12,
  fillColor: "#eef2ff",
};
const icon = {
  id: "shield",
  type: "icon",
  iconName: "lucide:shield-check",
  iconColor: "#071b4c",
  label: "",
  parentId: "card",
  position: { x: 20, y: 30 },
  width: 60,
  height: 60,
};
const title = {
  id: "title",
  type: "text",
  label: "Identity & Access",
  parentId: "card",
  position: { x: 105, y: 25 },
  width: 310,
  height: 40,
  fontSize: 28,
  fontWeight: "700",
  textAlign: "left",
};

describe("WebMCP reference compositions", () => {
  it("searches Iconify without uploading the diagram and returns identifiers and licenses", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          icons: ["lucide:shield-check", "mdi:shield"],
          collections: { lucide: { name: "Lucide", license: { title: "ISC", spdx: "ISC" } } },
        }),
      ),
    );
    const target = editor();
    expect(
      await target.call("search_icons", { query: "shield", prefix: "lucide", limit: 1 }),
    ).toMatchObject({
      ok: true,
      icons: [{ iconName: "lucide:shield-check", setTitle: "Lucide", licenseSpdx: "ISC" }],
    });
    expect(String(fetch.mock.calls[0][0])).toBe(
      "https://api.iconify.design/search?query=shield&limit=32&prefix=lucide",
    );
    expect(target.adapter.replaceDocument).not.toHaveBeenCalled();
    expect(await target.call("search_icons", { query: " " })).toMatchObject({ ok: false });
    expect(
      await target.call("search_icons", { query: "shield", prefix: "https://example.com" }),
    ).toMatchObject({ ok: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("builds a card from ordered children, embedded sanitized icons, and explicit typography", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(svg));
    const target = editor();
    expect(
      await target.call("replace_diagram", {
        diagramType: "architecture",
        nodes: [
          icon,
          title,
          card,
          { ...icon, id: "second-icon", position: { x: 10, y: 10 }, parentId: "outer" },
          {
            id: "outer",
            type: "group",
            label: "",
            position: { x: 800, y: 200 },
            width: 180,
            height: 180,
          },
        ],
      }),
    ).toMatchObject({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(target.document.nodes.findIndex((n) => n.id === "card")).toBeLessThan(
      target.document.nodes.findIndex((n) => n.id === "shield"),
    );
    const renderedIcon = target.document.nodes.find((n) => n.id === "shield")!;
    expect(renderedIcon.data).toMatchObject({
      iconName: "lucide:shield-check",
      iconColor: "#071b4c",
      iconViewBox: "0 0 24 24",
    });
    expect(renderedIcon.data.iconBody).toContain("<path");
    expect(renderedIcon.data.iconBody).not.toMatch(/script|onclick/);
    expect(absoluteNodePosition(renderedIcon, target.document.nodes)).toEqual({ x: 120, y: 230 });
    expect(target.document.nodes.find((n) => n.id === "title")?.data).toMatchObject({
      fontSize: 28,
      fontWeight: "700",
      textAutoResize: false,
      textAlign: "left",
    });
    const validation = await target.call("validate_diagram", {});
    expect(validation).toMatchObject({ issueCount: 0 });
  });

  it.each(
    [
      [{ ...card, parentId: "missing" }],
      [{ ...card, parentId: "card" }],
      [
        { ...card, parentId: "other" },
        { ...card, id: "other", parentId: "card" },
      ],
      [card, { ...title, position: undefined }],
      [card, { ...icon, iconName: undefined }],
      [card, { ...icon, iconName: "https://evil.example/icon.svg" }],
      [card, { ...title, iconName: "lucide:shield-check" }],
      [card, { ...icon, iconBody: "<script/>" }],
    ].map((nodes) => [nodes]),
  )("rejects invalid hierarchy or asset inputs atomically", async (nodes) => {
    const target = editor();
    const fetch = vi.spyOn(globalThis, "fetch");
    expect(await target.call("replace_diagram", { nodes })).toMatchObject({ ok: false });
    expect(target.adapter.replaceDocument).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not partially replace a document on artwork failure or cancellation", async () => {
    const target = editor();
    await target.call("replace_diagram", { nodes: [card] });
    const before = target.document;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));
    expect(await target.call("replace_diagram", { nodes: [card, icon] })).toMatchObject({
      ok: false,
      error: { code: "ICON_SERVICE_FAILED" },
    });
    expect(target.document).toBe(before);
    const controller = new AbortController();
    vi.mocked(fetch).mockImplementation(async () => {
      controller.abort();
      return new Response(svg);
    });
    expect(
      await target.call(
        "edit_diagram",
        { operations: [{ op: "addNode", ...icon }] },
        controller.signal,
      ),
    ).toMatchObject({ ok: false });
    expect(target.document).toBe(before);
    expect(target.adapter.applyGraphEdit).not.toHaveBeenCalled();
  });

  it("preserves an edit that arrives while icon artwork is downloading", async () => {
    const target = editor();
    await target.call("replace_diagram", { nodes: [card] });
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      await target.call("edit_diagram", {
        operations: [{ op: "updateNode", nodeId: "card", label: "Human edit" }],
      });
      return new Response(svg);
    });
    expect(await target.call("replace_diagram", { nodes: [card, icon] })).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining("changed while icons") },
    });
    expect(target.document.nodes[0].data.label).toBe("Human edit");
  });

  it("groups and detaches existing artwork without moving it, and keeps a batch undoable", async () => {
    const target = editor();
    await target.call("replace_diagram", {
      nodes: [{ ...title, parentId: undefined, position: { x: 205, y: 225 } }, card],
    });
    expect(
      await target.call("edit_diagram", {
        operations: [
          { op: "updateNode", nodeId: "title", parentId: "card", fontSize: 32, width: 320 },
        ],
      }),
    ).toMatchObject({ ok: true });
    let node = target.document.nodes.find((n) => n.id === "title")!;
    expect(node.position).toEqual({ x: 105, y: 25 });
    expect(node.data.fontSize).toBe(32);
    expect(node.style?.width).toBe(320);
    expect(target.adapter.applyGraphEdit).toHaveBeenCalledTimes(1);
    const before = target.document;
    expect(
      await target.call("edit_diagram", {
        operations: [{ op: "updateNode", nodeId: "card", parentId: "title" }],
      }),
    ).toMatchObject({ ok: false });
    expect(target.document).toBe(before);
    await target.call("edit_diagram", {
      operations: [{ op: "updateNode", nodeId: "title", parentId: null }],
    });
    node = target.document.nodes.find((n) => n.id === "title")!;
    expect(node.parentId).toBeUndefined();
    expect(node.position).toEqual({ x: 205, y: 225 });
  });

  it("routes nested endpoints in canvas coordinates and preserves compositions when tidying", async () => {
    const target = editor();
    const frame = {
      id: "frame",
      type: "group",
      label: "",
      position: { x: 500, y: 700 },
      width: 1000,
      height: 400,
    };
    const left = { ...card, parentId: "frame", position: { x: 20, y: 80 } };
    const right = {
      ...card,
      id: "right",
      parentId: "frame",
      position: { x: 600, y: 80 },
      width: 250,
    };
    expect(
      await target.call("replace_diagram", {
        diagramType: "architecture",
        nodes: [frame, left, title, right],
        edges: [{ id: "flow", source: "card", target: "right", routing: "elbow" }],
      }),
    ).toMatchObject({ ok: true });
    expect(target.document.edges[0].data?.diagramRoute).toMatchObject({
      sourceBounds: { x: 520, y: 780 },
      targetBounds: { x: 1100, y: 780 },
      issues: [],
    });
    expect(await target.call("validate_diagram", {})).toMatchObject({ issueCount: 0 });
    await target.call("tidy_diagram", {});
    expect(target.document.nodes.find((n) => n.id === "card")?.position).toEqual(left.position);
    expect(target.document.nodes.find((n) => n.id === "title")?.position).toEqual(title.position);
    expect(await target.call("validate_diagram", {})).toMatchObject({ issueCount: 0 });
    await target.call("edit_diagram", {
      operations: [{ op: "updateNode", nodeId: "frame", position: { x: 900, y: 1000 } }],
    });
    expect(target.document.edges[0].data?.diagramRoute).toBeUndefined();
  });

  it("rejects edits to a child deleted earlier in the same batch", async () => {
    const target = editor();
    await target.call("replace_diagram", { nodes: [card, title] });
    const before = target.document;
    expect(
      await target.call("edit_diagram", {
        operations: [
          { op: "deleteNode", nodeId: "card" },
          { op: "updateNode", nodeId: "title", label: "Missing" },
        ],
      }),
    ).toMatchObject({ ok: false });
    expect(target.document).toBe(before);
  });
});
