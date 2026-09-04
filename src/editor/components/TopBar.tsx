"use client";

import { useState, type ReactNode } from "react";
import { type Node } from "@xyflow/react";
import { FileMenu, type EditorMenuAction, type FileMenuImporter } from "./topbar/FileMenu";
import { DeferredExportMenu } from "./topbar/DeferredExportMenu";
import type { VideoFormat } from "../lib/video-export";

interface TopBarProps {
  isAnimating: boolean;
  setIsAnimating: (val: boolean) => void;
  nodes: Node[];
  documentName: string;
  /** True when the canvas differs from the last opened/saved state. */
  dirty: boolean;
  importers: FileMenuImporter[];
  artifactExporters: { id: string; label: string }[];
  onRenameDocument: (name: string) => void;
  onNewDocument: () => void;
  onOpenDrawcms: () => void;
  onSaveDocument: () => void;
  onClearCanvas: () => void;
  onImport: (importer: FileMenuImporter) => void;
  onExportArtifact: (exporterId: string) => void;
  onShowGuide: () => void;
  /** Read-oriented chrome for shared/presentation views (DM-023). */
  presentation?: boolean;
  /** Hosts process exported videos (e.g. managed cloud render jobs, DM-027). */
  onRenderedVideo?: (result: {
    blob: Blob;
    format: VideoFormat;
    durationSeconds: number;
    width: number;
    height: number;
  }) => void;
  /** Navigation supplied by a host without adding another toolbar. */
  leading?: ReactNode;
  /** Persistence state supplied by a host, replacing local dirty state. */
  status?: ReactNode;
  /** Host-specific actions shown before export. */
  actions?: ReactNode;
  /** Hosts can remove export entirely from restricted viewer surfaces. */
  showExport?: boolean;
  /** Cloud mode keeps the File menu but uses SaaS terminology inside it. */
  documentMenuMode?: "local" | "cloud";
  /** Host project and reference actions rendered inside File. */
  menuActions?: EditorMenuAction[];
  /** Host output actions rendered inside Export. */
  exportMenuActions?: EditorMenuAction[];
  /** Optional attribution rendered into visual exports by the host. */
  exportWatermark?: string;
  /** Local hosts can point the File menu at the hosted cloud save experience. */
  cloudSaveHref?: string;
  /** Hosts can reserve SVG and MP4 exports for paid plans. */
  canExportSvg?: boolean;
  canExportMp4?: boolean;
  /** Host billing destination used when paid exports are locked. */
  paidExportUpgradeHref?: string;
  /** Inline badge shown on each locked format (e.g. "Pro", "Cloud"). */
  paidExportBadgeLabel?: string;
  /** Callout copy shown above the upgrade CTA. */
  paidExportUpgradeMessage?: string;
  /** CTA button label when {@link paidExportUpgradeHref} is set. */
  paidExportUpgradeLabel?: string;
  /** Text shown instead of a CTA button when no upgrade destination is configured. */
  paidExportUpgradeFallback?: string;
  /** Dismisses editor-owned transient panels from unused top-bar space. */
  onDismissOverlays?: () => void;
}

