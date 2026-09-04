import { DOMParser } from "@xmldom/xmldom";
import { inflateSync, strFromU8 } from "fflate";
import { generateId } from "../../lib/id";
import type { AppEdge, AppNode, AppNodeData } from "../../types";
import { info, warning, type ImportIssue, type ImportOutcome } from "../types";
import {
  fractionToHandle,
  mapDrawioShapeType,
  parseDrawioStyle,
  stripDrawioLabelMarkup,
  styleNumber,
  stylePercent,
} from "./styles";

export class DrawioParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrawioParseError";
  }
}

/**
 * Structural view of the parsed XML tree. @xmldom/xmldom and lib.dom expose
 * different typings for Document; the importer only needs this surface.
 */
interface XmlNodeList {
  length: number;
  item(index: number): XmlElement | null;
}
interface XmlElement {
  getAttribute(name: string): string | null;
  getElementsByTagName(name: string): XmlNodeList;
  textContent: string | null;
  nodeName: string;
  parentNode: { nodeName: string } | null;
}
interface XmlDocument extends XmlElement {
  documentElement: XmlElement;
}

interface CellAttrs {
  id: string;
  parent?: string;
  vertex?: boolean;
  edge?: boolean;
  value?: string;
  style?: string;
  source?: string;
  target?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  relative?: boolean;
  waypointCount: number;
  hasUserObject: boolean;
}

/** Decode a .drawio file: plain XML, or compressed (base64 raw-deflate of URI-encoded XML). */
export function decodeDrawioXml(input: string): string {
  const text = input.trim();
  if (!text.startsWith("<")) {
    throw new DrawioParseError(
      "The file is not XML. Export a .drawio file from draw.io/diagrams.net.",
    );
  }
  const doc = parseXmlDocument(text);
  const diagrams = [...elementChildren(doc.documentElement, "diagram")];
  if (diagrams.length === 0) {
    throw new DrawioParseError("No <diagram> page found in this .drawio file.");
  }
  return text;
}

function parseXmlDocument(xml: string): XmlDocument {
  const doc = new DOMParser({
    onError: () => {
      // Collect nothing; the parsererror marker below reports failures.
    },
  }).parseFromString(xml, "text/xml") as unknown as XmlDocument;
  const markers = doc.getElementsByTagName("parsererror");
  if (markers.length > 0) {
    throw new DrawioParseError("The .drawio XML is malformed and cannot be parsed.");
  }
  return doc;
}

function inflateDiagramContent(encoded: string): string {
  try {
    const bytes = Uint8Array.from(atob(encoded.trim()), (c) => c.charCodeAt(0));
    const inflated = inflateSync(bytes);
    return decodeURIComponent(strFromU8(inflated));
  } catch {
    throw new DrawioParseError("The compressed diagram page could not be decompressed.");
  }
}

function elementChildren(parent: XmlElement, tagName: string): XmlElement[] {
  const out: XmlElement[] = [];
  const all = parent.getElementsByTagName(tagName);
  for (let i = 0; i < all.length; i += 1) {
    const element = all.item(i);
    if (element) out.push(element);
  }
  return out;
}

function getGeometry(cell: XmlElement): Pick<
  CellAttrs,
  "x" | "y" | "width" | "height" | "relative"
> & {
  waypointCount: number;
} {
  const geometry = elementChildren(cell, "mxGeometry")[0];
  if (!geometry) return { waypointCount: 0 };
  const waypointArrays = elementChildren(geometry, "Array");
  let waypointCount = 0;
  for (const array of waypointArrays) {
    waypointCount += elementChildren(array, "mxPoint").length;
  }
  const num = (attr: string) => {
    const raw = geometry.getAttribute(attr);
    if (raw === null || raw === "") return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };
  return {
    x: num("x"),
    y: num("y"),
    width: num("width"),
    height: num("height"),
    relative: geometry.getAttribute("relative") === "1",
    waypointCount,
  };
}

