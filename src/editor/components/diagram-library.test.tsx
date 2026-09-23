// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidebarLeft } from "./SidebarLeft";
import { DIAGRAM_COLLECTIONS, filterShapeCategories, PALETTE_ELEMENT_IDS } from "./shapes/catalog";
import { defaultNodeData, nodeRendererType, nodeStyle, nodeZIndex } from "../node-factory";
import { DIAGRAM_PRIMITIVE_SIZES } from "./shapes/diagram-primitives";
import { createDocument, deterministicStringify } from "../document/serialize";
import { parseDocument } from "../document/schema";

afterEach(cleanup);

describe("diagram element library", () => {
  it("covers the 17 reference views without duplicating or losing registered shapes", () => {
    expect(DIAGRAM_COLLECTIONS).toHaveLength(17);
    expect(new Set(PALETTE_ELEMENT_IDS).size).toBe(PALETTE_ELEMENT_IDS.length);
    for (const collection of DIAGRAM_COLLECTIONS) {
      expect(filterShapeCategories("", collection.id)).toHaveLength(1);
      const ids = filterShapeCategories("", collection.id).flatMap((group) =>
        group.shapes.map((shape) => shape.id),
      );
      expect(ids.sort(), collection.title).toEqual([...collection.elementIds].sort());
    }
  });

  it("finds relevant shapes by diagram name and aliases, while respecting the active filter", () => {
    const ids = (query: string, filter?: string) =>
      filterShapeCategories(query, filter).flatMap((group) =>
        group.shapes.map((shape) => shape.id),
      );
    expect(ids("ERD")).toContain("er-entity");
    expect(ids("ci cd")).toContain("process");
    expect(ids("use case")).toContain("system-boundary");
    expect(ids("topology")).toContain("network-router");
    expect(ids("router", "class")).toEqual([]);
  });

  it("supports keyboard insertion, unlabeled notation, drag data, and empty-search recovery", async () => {
    const user = userEvent.setup();
    const onAddNode = vi.fn();
    render(<SidebarLeft onAddNode={onAddNode} />);
    // The diagram-type control is a popover picker, not a native <select>: open
    // it, then choose the collection.
    await user.click(screen.getByRole("button", { name: /^Diagram type:/ }));
    await user.click(screen.getByRole("button", { name: "Choose Activity Diagram" }));
    const fork = screen.getByRole("button", { name: "Add Fork / Join to canvas" });
    fork.focus();
    await user.keyboard("{Enter}");
    expect(onAddNode).toHaveBeenCalledWith("activity-fork", "");
    const setData = vi.fn();
    fireEvent.dragStart(fork, { dataTransfer: { setData } });
    expect(setData).toHaveBeenCalledWith(
      "application/drawcms-shape",
      JSON.stringify({ type: "activity-fork", title: "" }),
    );
    await user.type(screen.getByRole("textbox", { name: "Search elements" }), "missing shape");
    // The live region reports the count; the empty state names the active
    // collection. They are separate elements — only the count is role="status".
    expect(screen.getByRole("status").textContent).toContain("0 elements found");
    expect(screen.getByText("No matching elements in Activity Diagram.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Show all elements" }));
    expect(screen.getByRole("button", { name: "Add Rectangle to canvas" })).toBeTruthy();
  });

  it("round-trips new symbols, editable labels, and nested deployment contents", () => {
    const nodes = Object.keys(DIAGRAM_PRIMITIVE_SIZES).map((type, index) => ({
      id: type,
      type: nodeRendererType(type),
      position: { x: index * 20, y: 40 },
      data: defaultNodeData(type, type.startsWith("activity-") ? "" : "Custom label"),
      style: nodeStyle(type),
      zIndex: nodeZIndex(type),
      ...(type === "network-server" ? { parentId: "deployment-node" } : {}),
    }));
    const doc = createDocument({ nodes, edges: [], meta: { name: "New notation" } });
    const restored = parseDocument(JSON.parse(deterministicStringify(doc)));
    expect(restored.nodes).toEqual(doc.nodes);
    expect(restored.nodes.find((node) => node.id === "deployment-node")?.type).toBe(
      "containerShape",
    );
    expect(restored.nodes.find((node) => node.id === "system-boundary")?.type).toBe(
      "containerShape",
    );
    expect(restored.nodes.find((node) => node.id === "network-server")?.parentId).toBe(
      "deployment-node",
    );
    expect(restored.nodes.find((node) => node.id === "activity-fork")?.style).toEqual({
      width: 180,
      height: 16,
    });
  });
});
