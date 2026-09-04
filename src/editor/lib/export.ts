"use client";

import { toPng, toSvg } from "html-to-image";
import { getNodesBounds, getViewportForBounds, type InternalNode, type Node } from "@xyflow/react";
import { addWatermarkToRasterDataUrl, addWatermarkToSvgDataUrl } from "./watermark";

/** Errors surfaced to the export UI (empty canvas, oversized renders, ...). */
export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportError";
  }
}

interface ExportOptions {
  width?: number;
  height?: number;
  viewportPadding?: number;
  /** Explicitly preserves transparency instead of falling back to the solid default. */
  background?: "solid" | "transparent";
  backgroundColor?: string;
  watermarkText?: string;
}

function getViewportElement() {
  return document.querySelector(".react-flow__viewport") as HTMLElement | null;
}

export function resolveExportBackground(options: ExportOptions): string | undefined {
  if (options.background === "transparent") return undefined;
  return options.backgroundColor ?? "#f3f4f6";
}

function exportViewportStyle(
  viewport: { x: number; y: number; zoom: number },
  width: number,
  height: number,
) {
  return {
    width: `${width}px`,
    height: `${height}px`,
    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    transformOrigin: "0 0",
  };
}

export async function exportToPng(nodes: Node[], options: ExportOptions = {}): Promise<string> {
  const viewport = getViewportElement();
  if (!viewport) throw new Error("Canvas not found");

  const { width = 1920, height = 1080, viewportPadding = 0.2 } = options;
  const nodesBounds = getNodesBounds(nodes, {
    nodeLookup: new Map(nodes.map((node) => [node.id, node as InternalNode])),
  });
  const vp = getViewportForBounds(nodesBounds, width, height, 0.5, 2, viewportPadding);

  const dataUrl = await toPng(viewport, {
    backgroundColor: resolveExportBackground(options),
    width,
    height,
    style: exportViewportStyle(vp, width, height),
  });

  return addWatermarkToRasterDataUrl(dataUrl, width, height, options.watermarkText);
}

export async function exportToSvg(nodes: Node[], options: ExportOptions = {}): Promise<string> {
  const viewport = getViewportElement();
  if (!viewport) throw new Error("Canvas not found");

  const { width = 1920, height = 1080, viewportPadding = 0.2 } = options;
  const nodesBounds = getNodesBounds(nodes, {
    nodeLookup: new Map(nodes.map((node) => [node.id, node as InternalNode])),
  });
  const vp = getViewportForBounds(nodesBounds, width, height, 0.5, 2, viewportPadding);

  const dataUrl = await toSvg(viewport, {
    backgroundColor: resolveExportBackground(options),
    width,
    height,
    style: exportViewportStyle(vp, width, height),
  });

  return addWatermarkToSvgDataUrl(dataUrl, width, height, options.watermarkText);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
