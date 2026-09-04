"use client";

import { lazy, Suspense, useCallback, useState } from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import type { ExportMenuProps } from "./ExportMenu";

let exportMenuModule: Promise<{ default: typeof import("./ExportMenu").ExportMenu }> | null = null;
const loadExportMenu = () => {
  exportMenuModule ??= import("./ExportMenu").then((module) => ({ default: module.ExportMenu }));
  return exportMenuModule;
};
const LazyExportMenu = lazy(loadExportMenu);

/**
 * Keeps image/GIF/video encoders out of the editor's critical chunk. Hover or
 * keyboard focus starts the request; the first click opens the loaded menu.
 */
export function DeferredExportMenu(props: ExportMenuProps) {
  const [requested, setRequested] = useState(false);
  const requestMenu = useCallback(() => setRequested(true), []);

  if (requested) {
    return (
      <Suspense fallback={<ExportLoadingButton />}>
        <LazyExportMenu {...props} initialOpen />
      </Suspense>
    );
  }

  return (
    <button
      type="button"
      onClick={requestMenu}
      onPointerEnter={() => void loadExportMenu()}
      onFocus={() => void loadExportMenu()}
      className="flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors duration-100 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:px-4"
      aria-label="Export"
      aria-expanded="false"
      aria-haspopup="menu"
    >
      <Download size={14} />
      <span className="hidden md:inline">Export</span>
      <ChevronDown size={12} className="text-muted-foreground" />
    </button>
  );
}

function ExportLoadingButton() {
  return (
    <button
      type="button"
      disabled
      aria-label="Loading export tools"
      aria-busy="true"
      className="flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground md:px-4"
    >
      <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />
      <span className="hidden md:inline">Export</span>
    </button>
  );
}
