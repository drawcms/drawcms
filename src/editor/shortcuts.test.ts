// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  formatShortcut,
  matches,
  matchesShortcut,
  REDO_ALTERNATE,
  SHORTCUTS,
  shortcutHint,
  type ShortcutId,
} from "./shortcuts";

function press(key: string, modifiers: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, ...modifiers });
}

describe("shortcut matching", () => {
  it("treats Cmd and Ctrl as the same modifier", () => {
    expect(matches(press("z", { metaKey: true }), "undo")).toBe(true);
    expect(matches(press("z", { ctrlKey: true }), "undo")).toBe(true);
    expect(matches(press("z"), "undo")).toBe(false);
  });

  it("matches modifiers exactly, so undo does not swallow redo", () => {
    const redo = press("z", { metaKey: true, shiftKey: true });
    expect(matches(redo, "undo")).toBe(false);
    expect(matches(redo, "redo")).toBe(true);
    expect(matches(press("y", { ctrlKey: true }), "redo")).toBe(false);
    expect(matchesShortcut(press("y", { ctrlKey: true }), REDO_ALTERNATE)).toBe(true);
  });

  it("is case-insensitive, because Shift reports the uppercase key", () => {
    // The previous hard-coded chain compared against "z" only, so layouts that
    // report "Z" while Shift is held never reached redo.
    expect(matches(press("Z", { metaKey: true, shiftKey: true }), "redo")).toBe(true);
    expect(matches(press("R", { shiftKey: true }), "reverseEdge")).toBe(true);
    expect(matches(press("R"), "replace")).toBe(true);
  });

  it("accepts either the shifted or unshifted form of the font-size keys", () => {
    for (const key of [".", ">"]) {
      expect(matches(press(key, { metaKey: true, shiftKey: true }), "fontSizeUp")).toBe(true);
    }
    for (const key of [",", "<"]) {
      expect(matches(press(key, { metaKey: true, shiftKey: true }), "fontSizeDown")).toBe(true);
    }
  });

  it("ignores anything with Alt held so OS and browser bindings pass through", () => {
    expect(matches(press("v", { metaKey: true, altKey: true }), "paste")).toBe(false);
  });

  it("distinguishes the bare-letter shortcuts from their modified forms", () => {
    expect(matches(press("n"), "addElement")).toBe(true);
    expect(matches(press("n", { metaKey: true }), "addElement")).toBe(false);
    expect(matches(press("r", { shiftKey: true }), "replace")).toBe(false);
  });
});

describe("shortcut hints", () => {
  it("renders Apple glyphs and spelled-out keys per platform", () => {
    expect(formatShortcut(SHORTCUTS.ungroup, true)).toBe("⌘⇧G");
    expect(formatShortcut(SHORTCUTS.ungroup, false)).toBe("Ctrl+Shift+G");
    expect(formatShortcut(SHORTCUTS.delete, true)).toBe("⌫");
    expect(formatShortcut(SHORTCUTS.delete, false)).toBe("Del");
    expect(formatShortcut(SHORTCUTS.deselect, true)).toBe("⎋");
    expect(formatShortcut(SHORTCUTS.addElement, true)).toBe("N");
  });

  it("gives every shortcut a non-empty hint on both platforms", () => {
    for (const id of Object.keys(SHORTCUTS) as ShortcutId[]) {
      expect(shortcutHint(id, true), id).not.toBe("");
      expect(shortcutHint(id, false), id).not.toBe("");
    }
  });

  it("assigns each binding to exactly one action", () => {
    const seen = new Map<string, ShortcutId>();
    for (const [id, shortcut] of Object.entries(SHORTCUTS) as [
      ShortcutId,
      typeof SHORTCUTS.undo,
    ][]) {
      for (const key of shortcut.keys) {
        const signature = [
          key.toLowerCase(),
          shortcut.mod ? "mod" : "",
          shortcut.shift ? "shift" : "",
        ].join(":");
        expect(seen.get(signature), `${id} collides with ${seen.get(signature)}`).toBeUndefined();
        seen.set(signature, id);
      }
    }
  });
});
