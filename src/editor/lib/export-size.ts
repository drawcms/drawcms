export const EXPORT_SIZE_PRESET_IDS = [
  "fit-diagram",
  "widescreen",
  "linkedin-landscape",
  "linkedin-square",
  "linkedin-portrait",
] as const;

export type ExportSizePresetId = (typeof EXPORT_SIZE_PRESET_IDS)[number];

export interface ExportDimensions {
  width: number;
  height: number;
}

export interface ExportSizePreset {
  id: ExportSizePresetId;
  label: string;
  description: string;
  dimensions?: ExportDimensions;
}

export const DEFAULT_EXPORT_SIZE_PRESET: ExportSizePresetId = "fit-diagram";

export const EXPORT_SIZE_PRESETS: readonly ExportSizePreset[] = [
  {
    id: "fit-diagram",
    label: "Fit diagram",
    description: "Crop to the diagram with breathing room",
  },
  {
    id: "widescreen",
    label: "Widescreen",
    description: "Slides, demos, and video",
    dimensions: { width: 1920, height: 1080 },
  },
  {
    id: "linkedin-landscape",
    label: "LinkedIn landscape",
    description: "Wide feed posts and sponsored images",
    dimensions: { width: 1200, height: 628 },
  },
  {
    id: "linkedin-square",
    label: "LinkedIn square",
    description: "Flexible across desktop and mobile",
    dimensions: { width: 1080, height: 1080 },
  },
  {
    id: "linkedin-portrait",
    label: "LinkedIn portrait",
    description: "More feed space on mobile",
    dimensions: { width: 1080, height: 1350 },
  },
] as const;

const FIT_PADDING = 64;
const FIT_PIXEL_RATIO = 2;
const MIN_EXPORT_DIMENSION = 320;
const MAX_EXPORT_DIMENSION = 4096;

export function isExportSizePresetId(value: unknown): value is ExportSizePresetId {
  return EXPORT_SIZE_PRESET_IDS.includes(value as ExportSizePresetId);
}

export function getExportSizePreset(id: ExportSizePresetId): ExportSizePreset {
  return EXPORT_SIZE_PRESETS.find((preset) => preset.id === id) ?? EXPORT_SIZE_PRESETS[0];
}

export function resolveExportDimensions(
  presetId: ExportSizePresetId,
  bounds: { width: number; height: number },
): ExportDimensions {
  const preset = getExportSizePreset(presetId);
  if (preset.dimensions) return preset.dimensions;

  const contentWidth = Math.max(1, bounds.width);
  const contentHeight = Math.max(1, bounds.height);
  const scale = Math.min(
    FIT_PIXEL_RATIO,
    (MAX_EXPORT_DIMENSION - FIT_PADDING * 2) / contentWidth,
    (MAX_EXPORT_DIMENSION - FIT_PADDING * 2) / contentHeight,
  );

  return {
    width: evenDimension(contentWidth * scale + FIT_PADDING * 2),
    height: evenDimension(contentHeight * scale + FIT_PADDING * 2),
  };
}

function evenDimension(value: number): number {
  const clamped = Math.max(MIN_EXPORT_DIMENSION, Math.min(MAX_EXPORT_DIMENSION, value));
  return Math.ceil(clamped / 2) * 2;
}
