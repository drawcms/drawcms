/**
 * One source of truth for editor keyboard shortcuts.
 *
 * Before this module the real key handling lived in a hard-coded if/else chain
 * in `useEditorState`, while the right-click menu carried a separate,
 * hand-written set of `kbd` hint strings. The two drifted: undo/redo were never
 * surfaced, and several menu actions had no hint because they had no shortcut.
 * Handlers now match against these definitions and the menu formats its hints
 * from the same table, so a binding and its advertised label cannot disagree.
 */

export type ShortcutId =
  | "undo"
  | "redo"
  | "cut"
  | "copy"
  | "paste"
  | "duplicate"
  | "selectAll"
  | "deselect"
  | "delete"
  | "addElement"
  | "replace"
  | "group"
  | "ungroup"
  | "toggleLock"
  | "reverseEdge"
  | "addAsStep"
  | "fontSizeUp"
  | "fontSizeDown"
  | "toggleElementsPanel"
  | "areaSelectTool"
  | "panTool";

export interface ShortcutDefinition {
  /**
   * Accepted `KeyboardEvent.key` values. Letters are listed lowercase and
   * matched case-insensitively, because holding Shift changes `key` to the
   * uppercase form on most layouts.
   */
  keys: readonly string[];
  /** Requires the platform command modifier: Cmd on Apple, Ctrl elsewhere. */
  mod?: boolean;
  /** Requires Shift. When omitted, Shift must NOT be held. */
  shift?: boolean;
  /**
   * Label shown in menus, using the same glyphs a native menu would. `Mod` is
   * substituted per platform by {@link formatShortcut}.
   */
  label: string;
}

/**
 * `⇧.` and `⇧,` produce `>` and `<` on a US layout but keep `.`/`,` on several
 * others, so both forms are accepted for the font-size pair.
 */
export const SHORTCUTS: Record<ShortcutId, ShortcutDefinition> = {
  undo: { keys: ["z"], mod: true, label: "Mod+Z" },
  redo: { keys: ["z"], mod: true, shift: true, label: "Mod+Shift+Z" },
  cut: { keys: ["x"], mod: true, label: "Mod+X" },
  copy: { keys: ["c"], mod: true, label: "Mod+C" },
  paste: { keys: ["v"], mod: true, label: "Mod+V" },
  duplicate: { keys: ["d"], mod: true, label: "Mod+D" },
  selectAll: { keys: ["a"], mod: true, label: "Mod+A" },
  deselect: { keys: ["Escape"], label: "Esc" },
  delete: { keys: ["Delete", "Backspace"], label: "Del" },
  addElement: { keys: ["n"], label: "N" },
  replace: { keys: ["r"], label: "R" },
  group: { keys: ["g"], mod: true, label: "Mod+G" },
  ungroup: { keys: ["g"], mod: true, shift: true, label: "Mod+Shift+G" },
  toggleLock: { keys: ["l"], mod: true, shift: true, label: "Mod+Shift+L" },
  reverseEdge: { keys: ["r"], shift: true, label: "Shift+R" },
  addAsStep: { keys: ["s"], label: "S" },
  fontSizeUp: { keys: [".", ">"], mod: true, shift: true, label: "Mod+Shift+." },
  fontSizeDown: { keys: [",", "<"], mod: true, shift: true, label: "Mod+Shift+," },
  toggleElementsPanel: { keys: ["b"], mod: true, label: "Mod+B" },
  areaSelectTool: { keys: ["v"], label: "V" },
  panTool: { keys: ["h"], label: "H" },
};

/** `Mod+Y` stays bound to redo for Windows muscle memory; it needs no hint of its own. */
export const REDO_ALTERNATE: ShortcutDefinition = { keys: ["y"], mod: true, label: "Mod+Y" };

/** How many rail categories digit keys can reach (`1`–`8`). */
export const ELEMENT_CATEGORY_SHORTCUT_COUNT = 8;

export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.userAgent);
}

/**
 * Whether the event came from somewhere the user is entering text, in which case
 * every editor shortcut must stand down. Label editors are `<textarea>` and also
 * stop propagation themselves, but `contentEditable` hosts would otherwise reach
 * the window listener and lose keystrokes to single-letter shortcuts.
 */
export function isTypingTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable === true;
}

/**
 * Whether a menu, dialog, or popover is on screen. Bare-key shortcuts defer to
 * an open overlay so that, for example, Escape dismisses the shape flyout
 * instead of clearing the canvas selection behind it.
 */
export function hasOpenOverlay(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector('[role="dialog"], [role="menu"], [role="alertdialog"]') !== null;
}

/** Whether the platform command modifier is held (Cmd on Apple, Ctrl elsewhere). */
function hasMod(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

/**
 * Whether `event` is this shortcut. Modifier state is matched exactly, so
 * `Mod+Z` does not also fire for `Mod+Shift+Z`.
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
  if (Boolean(shortcut.mod) !== hasMod(event)) return false;
  if (Boolean(shortcut.shift) !== event.shiftKey) return false;
  if (event.altKey) return false;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return shortcut.keys.some((candidate) =>
    candidate.length === 1 ? candidate.toLowerCase() === key : candidate === key,
  );
}

export function matches(event: KeyboardEvent, id: ShortcutId): boolean {
  return matchesShortcut(event, SHORTCUTS[id]);
}

const APPLE_GLYPHS: Record<string, string> = { Mod: "⌘", Shift: "⇧", Esc: "⎋", Del: "⌫" };
const OTHER_GLYPHS: Record<string, string> = {
  Mod: "Ctrl",
  Shift: "Shift",
  Esc: "Esc",
  Del: "Del",
};

/**
 * Render a shortcut for display. Apple builds get the glyph-only form menus use
 * there (`⌘⇧G`); every other platform gets the spelled-out `Ctrl+Shift+G`.
 */
export function formatShortcut(shortcut: ShortcutDefinition, apple = isApplePlatform()): string {
  const glyphs = apple ? APPLE_GLYPHS : OTHER_GLYPHS;
  const parts = shortcut.label.split("+").map((part) => glyphs[part] ?? part);
  return apple ? parts.join("") : parts.join("+");
}

export function shortcutHint(id: ShortcutId, apple = isApplePlatform()): string {
  return formatShortcut(SHORTCUTS[id], apple);
}
