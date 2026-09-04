"use client";

import { useEffect, useMemo, useRef } from "react";
import type { LucideIcon } from "lucide-react";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Display-only keyboard hint (the shortcut itself lives in the handler). */
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

export interface ContextMenuSection {
  id: string;
  label?: string;
  items: ContextMenuItem[];
}

interface CanvasContextMenuProps {
  x: number;
  y: number;
  kind: "node" | "edge" | "pane";
  itemCount: number;
  /** Scene title for the story action's subtitle line. */
  sceneTitle: string | null;
  sections: ContextMenuSection[];
  onClose: () => void;
}

const MENU_WIDTH = 232;
const ITEM_HEIGHT = 36;
const SECTION_LABEL_HEIGHT = 22;
const HEADER_HEIGHT = 40;
const PADDING = 12;

export function CanvasContextMenu({
  x,
  y,
  kind,
  itemCount,
  sceneTitle,
  sections,
  onClose,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const estimatedHeight = useMemo(() => {
    let height = HEADER_HEIGHT + PADDING;
    for (const section of sections) {
      height += section.label ? SECTION_LABEL_HEIGHT : 0;
      height += section.items.length * ITEM_HEIGHT;
    }
    return height;
  }, [sections]);

  // Render-time clamping (the menu only mounts after a user interaction, so
  // window is always available here — same approach as the editor menus).
  const position = {
    left: Math.max(8, Math.min(x, window.innerWidth - MENU_WIDTH - 8)),
    top: Math.max(8, Math.min(y, window.innerHeight - estimatedHeight - 8)),
  };

  useEffect(() => {
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (
        event.key !== "ArrowDown" &&
        event.key !== "ArrowUp" &&
        event.key !== "Home" &&
        event.key !== "End"
      ) {
        return;
      }
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
          [],
      );
      if (items.length === 0) return;
      event.preventDefault();
      const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
      let nextIndex: number;
      if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = items.length - 1;
      else if (event.key === "ArrowDown")
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
      else
        nextIndex =
          currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
      items[nextIndex]?.focus();
    };
    window.addEventListener("pointerdown", closeOnPointerDown, true);
    window.addEventListener("keydown", handleKeyboard);
    return () => {
      window.removeEventListener("pointerdown", closeOnPointerDown, true);
      window.removeEventListener("keydown", handleKeyboard);
    };
  }, [onClose]);

  const headerLabel =
    kind === "pane" ? "Canvas" : `${itemCount} selected ${itemCount === 1 ? "item" : "items"}`;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={kind === "pane" ? "Canvas actions" : "Selected items"}
      className="fixed z-[80] rounded-xl border border-border bg-card p-1.5 shadow-xl"
      style={{ left: position.left, top: position.top, width: MENU_WIDTH }}
    >
      <p className="px-2.5 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">
        {headerLabel}
      </p>
      {sections.map((section, sectionIndex) => (
        <div
          key={section.id}
          className={sectionIndex > 0 ? "mt-1 border-t border-border pt-1" : ""}
        >
          {section.label && (
            <p
              role="presentation"
              className="px-2.5 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {section.label}
            </p>
          )}
          {section.items.map((item) => {
            const Icon = item.icon;
            const subtitle = item.id === "add-as-step" && sceneTitle ? sceneTitle : null;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={item.onSelect}
                className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 ${
                  item.danger
                    ? "text-danger hover:bg-danger-soft"
                    : "text-foreground hover:bg-accent hover:text-primary"
                }`}
              >
                <Icon
                  size={15}
                  strokeWidth={1.75}
                  className={item.danger ? "" : "text-muted-foreground"}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.label}</span>
                  {subtitle && (
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {subtitle}
                    </span>
                  )}
                </span>
                {item.shortcut && (
                  <kbd className="shrink-0 rounded border border-border bg-muted px-1 py-0.5 font-sans text-[10px] font-medium text-muted-foreground">
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
