"use client";

import { toPng } from "html-to-image";
import {
  CaptureCancelledError,
  planFrames,
  progressAt,
  type CaptureToken,
  type FrameSchedule,
} from "./schedule";
import { addWatermarkToRasterDataUrl } from "../lib/watermark";

export interface GifCaptureOptions {
  viewport: HTMLElement;
  width: number;
  height: number;
  backgroundColor?: string;
  fps: number;
  durationSeconds: number;
  quality?: number;
  token?: CaptureToken;
  /** Move the shared animation clock to the frame's exact time. */
  seek: (timeSeconds: number) => void;
  onProgress?: (progress: number) => void;
  /** Viewport transform for placing the diagram inside the frame. */
  viewportTransform: { x: number; y: number; zoom: number };
  watermarkText?: string;
}

/**
 * Frame-by-frame capture with exact-clock seeking (DM-022). Both the preset
 * path and the sequence path step through the same schedule, and cleanup
 * (token abort, worker teardown) happens here for every caller.
 */
export async function captureToGif(options: GifCaptureOptions): Promise<Blob> {
  const GIF = (await import("gif.js")).default;
  const {
    viewport,
    width,
    height,
    backgroundColor,
    fps,
    durationSeconds,
    quality = 10,
    token,
    seek,
    onProgress,
    viewportTransform: vp,
    watermarkText,
  } = options;

  const schedule: FrameSchedule = planFrames(durationSeconds, fps);

  const gif = new GIF({
    workers: 2,
    quality,
    width,
    height,
    workerScript: "/gif.worker.js",
  });

  try {
    for (let i = 0; i < schedule.frameCount; i += 1) {
      if (token?.cancelled) {
        gif.abort();
        throw new CaptureCancelledError();
      }
      seek(schedule.timesSeconds[i]);
      // Double-rAF ensures the paint reflects the new clock position.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const capturedDataUrl = await toPng(viewport, {
        backgroundColor,
        width,
        height,
        pixelRatio: 1,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
        },
      });
      const dataUrl = await addWatermarkToRasterDataUrl(
        capturedDataUrl,
        width,
        height,
        watermarkText,
      );

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = dataUrl;
      });

      gif.addFrame(img, { delay: schedule.frameDelayMs });
      onProgress?.(progressAt(i, schedule.frameCount));
    }
  } catch (error) {
    gif.abort();
    throw error;
  }

  return new Promise((resolve, reject) => {
    gif.on("finished", (blob: Blob) => resolve(blob));
    gif.on("error", reject);
    gif.render();
  });
}
