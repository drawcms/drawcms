import { z } from "zod";
import { generateId } from "../../lib/id";
import type { AppEdge, AppNode } from "../../types";
import { info, warning, type ImportIssue, type ImportOutcome } from "../types";

export class ExcalidrawParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExcalidrawParseError";
  }
}

const sceneSchema = z.object({
  type: z.literal("excalidraw"),
  version: z.number().int().min(1).max(2),
  elements: z.array(z.record(z.string(), z.unknown())),
  files: z.record(z.string(), z.object({ dataURL: z.string() }).passthrough()).optional(),
});

type Scene = z.infer<typeof sceneSchema>;
type Element = Record<string, unknown>;

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

export interface ExcalidrawImportResult {
  document: { nodes: AppNode[]; edges: AppEdge[]; name: string };
  issues: ImportIssue[];
}

const SHAPE_TYPES: Record<string, string> = {
  rectangle: "rect",
  ellipse: "circle",
  diamond: "diamond",
  text: "text",
  image: "image",
};

/**
 * Convert the supported Excalidraw scene subset (v1/v2 JSON) into document
 * parts. Bound text becomes the host shape's label; bound arrows keep their
 * relationships; everything else lands in the non-blocking report.
 */
export function parseExcalidraw(input: string): ExcalidrawImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new ExcalidrawParseError("This file is not valid JSON. Export an .excalidraw scene.");
  }
  const parsed = sceneSchema.safeParse(raw);
  if (!parsed.success) {
    if (
      raw !== null &&
      typeof raw === "object" &&
      (raw as Record<string, unknown>).type === "excalidraw"
    ) {
      throw new ExcalidrawParseError("This .excalidraw scene version is not supported.");
    }
    throw new ExcalidrawParseError("This file is not an Excalidraw scene.");
  }
  const scene: Scene = parsed.data;
  const issues: ImportIssue[] = [];

  const live = scene.elements.filter((element) => element.isDeleted !== true);
  const deletedCount = scene.elements.length - live.length;
  if (deletedCount > 0) issues.push(info(`${deletedCount} deleted element(s) skipped`));

  const files = scene.files ?? {};
  const elementsById = new Map<string, Element>();
  for (const element of live) {
    const id = str(element.id);
    if (id) elementsById.set(id, element);
  }

  /** Collisions can never happen: every imported element maps to a fresh id. */
  const sourceToNodeId = new Map<string, string>();
  const nodeId = (sourceId: string) => {
    let mapped = sourceToNodeId.get(sourceId);
    if (!mapped) {
      mapped = generateId();
      sourceToNodeId.set(sourceId, mapped);
    }
    return mapped;
  };

  // 1) Bound text attaches to its container's label instead of becoming a node.
  const boundLabels = new Map<string, string>();
  for (const element of live) {
    if (str(element.type) !== "text") continue;
    const containerId = str(element.containerId);
    const text = str(element.text);
    if (containerId && text !== undefined && elementsById.has(containerId)) {
      boundLabels.set(containerId, text);
    }
  }
  const consumedLabels = new Set<string>();

  // 2) Shapes, text, images, and frames become nodes.
  const nodes: AppNode[] = [];
  let freedrawSkipped = 0;
  let framesConverted = 0;
  let unboundImages = 0;
  let groupedFlattened = 0;

  for (const element of live) {
    const elementId = str(element.id) ?? "";
    const type = str(element.type) ?? "";

    if (type === "text" && str(element.containerId)) continue; // consumed as a label
    if (type === "freedraw" || type === "line" || type === "arrow") {
      if (type !== "arrow") freedrawSkipped += 1;
      continue;
    }
    if (type === "frame") {
      framesConverted += 1;
      nodes.push({
        id: nodeId(elementId),
        type: "containerShape",
        position: { x: num(element.x) ?? 0, y: num(element.y) ?? 0 },
        data: { label: str(element.name) || "Frame", type: "group" },
        style: { width: num(element.width) ?? 300, height: num(element.height) ?? 200 },
        zIndex: -1,
      });
      continue;
    }

    const shapeType = SHAPE_TYPES[type];
    if (!shapeType) {
      freedrawSkipped += 1;
      continue;
    }

    if (Array.isArray(element.groupIds) && element.groupIds.length > 0) groupedFlattened += 1;

    const boundLabel = boundLabels.get(elementId);
    if (boundLabel !== undefined) consumedLabels.add(elementId);
    const label = type === "text" ? (str(element.text) ?? "") : (boundLabel ?? "");

    const data: AppNode["data"] = { label, type: shapeType };
    const backgroundColor = str(element.backgroundColor);
    if (backgroundColor && backgroundColor !== "transparent") data.fillColor = backgroundColor;
    const strokeColor = str(element.strokeColor);
    if (strokeColor && strokeColor !== "transparent") data.strokeColor = strokeColor;
    const opacity = num(element.opacity);
    if (opacity !== undefined && opacity < 100) {
      data.opacity = Math.min(100, Math.max(0, opacity)) / 100;
    }
    const strokeWidth = num(element.strokeWidth);
    if (strokeWidth !== undefined && strokeWidth > 0) data.strokeWidth = strokeWidth;
    const fontSize = num(element.fontSize);
    if (type === "text" && fontSize !== undefined) data.fontSize = Math.round(fontSize);

    if (shapeType === "image") {
      const fileId = str(element.fileId);
      const dataURL = fileId ? files[fileId]?.dataURL : undefined;
      if (!dataURL) {
        unboundImages += 1;
        continue;
      }
      data.imageUrl = dataURL;
    }

    const frameId = str(element.frameId);
    const parentFrame = frameId ? elementsById.get(frameId) : undefined;
    const hasFrameParent = parentFrame !== undefined && str(parentFrame.type) === "frame";
    const position = {
      x: (num(element.x) ?? 0) - (hasFrameParent ? (num(parentFrame.x) ?? 0) : 0),
      y: (num(element.y) ?? 0) - (hasFrameParent ? (num(parentFrame.y) ?? 0) : 0),
    };

    nodes.push({
      id: nodeId(elementId),
      type: "customShape",
      position,
      data,
      style: { width: num(element.width) ?? 120, height: num(element.height) ?? 60 },
      ...(hasFrameParent ? { parentId: nodeId(frameId!) } : {}),
    });
  }

  const orphanLabels = [...boundLabels.keys()].filter((id) => !consumedLabels.has(id)).length;
  if (orphanLabels > 0) {
    issues.push(warning(`${orphanLabels} bound text label(s) lost their host shape`));
  }

  // 3) Arrows keep bound relationships; unbound endpoints snap onto shapes.
  const edges: AppEdge[] = [];
  let keptArrows = 0;
  let droppedArrows = 0;

  for (const element of live) {
    if (str(element.type) !== "arrow") continue;
    const elementId = str(element.id) ?? "";
    const label = (str(element.text) ?? "").trim();

    const boundEndpoint = (key: "startBinding" | "endBinding"): string | undefined => {
      const binding = element[key];
      if (binding && typeof binding === "object") {
        const target = str((binding as Record<string, unknown>).elementId);
        if (target && sourceToNodeId.has(target)) return sourceToNodeId.get(target);
      }
      return undefined;
    };

    let source = boundEndpoint("startBinding");
    let target = boundEndpoint("endBinding");

    if (!source || !target) {
      // Proximity binding: arrow endpoints inside a shape's bounding box.
      const points = Array.isArray(element.points) ? (element.points as number[][]) : [[0, 0]];
      const first = points[0] ?? [0, 0];
      const last = points[points.length - 1] ?? [0, 0];
      const hit = (px: number, py: number) =>
        nodes.find(
          (node) =>
            node.type !== "containerShape" &&
            px >= node.position.x &&
            px <= node.position.x + Number(node.style?.width ?? 0) &&
            py >= node.position.y &&
            py <= node.position.y + Number(node.style?.height ?? 0),
        );
      const arrowX = num(element.x) ?? 0;
      const arrowY = num(element.y) ?? 0;
      source ??= hit(arrowX + (num(first[0]) ?? 0), arrowY + (num(first[1]) ?? 0))?.id;
      target ??= hit(arrowX + (num(last[0]) ?? 0), arrowY + (num(last[1]) ?? 0))?.id;
    }

    if (!source || !target || source === target) {
      droppedArrows += 1;
      continue;
    }
    keptArrows += 1;
    edges.push({
      id: `e${elementId || generateId()}${generateId().slice(0, 4)}`,
      source,
      target,
      ...(label ? { label, data: { label } } : {}),
    });
  }

  if (keptArrows > 0)
    issues.push(info(`${keptArrows} arrow(s) imported with relationships intact`));
  if (droppedArrows > 0) {
    issues.push(warning(`${droppedArrows} arrow(s) had no resolvable endpoints and were skipped`));
  }
  if (freedrawSkipped > 0) {
    issues.push(
      warning(`${freedrawSkipped} freedraw/line element(s) are not animatable and were skipped`),
    );
  }
  if (framesConverted > 0) issues.push(info(`${framesConverted} frame(s) imported as groups`));
  if (groupedFlattened > 0) {
    issues.push(info(`element grouping was flattened (${groupedFlattened} element(s) affected)`));
  }
  if (unboundImages > 0) {
    issues.push(warning(`${unboundImages} image(s) without embedded data were skipped`));
  }

  return {
    document: { nodes, edges, name: deriveSceneName(raw) },
    issues,
  };
}

function deriveSceneName(raw: unknown): string {
  const appState =
    raw !== null && typeof raw === "object"
      ? ((raw as Record<string, unknown>).appState as Record<string, unknown> | undefined)
      : undefined;
  const name = appState && typeof appState.name === "string" ? appState.name.trim() : "";
  return name || "Imported scene";
}

/** Importer-contribution shape for the plugin registry. */
export function importExcalidraw(input: string): ImportOutcome {
  const { document, issues } = parseExcalidraw(input);
  return { document, issues };
}
