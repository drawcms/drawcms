import { describe, expect, it } from "vitest";
import {
  defaultNodeData,
  nodeHasAutoHeight,
  nodeRendererType,
  nodeStyle,
  nodeZIndex,
} from "./node-factory";

/**
 * Parity coverage: the palette (hooks/useEditorState.ts `handleAddNode`) and
 * the WebMCP agent builder (webmcp/tools.ts `createDocumentFromWebMCP`) both
 * construct nodes through this module, so an agent-built element of a given
 * type must be structurally identical to a palette-built one.
 */
describe("node-factory", () => {
  it("gives table nodes their default rows and auto-height styling", () => {
    const data = defaultNodeData("table", "Users");
    expect(data.rows).toEqual([
      { id: "1", name: "id", type: "int" },
      { id: "2", name: "name", type: "varchar" },
      { id: "3", name: "created_at", type: "timestamp" },
    ]);
    expect(nodeRendererType("table")).toBe("tableShape");
    expect(nodeHasAutoHeight("table")).toBe(true);
    expect(nodeStyle("table", undefined, undefined)).toEqual({ width: 200 });
  });

  it("gives UML class nodes default attributes, methods, and a header color", () => {
    const data = defaultNodeData("uml-class", "Order");
    expect(data.attributes).toEqual([
      { id: "1", text: "- id: int" },
      { id: "2", text: "- name: string" },
    ]);
    expect(data.methods).toEqual([
      { id: "1", text: "+ getId(): int" },
      { id: "2", text: "+ getName(): string" },
    ]);
    expect(data.headerColor).toBe("#dbeafe");
    expect(data.stereotype).toBeUndefined();
    expect(nodeRendererType("uml-class")).toBe("umlClassShape");
    expect(nodeHasAutoHeight("uml-class")).toBe(true);
  });

  it("gives uml-object an empty stereotype in addition to class defaults", () => {
    const data = defaultNodeData("uml-object", "anOrder");
    expect(data.stereotype).toBe("");
  });

  it("gives ER entities default keyed attributes and a header color", () => {
    const data = defaultNodeData("er-entity", "Customer");
    expect(data.entityAttributes).toEqual([
      { id: "1", name: "id", isKey: true },
      { id: "2", name: "name", isKey: false },
      { id: "3", name: "description", isKey: false },
    ]);
    expect(data.headerColor).toBe("#fef3c7");
    expect(nodeRendererType("er-entity")).toBe("entityShape");
  });

  it("gives swimlanes default lanes and a container renderer", () => {
    const data = defaultNodeData("swimlane-h", "Process");
    expect(data.lanes).toEqual([
      { id: "1", name: "Lane 1" },
      { id: "2", name: "Lane 2" },
    ]);
    expect(nodeRendererType("swimlane-h")).toBe("swimlaneShape");
    expect(nodeZIndex("swimlane-h")).toBe(-1);
  });

  it("gives containers a negative z-index so contents render above them", () => {
    expect(nodeRendererType("group")).toBe("containerShape");
    expect(nodeZIndex("group")).toBe(-1);
  });

  it("gives sequence activations a positive z-index so they sit above lifelines", () => {
    expect(nodeZIndex("sequence-activation")).toBe(1);
  });

  it("leaves ordinary shapes without an explicit z-index", () => {
    expect(nodeZIndex("round-rect")).toBeUndefined();
    expect(nodeRendererType("round-rect")).toBe("customShape");
    expect(nodeHasAutoHeight("round-rect")).toBe(false);
  });

  it("gives standalone text its editor defaults, opting into edit-on-mount only when asked", () => {
    const paletteText = defaultNodeData("text", "Label", { editOnMount: true });
    expect(paletteText.textEditOnMount).toBe(true);
    expect(paletteText.fontSize).toBe(20);
    expect(paletteText.textAutoResize).toBe(true);

    const agentText = defaultNodeData("text", "Label");
    expect(agentText.textEditOnMount).toBeUndefined();
    expect(agentText.fontSize).toBe(20);
  });

  it("honors explicit width and height overrides, falling back to the type default", () => {
    expect(nodeStyle("round-rect", 300, 90)).toEqual({ width: 300, height: 90 });
    expect(nodeStyle("round-rect", undefined, undefined)).toEqual({ width: 160, height: 80 });
  });
});
