import { describe, expect, it } from "vitest";
import { frameTimestampsMicros, isWebCodecsAvailable, pickVideoCodec } from "./video-export";

describe("pickVideoCodec", () => {
  it("picks High-profile H.264 first for MP4 and falls back to Baseline", () => {
    const high = pickVideoCodec("mp4", (config) => config.codec === "avc1.640028");
    expect(high?.encoderConfig.codec).toBe("avc1.640028");

    const baseline = pickVideoCodec("mp4", (config) => config.codec === "avc1.42001f");
    expect(baseline?.encoderConfig.codec).toBe("avc1.42001f");
  });

  it("returns null when the browser supports nothing", () => {
    expect(pickVideoCodec("mp4", () => false)).toBeNull();
    expect(
      pickVideoCodec("mp4", () => {
        throw new Error("probe exploded");
      }),
    ).toBeNull();
  });
});

describe("frameTimestampsMicros", () => {
  it("matches the shared capture clock exactly", () => {
    expect(frameTimestampsMicros([0, 0.1, 0.2, 0.7])).toEqual([0, 100_000, 200_000, 700_000]);
  });

  it("isWebCodecsAvailable is false in the node runtime", () => {
    expect(isWebCodecsAvailable()).toBe(false);
  });
});
