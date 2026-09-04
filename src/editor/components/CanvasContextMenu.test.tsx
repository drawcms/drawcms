// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Copy, Scissors, Trash2 } from "lucide-react";
import { CanvasContextMenu, type ContextMenuSection } from "./CanvasContextMenu";

const sections: ContextMenuSection[] = [
  {
    id: "edit",
    items: [
      { id: "cut", label: "Cut", icon: Scissors, shortcut: "⌘X", onSelect: vi.fn() },
      { id: "copy", label: "Copy", icon: Copy, shortcut: "⌘C", onSelect: vi.fn() },
    ],
  },
  {
    id: "danger",
    items: [
      {
        id: "delete",
        label: "Delete",
        icon: Trash2,
        danger: true,
        disabled: true,
        onSelect: vi.fn(),
      },
    ],
  },
];

describe("CanvasContextMenu", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders labelled sections with items, shortcuts, and disabled states", () => {
    render(
      <CanvasContextMenu
        x={40}
        y={40}
        kind="node"
        itemCount={2}
        sceneTitle="Scene 1"
        sections={sections}
        onClose={vi.fn()}
      />,
    );

    const menu = screen.getByRole("menu", { name: "Selected items" });
    expect(menu).toBeTruthy();
    expect(screen.getByText("2 selected items")).toBeTruthy();
    expect(screen.getByText("Cut")).toBeTruthy();
    expect(screen.getByText("⌘X")).toBeTruthy();
    const deleteItem = screen.getByRole("menuitem", { name: /Delete/ });
    expect((deleteItem as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the scene title as the Add as step subtitle", () => {
    render(
      <CanvasContextMenu
        x={40}
        y={40}
        kind="node"
        itemCount={1}
        sceneTitle="Walkthrough"
        sections={[
          {
            id: "story",
            items: [{ id: "add-as-step", label: "Add as step", icon: Copy, onSelect: vi.fn() }],
          },
        ]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Walkthrough")).toBeTruthy();
  });

  it("invokes onSelect when an enabled item is clicked", () => {
    const onSelect = vi.fn();
    render(
      <CanvasContextMenu
        x={40}
        y={40}
        kind="edge"
        itemCount={1}
        sceneTitle={null}
        sections={[{ id: "s", items: [{ id: "copy", label: "Copy", icon: Copy, onSelect }] }]}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Copy" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and outside pointerdown", () => {
    const onClose = vi.fn();
    render(
      <CanvasContextMenu
        x={40}
        y={40}
        kind="pane"
        itemCount={0}
        sceneTitle={null}
        sections={sections}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(document.body, { bubbles: true });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("moves focus with arrow keys and skips disabled items", () => {
    render(
      <CanvasContextMenu
        x={40}
        y={40}
        kind="node"
        itemCount={2}
        sceneTitle={null}
        sections={sections}
        onClose={vi.fn()}
      />,
    );
    const cut = screen.getByRole("menuitem", { name: /Cut/ });
    cut.focus();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: /Copy/ }));
    fireEvent.keyDown(window, { key: "ArrowDown" });
    // Delete is disabled; focus wraps back to the first enabled item.
    expect(document.activeElement).toBe(cut);
  });
});
