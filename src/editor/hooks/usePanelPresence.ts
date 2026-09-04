"use client";

import { useEffect, useState } from "react";

/**
 * Keeps a panel mounted while its exit transition plays. `open` mirrors the
 * desired state immediately; unmount is delayed by `exitMs` so the collapse
 * animation can finish before the panel leaves the DOM. Reopening cancels the
 * pending unmount and remounts right away.
 */
export function usePanelPresence(open: boolean, exitMs = 210) {
  const [mounted, setMounted] = useState(open);
  const [lastOpen, setLastOpen] = useState(open);

  // Adjust state during render when `open` changes (React's derived-state
  // pattern): reopening remounts synchronously, closing defers unmount to the
  // effect's timer below so the exit animation stays visible.
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setMounted(true);
  }

  useEffect(() => {
    if (!open) {
      const timer = window.setTimeout(() => setMounted(false), exitMs);
      return () => window.clearTimeout(timer);
    }
  }, [open, exitMs]);

  return { open, mounted };
}