export function TopBar({
  isAnimating,
  setIsAnimating,
  nodes,
  documentName,
  dirty,
  importers,
  artifactExporters,
  onRenameDocument,
  onNewDocument,
  onOpenDrawcms,
  onSaveDocument,
  onClearCanvas,
  onImport,
  onExportArtifact,
  onShowGuide,
  presentation = false,
  onRenderedVideo,
  leading,
  status,
  actions,
  showExport = true,
  documentMenuMode = "local",
  menuActions,
  exportMenuActions,
  exportWatermark,
  cloudSaveHref,
  canExportSvg,
  canExportMp4,
  paidExportUpgradeHref,
  paidExportBadgeLabel,
  paidExportUpgradeMessage,
  paidExportUpgradeLabel,
  paidExportUpgradeFallback,
  onDismissOverlays,
}: TopBarProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(documentName);
  const [menuDismissSignal, setMenuDismissSignal] = useState(0);

  const commitName = () => {
    const name = nameDraft.trim();
    setEditingName(false);
    if (name && name !== documentName) onRenameDocument(name);
    else setNameDraft(documentName);
  };

  const dismissTopBarOverlays = () => {
    setMenuDismissSignal((current) => current + 1);
    onDismissOverlays?.();
  };

  const handleTopBarPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [role='menu'], [role='dialog']")) {
      return;
    }
    dismissTopBarOverlays();
  };

  const documentMenu = (
    <FileMenu
      key={`file-menu-${menuDismissSignal}`}
      importers={importers}
      onNew={onNewDocument}
      onOpenDrawcms={onOpenDrawcms}
      onSave={onSaveDocument}
      cloudSaveHref={cloudSaveHref}
      onClear={onClearCanvas}
      onImport={onImport}
      onShowGuide={onShowGuide}
      mode={documentMenuMode}
      actions={menuActions}
    />
  );
  return (
    <header
      className="relative z-40 shrink-0 border-b border-border bg-card"
      onPointerDownCapture={handleTopBarPointerDown}
    >
      <div className="flex min-h-14 flex-wrap items-center gap-x-2 px-2 sm:flex-nowrap sm:px-3 lg:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 py-2 sm:py-0">
          {leading && <div className="flex shrink-0 items-center">{leading}</div>}
          <div className="hidden items-center gap-2 lg:flex">
            <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-md border border-primary/20 bg-accent">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-primary fill-current">
                <path
                  d="M 6 4 L 14 4 C 18.418 4 22 7.582 22 12 C 22 16.418 18.418 20 14 20 L 6 20 L 6 4 Z"
                  opacity="0.5"
                />
                <path d="M 6 4 L 10 4 C 14.418 4 18 7.582 18 12 C 18 16.418 14.418 20 10 20 L 6 20 L 6 4 Z" />
              </svg>
            </div>
            <span className="font-semibold text-lg tracking-tight">
              <span className="text-foreground">Draw</span>
              <span className="font-semibold text-primary">CMS</span>
            </span>
          </div>
          <div className="hidden h-5 w-px bg-muted lg:block" />
          {!presentation && (
            <>
              {documentMenu}
              <div className="hidden h-5 w-px bg-muted sm:block" />
            </>
          )}
          {presentation ? (
            <span className="min-w-0 max-w-56 flex-1 truncate px-2 py-1 text-sm font-medium text-foreground sm:flex-none">
              {documentName}
            </span>
          ) : editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitName();
                if (event.key === "Escape") {
                  setNameDraft(documentName);
                  setEditingName(false);
                }
              }}
              aria-label="Document name"
              className="min-h-10 min-w-0 flex-1 rounded-md border border-primary/30 bg-card px-2 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-56 sm:flex-none"
              maxLength={120}
            />
          ) : (
            <button
              onClick={() => {
                setNameDraft(documentName);
                setEditingName(true);
              }}
              className="min-h-10 min-w-0 flex-1 truncate rounded-md px-2 py-2 text-left text-sm font-medium text-foreground transition-colors duration-100 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-56 sm:flex-none"
              title="Rename document"
            >
              {documentName}
            </button>
          )}
          {!presentation && status ? (
            <div className="shrink-0">{status}</div>
          ) : !presentation ? (
            <span
              role="status"
              className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground md:flex"
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${dirty ? "bg-warning" : "bg-success"}`}
              />
              {dirty ? "Unsaved changes" : "Local save ready"}
            </span>
          ) : null}
        </div>

        <div className="flex w-full shrink-0 items-center justify-end gap-1.5 border-t border-border py-1.5 sm:w-auto sm:border-0 sm:py-0">
          {!presentation && (
            <button
              type="button"
              onClick={() => setIsAnimating(!isAnimating)}
              aria-pressed={isAnimating}
              aria-label={isAnimating ? "Stop all motion" : "Animate all presets"}
              className={`flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:px-4 ${
                isAnimating
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              <span className="hidden md:inline">Animate</span>
              <span
                aria-hidden
                className={`relative h-5 w-9 rounded-full p-0.5 transition-colors duration-100 ${
                  isAnimating ? "bg-primary/30" : "bg-muted"
                }`}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-card transition-transform duration-150 motion-reduce:transition-none ${
                    isAnimating ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
          )}
          {actions && <div className="flex items-center gap-1">{actions}</div>}
          {showExport && (
            <DeferredExportMenu
              key={`export-menu-${menuDismissSignal}`}
              nodes={nodes}
              documentName={documentName}
              isAnimating={isAnimating}
              setIsAnimating={setIsAnimating}
              exporterEntries={artifactExporters}
              onExportArtifact={onExportArtifact}
              hostActions={exportMenuActions}
              onRenderedVideo={onRenderedVideo}
              watermarkText={exportWatermark}
              canExportSvg={canExportSvg}
              canExportMp4={canExportMp4}
              paidExportUpgradeHref={paidExportUpgradeHref}
              paidExportBadgeLabel={paidExportBadgeLabel}
              paidExportUpgradeMessage={paidExportUpgradeMessage}
              paidExportUpgradeLabel={paidExportUpgradeLabel}
              paidExportUpgradeFallback={paidExportUpgradeFallback}
            />
          )}
        </div>
      </div>
    </header>
  );
}
