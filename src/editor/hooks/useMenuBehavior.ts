"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Shared dropdown-menu behavior (DM-032): Escape to close with focus return,
 * ArrowUp/ArrowDown/Home/End roving focus between items, and focus handoff
 * when the menu opens/closes. Items opt in via `data-menu-item`; disabled
 * items are skipped. Items keep their natural tab order (no roving tabindex)
 * so Tab still walks the menu like a list.
 */
export function useMenuBehavior(open: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const focusItem = useCallback((index: number) => {
    const container = containerRef.current;
    if (!container) return;
    const items = container.querySelectorAll<HTMLElement>("[data-menu-item]:not(:disabled)");
    if (items.length === 0) return;
    const clamped = ((index % items.length) + items.length) % items.length;
    items[clamped].focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    // Items are already in the DOM here (open gates rendering); focus eagerly so
    // keyboard interaction works immediately.
    focusItem(0);
  }, [open, focusItem]);

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;
    const handler = (event: KeyboardEvent) => {
      const items = Array.from(
        container.querySelectorAll<HTMLElement>("[data-menu-item]:not(:disabled)"),
      );
      const current = items.indexOf(document.activeElement as HTMLElement);
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        triggerRef.current?.focus();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        focusItem(current + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        focusItem(current <= 0 ? items.length - 1 : current - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        focusItem(0);
      } else if (event.key === "End") {
        event.preventDefault();
        focusItem(items.length - 1);
      }
    };
    container.addEventListener("keydown", handler);
    return () => container.removeEventListener("keydown", handler);
  }, [open, onClose, focusItem]);

  return { containerRef, triggerRef };
}