function readCells(source: XmlElement): CellAttrs[] {
  const cells: CellAttrs[] = [];
  const all = source.getElementsByTagName("mxCell");
  for (let i = 0; i < all.length; i += 1) {
    const cell = all.item(i);
    if (!cell) continue;
    const id = cell.getAttribute("id") ?? "";
    if (id === "0" || id === "1") continue; // draw.io reserved roots
    const { waypointCount, ...geometry } = getGeometry(cell);
    cells.push({
      id,
      parent: cell.getAttribute("parent") ?? undefined,
      vertex: cell.getAttribute("vertex") === "1",
      edge: cell.getAttribute("edge") === "1",
      value: cell.getAttribute("value") ?? undefined,
      style: cell.getAttribute("style") ?? "",
      source: cell.getAttribute("source") ?? undefined,
      target: cell.getAttribute("target") ?? undefined,
      waypointCount,
      ...geometry,
      hasUserObject: cell.parentNode !== null && cell.parentNode.nodeName === "object",
    });
  }
  return cells;
}

export interface DrawioImportResult {
  document: { nodes: AppNode[]; edges: AppEdge[]; name: string };
  issues: ImportIssue[];
}

/**
 * Convert the supported draw.io subset into document payload parts (v0 —
 * the caller migrates). Everything outside the subset ends up in the report,
 * never as a thrown error.
 */
