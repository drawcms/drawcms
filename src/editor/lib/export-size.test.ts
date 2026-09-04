import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPORT_SIZE_PRESET,
  getExportSizePreset,
  isExportSizePresetId,
  resolveExportDimensions,
} from "./export-size";

describe("export size presets", () => {
  it("uses a content-aware default", () => {
    expect(DEFAULT_EXPORT_SIZE_PRESET).toBe("fit-diagram");
    expect(resolveExportDimensions("fit-diagram", { width: 800, height: 400 })).toEqual({
      width: 1728,
      height: 928,
    });
  });

  it("keeps fitted exports within safe, video-compatible dimensions", () => {
    const dimensions = resolveExportDimensions("fit-diagram", { width: 10_000, height: 5_000 });
    expect(dimensions.width).toBeLessThanOrEqual(4096);
    expect(dimensions.height).toBeLessThanOrEqual(4096);
    expect(dimensions.width % 2).toBe(0);
    expect(dimensions.height % 2).toBe(0);
  });

  it("provides documented fixed social dimensions", () => {
    expect(getExportSizePreset("widescreen").dimensions).toEqual({ width: 1920, height: 1080 });
    expect(getExportSizePreset("linkedin-landscape").dimensions).toEqual({
      width: 1200,
      height: 628,
    });
    expect(getExportSizePreset("linkedin-square").dimensions).toEqual({
      width: 1080,
      height: 1080,
    });
    expect(getExportSizePreset("linkedin-portrait").dimensions).toEqual({
      width: 1080,
      height: 1350,
    });
  });

  it("rejects unknown persisted values", () => {
    expect(isExportSizePresetId("linkedin-portrait")).toBe(true);
    expect(isExportSizePresetId("full")).toBe(false);
  });
});
