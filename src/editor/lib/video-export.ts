import { ExportError } from "./export";
import {
  CaptureCancelledError,
  planFrames,
  progressAt,
  type CaptureToken,
} from "../motion/schedule";

/** MP4 is the single supported WebCodecs output container. */
export type VideoFormat = "mp4";

export interface VideoCodecChoice {
  muxerCodec: string;
  /** Codec/bitrate half of the config; dimensions are supplied at configure time. */
  encoderConfig: Omit<VideoEncoderConfig, "width" | "height">;
  mimeLabel: string;
}

const CODEC_LADDER: Record<VideoFormat, VideoCodecChoice[]> = {
  mp4: [
    {
      muxerCodec: "avc",
      encoderConfig: { codec: "avc1.640028", bitrate: 6_000_000 },
      mimeLabel: "video/mp4",
    },
    {
      muxerCodec: "avc",
      encoderConfig: { codec: "avc1.42001f", bitrate: 6_000_000 },
      mimeLabel: "video/mp4",
    },
  ],
};

/**
 * Pick the first supported codec from the ladder (pure, probe-injected so
 * support matrices are unit-testable — DM-027).
 */
export function pickVideoCodec(
  format: VideoFormat,
  probe: (config: Omit<VideoEncoderConfig, "width" | "height">) => boolean,
): VideoCodecChoice | null {
  for (const choice of CODEC_LADDER[format]) {
    try {
      if (probe(choice.encoderConfig)) return choice;
    } catch {
      continue;
    }
  }
  return null;
}

/** Frame timestamps in microseconds for WebCodecs (exact shared-clock math). */
export function frameTimestampsMicros(timesSeconds: number[]): number[] {
  return timesSeconds.map((seconds) => Math.round(seconds * 1_000_000));
}

export function isWebCodecsAvailable(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
}

async function resolveCodec(format: VideoFormat): Promise<VideoCodecChoice> {
  if (!isWebCodecsAvailable()) {
    throw new ExportError(
      "Video export needs WebCodecs support (Chrome 94+, Edge, or recent Safari).",
    );
  }
  for (const choice of CODEC_LADDER[format]) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        ...choice.encoderConfig,
        // Browser probes accept dimensions; 16x16 is the smallest valid probe.
        width: 16,
        height: 16,
      });
      if (support.supported) return choice;
    } catch {
      continue;
    }
  }
  throw new ExportError(
    "MP4 export is unavailable in this browser because an H.264 encoder is missing.",
  );
}

export interface VideoExportOptions {
  /** Seek the shared animation clock to an exact time in seconds. */
  seek: (timeSeconds: number) => void;
  /** Paint the current frame into an ImageBitmap at output resolution. */
  captureFrame: () => Promise<ImageBitmap>;
  durationSeconds: number;
  width: number;
  height: number;
  fps?: number;
  format: VideoFormat;
  token?: CaptureToken;
  onProgress?: (progress: number) => void;
}

/**
 * Deterministic video export (DM-027): frames come from the shared schedule
 * via `seek`, so exported timing matches editor preview exactly. Encoding and
 * muxing happen client-side through WebCodecs; cancellation closes the
 * encoder before any partial artifact can escape.
 */
export async function exportVideo(options: VideoExportOptions): Promise<Blob> {
  const { durationSeconds, width, height, fps = 30, format } = options;

  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 16 || height < 16) {
    throw new ExportError("Video dimensions are invalid.");
  }
  const choice = await resolveCodec(format);
  const schedule = planFrames(durationSeconds, fps);
  const timestamps = frameTimestampsMicros(schedule.timesSeconds);

  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  return encodeContainer(
    options,
    Muxer as unknown as MuxerFactory,
    new ArrayBufferTarget(),
    choice,
    schedule.timesSeconds.length,
    schedule.frameDelayMs,
    timestamps,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MuxerFactory = new (options: any) => MuxerLike;

interface MuxerLike {
  addVideoChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata): void;
  finalize(): void;
  target: { buffer: ArrayBuffer };
}

async function encodeContainer(
  options: VideoExportOptions,
  Muxer: MuxerFactory,
  target: { buffer: ArrayBuffer },
  choice: VideoCodecChoice,
  frameCount: number,
  frameDelayMs: number,
  timestamps: number[],
): Promise<Blob> {
  void frameCount;
  void frameDelayMs;
  const { seek, captureFrame, token, onProgress } = options;

  const muxer = new Muxer({
    target,
    video: {
      codec: choice.muxerCodec as never,
      width: Math.round(options.width),
      height: Math.round(options.height),
      frameRate: options.fps ?? 30,
    },
    fastStart: "in-memory" as const,
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      throw error;
    },
  });
  encoder.configure({
    ...choice.encoderConfig,
    width: Math.round(options.width),
    height: Math.round(options.height),
    framerate: options.fps ?? 30,
  });

  try {
    for (let i = 0; i < timestamps.length; i += 1) {
      if (token?.cancelled) {
        encoder.close();
        throw new CaptureCancelledError();
      }
      seek(timestamps[i] / 1_000_000);
      const bitmap = await captureFrame();
      const frame = new VideoFrame(bitmap, { timestamp: timestamps[i] });
      encoder.encode(frame);
      frame.close();
      bitmap.close();
      onProgress?.(progressAt(i, timestamps.length));
    }
    await encoder.flush();
    muxer.finalize();
    return new Blob([target.buffer], { type: choice.mimeLabel });
  } catch (error) {
    try {
      if (encoder.state !== "closed") encoder.close();
    } catch {
      /* encoder may already be closed */
    }
    throw error;
  }
}
