/** Shared frame math for deterministic capture (DM-022): preview, GIF, and
 * any future video export all step through the same schedule. */
export interface FrameSchedule {
  fps: number;
  durationSeconds: number;
  /** Number of captured frames (inclusive of t=0 through the final frame). */
  frameCount: number;
  /** Milliseconds between frames (gif.js delay unit). */
  frameDelayMs: number;
  /** Exact animation clock time per frame, seconds. */
  timesSeconds: number[];
}

export function planFrames(
  durationSeconds: number,
  fps: number,
  options?: { maxFrames?: number },
): FrameSchedule {
  if (!(durationSeconds > 0) || !Number.isFinite(durationSeconds)) {
    throw new Error("Duration must be a positive number of seconds.");
  }
  if (!Number.isInteger(fps) || fps <= 0) {
    throw new Error("Frame rate must be a positive integer.");
  }
  const frameStep = 1 / fps;
  let frameCount = Math.ceil(durationSeconds * fps) + 1;
  const max = options?.maxFrames;
  if (max !== undefined && frameCount > max) frameCount = max;
  const timesSeconds: number[] = [];
  for (let i = 0; i < frameCount; i += 1) {
    timesSeconds.push(Math.min(i * frameStep, durationSeconds));
  }
  return { fps, durationSeconds, frameCount, frameDelayMs: 1000 / fps, timesSeconds };
}

/** Cancellation + progress vocabulary shared by every capture path. */
export interface CaptureToken {
  cancelled: boolean;
}

export function createCaptureToken(): CaptureToken {
  return { cancelled: false };
}

export class CaptureCancelledError extends Error {
  constructor() {
    super("Export cancelled.");
    this.name = "CaptureCancelledError";
  }
}

export function progressAt(frameIndex: number, frameCount: number): number {
  if (frameCount <= 1) return 1;
  return frameIndex / (frameCount - 1);
}
