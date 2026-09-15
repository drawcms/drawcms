import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./editor.css", import.meta.url)), "utf8");

/**
 * These two rules only have observable behaviour in a real browser — jsdom has no
 * cursor and does not resolve inherited `user-select` from a stylesheet — so they
 * are pinned by asserting the rules exist rather than by driving the DOM.
 */
describe("canvas interaction styles", () => {
  it("lets inline editors inside a node select text again", () => {
    // React Flow sets `user-select: none` on `.react-flow__node`, which inherits
    // into the label/text editors and kills drag-to-highlight and
    // double-click-to-select-a-word. Losing this rule silently breaks editing.
    const rule = css.match(
      /\.react-flow__node input,\s*\.react-flow__node textarea,\s*\.react-flow__node \[contenteditable="true"\]\s*\{([^}]*)\}/,
    );
    expect(rule, "node-scoped editors must opt back into text selection").not.toBeNull();
    expect(rule?.[1]).toContain("user-select: text");
  });

  it("shows a crosshair while the area-selection tool is active", () => {
    // React Flow's own `.react-flow__pane.selection` rule sets `cursor: pointer`
    // at equal specificity and loads later, so both selectors are required.
    const rule = css.match(
      /\.dm-canvas-area-select \.react-flow__pane,\s*\.dm-canvas-area-select \.react-flow__pane\.selection\s*\{([^}]*)\}/,
    );
    expect(rule, "area-select mode must beat React Flow's own pane cursor").not.toBeNull();
    expect(rule?.[1]).toContain("cursor: crosshair");
  });
});
