"use client";

import {
  DEFAULT_EXPORT_SIZE_PRESET,
  isExportSizePresetId,
  type ExportSizePresetId,
} from "./export-size";

/** User-tunable export options, remembered between sessions (DM-018). */
export interface ExportPreferences {
  background: "solid" | "transparent";
  sizePreset: ExportSizePresetId;
}

const PREFERENCES_KEY = "drawcms.export.preferences.v1";

const DEFAULT_PREFERENCES: ExportPreferences = {
  background: "solid",
  sizePreset: DEFAULT_EXPORT_SIZE_PRESET,
};

export function loadExportPreferences(): ExportPreferences {
  if (typeof window === "undefined" || !window.localStorage) return { ...DEFAULT_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<ExportPreferences>;
    return {
      background: parsed.background === "transparent" ? "transparent" : "solid",
      sizePreset: isExportSizePresetId(parsed.sizePreset)
        ? parsed.sizePreset
        : DEFAULT_EXPORT_SIZE_PRESET,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function saveExportPreferences(preferences: ExportPreferences): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Storage may be full or blocked; preferences are a nicety, not a failure.
  }
}
