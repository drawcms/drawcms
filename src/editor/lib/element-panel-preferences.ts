"use client";

import { DEFAULT_COLLAPSED_CATEGORY_IDS } from "../components/sidebar-defaults";

/**
 * Tool-panel personalization remembered between sessions: which element groups
 * the user pinned to the collapsed rail, and the shape each group last used as
 * its rail tool. Groups added through the "Choose element groups" picker should
 * survive a reload rather than resetting to the defaults (DM-UI persistence).
 */
export interface ElementPanelPreferences {
  /** Visible collapsed-rail group ids, in rail order. Always includes "general". */
  visibleCategoryIds: string[];
  /** Map of category id → the shape id shown as that group's rail tool. */
  selectedShapeIds: Record<string, string>;
}

const PREFERENCES_KEY = "drawcms.element-panel.preferences.v1";

const DEFAULT_PREFERENCES: ElementPanelPreferences = {
  visibleCategoryIds: DEFAULT_COLLAPSED_CATEGORY_IDS,
  selectedShapeIds: {},
};

/**
 * Normalize an arbitrary visible-group list: "general" is always first and
 * present, entries are unique, and every id is a string. Unknown ids are kept
 * here (the rail filters them against the live category list at render time),
 * so a preference saved by a newer build degrades gracefully on an older one.
 */
function normalizeVisibleCategoryIds(value: unknown): string[] {
  const ids = Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : [];
  const deduped = ids.filter((id, index) => id !== "general" && ids.indexOf(id) === index);
  return ["general", ...deduped];
}

function normalizeSelectedShapeIds(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null) return {};
  const result: Record<string, string> = {};
  for (const [categoryId, shapeId] of Object.entries(value as Record<string, unknown>)) {
    if (typeof shapeId === "string") result[categoryId] = shapeId;
  }
  return result;
}

export function loadElementPanelPreferences(): ElementPanelPreferences {
  if (typeof window === "undefined" || !window.localStorage) {
    return {
      visibleCategoryIds: [...DEFAULT_PREFERENCES.visibleCategoryIds],
      selectedShapeIds: {},
    };
  }
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) {
      return {
        visibleCategoryIds: [...DEFAULT_PREFERENCES.visibleCategoryIds],
        selectedShapeIds: {},
      };
    }
    const parsed = JSON.parse(raw) as Partial<ElementPanelPreferences>;
    return {
      visibleCategoryIds: normalizeVisibleCategoryIds(parsed.visibleCategoryIds),
      selectedShapeIds: normalizeSelectedShapeIds(parsed.selectedShapeIds),
    };
  } catch {
    return {
      visibleCategoryIds: [...DEFAULT_PREFERENCES.visibleCategoryIds],
      selectedShapeIds: {},
    };
  }
}

export function saveElementPanelPreferences(preferences: ElementPanelPreferences): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({
        visibleCategoryIds: normalizeVisibleCategoryIds(preferences.visibleCategoryIds),
        selectedShapeIds: normalizeSelectedShapeIds(preferences.selectedShapeIds),
      }),
    );
  } catch {
    // Storage may be full or blocked; panel layout is a nicety, not a failure.
  }
}
