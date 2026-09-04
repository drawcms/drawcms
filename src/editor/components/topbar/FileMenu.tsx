"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Download,
  Eraser,
  FilePlus2,
  FolderInput,
  FolderOpen,
  HelpCircle,
  MoreHorizontal,
  Upload,
} from "lucide-react";
import { useMenuBehavior } from "../../hooks/useMenuBehavior";

export interface FileMenuImporter {
  id: string;
  label: string;
  fileExtensions: string[];
}

export interface EditorMenuAction {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** Project creation belongs first; reference/support actions belong last. */
  placement?: "start" | "end";
}

interface FileMenuProps {
  /** Registered importers, excluding the built-in `.drawcms` format. */
  importers: FileMenuImporter[];
  onNew: () => void;
  onOpenDrawcms: () => void;
  onSave: () => void;
  /** Hosts can point the local editor at the hosted cloud save experience. */
  cloudSaveHref?: string;
  onClear: () => void;
  onImport: (importer: FileMenuImporter) => void;
  onShowGuide: () => void;
  /** Cloud hosts use SaaS terminology while local hosts retain file lifecycle actions. */
  mode?: "local" | "cloud";
  /** Host-owned project and reference actions rendered inside the menu. */
  actions?: EditorMenuAction[];
}

/** File lifecycle actions for the top bar (DM-015). */
export function FileMenu({
  importers,
  onNew,
  onOpenDrawcms,
  onSave,
  cloudSaveHref,
  onClear,
  onImport,
  onShowGuide,
  mode = "local",
  actions = [],
}: FileMenuProps) {
  const [open, setOpen] = useState(false);
  const closeMenu = useCallback(() => setOpen(false), []);
  const { containerRef, triggerRef } = useMenuBehavior(open, closeMenu);

  useEffect(() => {
    if (!open) return;
    const handler = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as HTMLElement)) {
        setOpen(false);
      }
    };
    // React Flow consumes some canvas events. Capture before they reach the
    // canvas so this menu still dismisses on every outside click.
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [open, containerRef]);

  const itemClass =
    "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-40";
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  const startActions = actions.filter((action) => action.placement === "start");
  const endActions = actions.filter((action) => action.placement !== "start");

  const renderActions = (entries: EditorMenuAction[]) =>
    entries.map((action) => (
      <button
        key={action.id}
        type="button"
        className={itemClass}
        onClick={() => {
          setOpen(false);
          action.onSelect();
          queueMicrotask(() => triggerRef.current?.focus());
        }}
        disabled={action.disabled}
        aria-busy={action.busy || undefined}
        role="menuitem"
        data-menu-item
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-primary">
          {action.icon ?? <MoreHorizontal size={16} aria-hidden />}
        </span>
        <span className="min-w-0 text-left">
          <span className="block font-medium">{action.label}</span>
          {action.description && (
            <span className="block text-xs text-muted-foreground">{action.description}</span>
          )}
        </span>
      </button>
    ));

  const cloudMode = mode === "cloud";

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors duration-100 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="File"
      >
        File
        <ChevronDown
          size={12}
          className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-2 max-h-[calc(100vh-5rem)] w-72 overflow-y-auto rounded-xl border border-border bg-card shadow-lg"
          role="menu"
          aria-label="File"
        >
          <div className="p-1.5">
            {startActions.length > 0 && (
              <>
                {renderActions(startActions)}
                <div className="mx-2 my-1.5 border-t border-border" role="separator" />
              </>
            )}

            {!cloudMode && (
              <button className={itemClass} onClick={run(onNew)} role="menuitem" data-menu-item>
                <FilePlus2 size={16} className="text-primary" aria-hidden />
                <span className="text-left">
                  <span className="block font-medium">New diagram</span>
                  <span className="block text-xs text-muted-foreground">
                    Start with an empty canvas
                  </span>
                </span>
              </button>
            )}
            <button
              className={itemClass}
              onClick={run(onOpenDrawcms)}
              role="menuitem"
              data-menu-item
            >
              {cloudMode ? (
                <FolderInput size={16} className="text-primary" aria-hidden />
              ) : (
                <FolderOpen size={16} className="text-primary" aria-hidden />
              )}
              <span className="text-left">
                <span className="block font-medium">
                  {cloudMode ? "Import into project…" : "Import file…"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {cloudMode ? "Replace this canvas from a supported file" : "Load a .drawcms file"}
                </span>
              </span>
            </button>
            <button className={itemClass} onClick={run(onSave)} role="menuitem" data-menu-item>
              <Download size={16} className="text-primary" aria-hidden />
              <span className="text-left">
                <span className="block font-medium">
                  {cloudMode ? "Download backup" : "Download file"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Keep a portable .drawcms copy
                </span>
              </span>
            </button>
            {!cloudMode && cloudSaveHref && (
              <div className="mx-1.5 my-1.5 rounded-lg border border-primary/30 bg-accent p-2.5">
                <p className="text-xs font-medium text-primary">
                  Saving to cloud is a Cloud feature.
                </p>
                <a
                  href={cloudSaveHref}
                  target="_blank"
                  rel="noreferrer"
                  role="menuitem"
                  data-menu-item
                  className="mt-2 flex min-h-10 items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Save in DrawCMS Cloud
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            )}

            <button className={itemClass} onClick={run(onClear)} role="menuitem" data-menu-item>
              <Eraser size={16} className="text-destructive" aria-hidden />
              <span className="text-left">
                <span className="block font-medium text-destructive">Clear canvas</span>
                <span className="block text-xs text-muted-foreground">
                  Remove all nodes and connections
                </span>
              </span>
            </button>

            {importers.length > 0 && (
              <>
                <div className="mx-2 my-1.5 border-t border-border" role="separator" />
                <p className="px-3 pb-1 pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Import
                </p>
                {importers.map((importer) => (
                  <button
                    key={importer.id}
                    className={itemClass}
                    onClick={run(() => onImport(importer))}
                    role="menuitem"
                    data-menu-item
                  >
                    <Upload size={16} className="text-primary" aria-hidden />
                    <span className="text-left">
                      <span className="block font-medium">{importer.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {importer.fileExtensions.join(" ")}
                      </span>
                    </span>
                  </button>
                ))}
              </>
            )}

            {endActions.length > 0 && (
              <>
                <div className="mx-2 my-1.5 border-t border-border" role="separator" />
                {renderActions(endActions)}
              </>
            )}
            <div className="mx-2 my-1.5 border-t border-border" role="separator" />
            <button className={itemClass} onClick={run(onShowGuide)} role="menuitem" data-menu-item>
              <HelpCircle size={16} className="text-primary" aria-hidden />
              <span className="text-left">
                <span className="block font-medium">Show guide</span>
                <span className="block text-xs text-muted-foreground">
                  Reopen onboarding and tips
                </span>
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
