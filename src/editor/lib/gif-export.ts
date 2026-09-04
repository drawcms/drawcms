"use client";

import { getNodesBounds, getViewportForBounds, type InternalNode, type Node } from "@xyflow/react";
import gsap from "gsap";
import { ExportError } from "./export";
import { captureToGif } from "../motion/gif-capture";
import type { CaptureToken } from "../motion/schedule";

interface GifExportOptions {
  width?: number;
  height?: number;
  viewportPadding?: number;
  fps?: number;
  duration?: number;
  quality?: number;
  backgroundColor?: string;
  onProgress?: (progress: number) => void;
  token?: CaptureToken;
  watermarkText?: string;
}

/**
 * Preset GIF export: pauses the global GSAP clock and steps it frame by
 * frame (shared schedule with the video export path, DM-022). Cancellation
 * throws CaptureCancelledError after workers are torn down; the global
 * timeline always resumes.
 */
export async function exportToGif(nodes: Node[], options: GifExportOptions = {}): Promise<Blob> {
  const {
    width = 1920,
    height = 1080,
    viewportPadding = 0.2,
    fps = 10,
    duration = 3,
    quality = 10,
    backgroundColor = "#f3f4f6",
    onProgress,
    token,
    watermarkText,
  } = options;

  if (nodes.length === 0) {
    throw new ExportError("Nothing to export — add a shape to the canvas first.");
  }
  const viewport = document.querySelector(".react-flow__viewport") as HTMLElement;
  if (!viewport) throw new ExportError("Canvas not found");

  const nodesBounds = getNodesBounds(nodes, {
    nodeLookup: new Map(nodes.map((node) => [node.id, node as InternalNode])),
  });
  const vp = getViewportForBounds(nodesBounds, width, height, 0.5, 2, viewportPadding);

  const gt = gsap.globalTimeline;
  const startTime = gt.time();
  gt.pause();

  try {
    return await captureToGif({
      viewport,
      width,
      height,
      backgroundColor,
      fps,
      durationSeconds: duration,
      quality,
      token,
      onProgress,
      viewportTransform: vp,
      seek: (timeSeconds) => gt.time(startTime + timeSeconds),
      watermarkText,
    });
  } finally {
    gt.resume();
  }
}