export function parseDrawio(input: string): DrawioImportResult {
  const xmlText = decodeDrawioXml(input);
  const outer = parseXmlDocument(xmlText);
  const issues: ImportIssue[] = [];

  const diagramEls = [...elementChildren(outer.documentElement, "diagram")];
  if (diagramEls.length === 0) {
    throw new DrawioParseError("No <diagram> page found in this .drawio file.");
  }
  if (diagramEls.length > 1) {
    issues.push(
      info(
        `file has ${diagramEls.length} pages; only "${diagramEls[0].getAttribute("name") ?? "Page-1"}" was imported`,
      ),
    );
  }

  const page = diagramEls[0];
  let cellsSource: XmlElement;
  if (elementChildren(page, "mxGraphModel").length > 0) {
    cellsSource = page; // plain XML: scope cell reading to this page only
  } else {
    const compressed = (page.textContent ?? "").trim();
    if (compressed.length === 0) {
      throw new DrawioParseError("The compressed diagram page is empty.");
    }
    try {
      cellsSource = parseXmlDocument(inflateDiagramContent(compressed));
    } catch (error) {
      if (error instanceof DrawioParseError) throw error;
      throw new DrawioParseError("The compressed diagram page could not be parsed.");
    }
  }

  const cells = readCells(cellsSource);
  if (cells.length === 0) {
    throw new DrawioParseError("This page contains no diagram elements.");
  }

  const vertexCells = cells.filter((cell) => cell.vertex);
  const edgeCells = cells.filter((cell) => cell.edge && (cell.source || cell.target));

  // Containers: any vertex that owns child vertices (directly or via groups).
  const childVertices = new Map<string, CellAttrs[]>();
  for (const cell of vertexCells) {
    if (!cell.parent) continue;
    const siblings = childVertices.get(cell.parent) ?? [];
    siblings.push(cell);
    childVertices.set(cell.parent, siblings);
  }
  const containerIds = new Set(
    vertexCells
      .filter((cell) => (childVertices.get(cell.id)?.length ?? 0) > 0)
      .map((cell) => cell.id),
  );

  const idMap = new Map<string, string>();
  const freshId = (cellId: string) => {
    let mapped = idMap.get(cellId);
    if (!mapped) {
      mapped = generateId();
      idMap.set(cellId, mapped);
    }
    return mapped;
  };

  const nodes: AppNode[] = [];
  let convertedSwimlanes = 0;
  let approximatedShapes = 0;
  let imagePlaceholders = 0;
  let skippedForeignObjects = 0;

  for (const cell of vertexCells) {
    if (cell.hasUserObject) skippedForeignObjects += 1;
    const style = parseDrawioStyle(cell.style ?? "");
    const mapped = mapDrawioShapeType(style);
    const isSwimlane = mapped.type === "swimlane-container";
    const isContainer = containerIds.has(cell.id) || isSwimlane;
    let type = mapped.type;
    const reportNote = mapped.note;

    if (isContainer) {
      type = "group";
      if (isSwimlane) convertedSwimlanes += 1;
    }

    const label = cell.value ? stripDrawioLabelMarkup(cell.value) : "";

    if (type === "image") {
      const src = style.values.get("image") ?? "";
      if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
        nodes.push({
          id: freshId(cell.id),
          type: "customShape",
          position: { x: cell.x ?? 0, y: cell.y ?? 0 },
          data: { label, type: "image", imageUrl: src },
          style: { width: cell.width ?? 160, height: cell.height ?? 120 },
        });
        continue;
      }
      imagePlaceholders += 1;
      type = "rect";
    }

    const data: AppNodeData = { label, type };
    const fill = style.values.get("fillColor");
    const stroke = style.values.get("strokeColor");
    if (fill && fill !== "none") data.fillColor = fill;
    if (stroke && stroke !== "none") data.strokeColor = stroke;
    const opacity = stylePercent(style, "opacity") ?? stylePercent(style, "fillOpacity");
    if (opacity !== undefined && opacity < 1) data.opacity = opacity;
    const fontSize = styleNumber(style, "fontSize");
    if (fontSize !== undefined) data.fontSize = Math.round(fontSize);
    const fontColor = style.values.get("fontColor");
    if (fontColor && fontColor !== "none") data.textColor = fontColor;
    const strokeW = styleNumber(style, "strokeWidth");
    if (strokeW !== undefined) data.strokeWidth = strokeW;

    const isChild = cell.parent && containerIds.has(cell.parent);
    let position = { x: cell.x ?? 0, y: cell.y ?? 0 };
    if (isChild) {
      const parent = vertexCells.find((candidate) => candidate.id === cell.parent);
      if (parent) {
        position = {
          x: position.x - (parent.x ?? 0),
          y: position.y - (parent.y ?? 0),
        };
      }
    }

    nodes.push({
      id: freshId(cell.id),
      type: isContainer ? "containerShape" : "customShape",
      position,
      data,
      style: { width: cell.width ?? 120, height: cell.height ?? 60 },
      ...(isChild ? { parentId: freshId(cell.parent!) } : {}),
      ...(isContainer ? { zIndex: -1 } : {}),
    });

    if (reportNote && !isContainer) approximatedShapes += 1;
  }

  const edges: AppEdge[] = [];
  let droppedEdges = 0;
  let ignoredWaypoints = 0;
  for (const cell of edgeCells) {
    if (!cell.source || !cell.target || !idMap.has(cell.source) || !idMap.has(cell.target)) {
      droppedEdges += 1;
      continue;
    }
    if (cell.waypointCount > 0) ignoredWaypoints += cell.waypointCount;
    const style = parseDrawioStyle(cell.style ?? "");
    const exitX = styleNumber(style, "exitX");
    const exitY = styleNumber(style, "exitY");
    const entryX = styleNumber(style, "entryX");
    const entryY = styleNumber(style, "entryY");
    const label = cell.value ? stripDrawioLabelMarkup(cell.value) : "";
    edges.push({
      id: `e${freshId(cell.id)}`,
      source: idMap.get(cell.source)!,
      target: idMap.get(cell.target)!,
      sourceHandle: fractionToHandle(exitX, exitY) ?? undefined,
      targetHandle: fractionToHandle(entryX, entryY) ?? undefined,
      ...(label ? { label, data: { label } } : {}),
    });
  }

  // Aggregated report entries.
  if (approximatedShapes > 0) {
    issues.push(info(`${approximatedShapes} shape(s) approximated as rectangles`));
  }
  if (convertedSwimlanes > 0) {
    issues.push(info(`${convertedSwimlanes} swimlane(s) imported as plain groups`));
  }
  if (imagePlaceholders > 0) {
    issues.push(
      warning(`${imagePlaceholders} image(s) without an accessible URL became rectangles`),
    );
  }
  if (skippedForeignObjects > 0) {
    issues.push(info(`${skippedForeignObjects} cell(s) carried custom metadata that was ignored`));
  }
  if (droppedEdges > 0) {
    issues.push(
      warning(`${droppedEdges} connector(s) had unresolvable endpoints and were skipped`),
    );
  }
  if (ignoredWaypoints > 0) {
    issues.push(info(`${ignoredWaypoints} routing waypoint(s) ignored; connectors are re-routed`));
  }

  const name = page.getAttribute("name") ?? "Imported diagram";
  return {
    document: { nodes, edges, name },
    issues,
  };
}

/** Importer-contribution shape for the plugin registry. */
export function importDrawio(input: string): ImportOutcome {
  const { document, issues } = parseDrawio(input);
  return { document, issues };
}
