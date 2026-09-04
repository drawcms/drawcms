"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type Node } from "@xyflow/react";
import { toPng } from "html-to-image";
import { getNodesBounds, getViewportForBounds, type InternalNode } from "@xyflow/react";
import gsap from "gsap";
import {
  downloadDataUrl,
  exportToPng,
  exportToSvg,
  ExportError,
  resolveExportBackground,
} from "../../lib/export";
import { exportToGif } from "../../lib/gif-export";
import { exportVideo, isWebCodecsAvailable, type VideoFormat } from "../../lib/video-export";
import {
  loadExportPreferences,
  saveExportPreferences,
  type ExportPreferences,
} from "../../lib/export-preferences";
import { documentFileSlug } from "../../io/files";
import { useMenuBehavior } from "../../hooks/useMenuBehavior";
import type { EditorMenuAction } from "./FileMenu";
import { addWatermarkToRasterDataUrl } from "../../lib/watermark";
import {
  EXPORT_SIZE_PRESETS,
  getExportSizePreset,
  resolveExportDimensions,
  type ExportSizePresetId,
} from "../../lib/export-size";
import {
  Check,
  ChevronDown,
  Download,
  FileCode,
  Film,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  Maximize2,
  Video,
} from "lucide-react";

export interface ExportMenuProps {
  nodes: Node[];
  documentName: string;
  isAnimating: boolean;
  setIsAnimating: (value: boolean) => void;
  exporterEntries: { id: string; label: string }[];
  onExportArtifact: (exporterId: string) => void;
  /** Host-owned output destinations or history rendered with export formats. */
  hostActions?: EditorMenuAction[];
  /** Hosts can observe an MP4 export after it has been generated locally. */
  onRenderedVideo?: (result: {
    blob: Blob;
    format: VideoFormat;
    durationSeconds: number;
    width: number;
    height: number;
  }) => void;
  watermarkText?: string;
  /** Hosts can reserve the portable vector export for paid plans. */
  canExportSvg?: boolean;
  /** Hosts can reserve the MP4 video export for paid plans. */
  canExportMp4?: boolean;
  /** Destination for the paid-export upgrade CTA when either format is locked. */
  paidExportUpgradeHref?: string;
  /** Inline badge shown on each locked format (e.g. "Pro", "Cloud"). Defaults to "Pro". */
  paidExportBadgeLabel?: string;
  /** Callout copy shown above the upgrade CTA. Defaults to Pro-plan wording. */
  paidExportUpgradeMessage?: string;
  /** CTA button label when {@link paidExportUpgradeHref} is set. Defaults to "Upgrade to Pro". */
  paidExportUpgradeLabel?: string;
  /** Text shown instead of a CTA button when no upgrade destination is configured. */
  paidExportUpgradeFallback?: string;
  /** Opens immediately when mounted by the lightweight deferred trigger. */
  initialOpen?: boolean;
}

/** Static + animated export menu with remembered background preference (DM-018). */
export function ExportMenu({
  nodes,
  documentName,
  isAnimating,
  setIsAnimating,
  exporterEntries,
  onExportArtifact,
  hostActions = [],
  onRenderedVideo,
  watermarkText,
  canExportSvg = true,
  canExportMp4 = true,
  paidExportUpgradeHref,
  paidExportBadgeLabel = "Pro",
  paidExportUpgradeMessage = "SVG and MP4 are Pro exports.",
  paidExportUpgradeLabel = "Upgrade to Pro",
  paidExportUpgradeFallback = "Upgrade your workspace to unlock them.",
  initialOpen = false,
}: ExportMenuProps) {
  const [open, setOpen] = useState(initialOpen);
  const [gifMode, setGifMode] = useState(false);
  const [sizeMode, setSizeMode] = useState(false);
  const [fps, setFps] = useState(10);
  const [gifDuration, setGifDuration] = useState(3);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<ExportPreferences>({
    background: "solid",
    sizePreset: "fit-diagram",
  });
  const closeMenu = useCallback(() => {
    if (exporting) return;
    setOpen(false);
    setGifMode(false);
    setSizeMode(false);
  }, [exporting]);
  const { containerRef, triggerRef } = useMenuBehavior(open, closeMenu);

  useEffect(() => {
    setPreferences(loadExportPreferences());
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as HTMLElement)) {
        closeMenu();
      }
    };
    // Listen in capture so diagram-canvas event handling cannot prevent an
    // outside click from dismissing this transient menu.
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [open, containerRef, closeMenu]);

  const updateBackground = (background: ExportPreferences["background"]) => {
    const next = { ...preferences, background };
    setPreferences(next);
    saveExportPreferences(next); // remembered across sessions (DM-018)
  };

  const updateSizePreset = (sizePreset: ExportSizePresetId) => {
    const next = { ...preferences, sizePreset };
    setPreferences(next);
    saveExportPreferences(next);
  };

  const diagramBounds = useMemo(
    () =>
      nodes.length > 0
        ? getNodesBounds(nodes, {
            nodeLookup: new Map(nodes.map((node) => [node.id, node as InternalNode])),
          })
        : { width: 1, height: 1 },
    [nodes],
  );
  const exportDimensions = useMemo(
    () => resolveExportDimensions(preferences.sizePreset, diagramBounds),
    [preferences.sizePreset, diagramBounds],
  );
  const selectedSizePreset = getExportSizePreset(preferences.sizePreset);
  const sizeSummary = `${exportDimensions.width}×${exportDimensions.height}`;
  const viewportPadding = preferences.sizePreset === "fit-diagram" ? 0.08 : 0.2;

  const baseName = documentFileSlug(documentName);
  const runExport = useCallback(async (work: () => Promise<void>) => {
    setExportError(null);
    setExporting(true);
    try {
      await work();
      setOpen(false);
      setGifMode(false);
    } catch (error) {
      setExportError(
        error instanceof ExportError
          ? error.message
          : `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setExporting(false);
    }
  }, []);

  const handleExportPng = () =>
    void runExport(async () => {
      const dataUrl = await exportToPng(nodes, {
        width: exportDimensions.width,
        height: exportDimensions.height,
        viewportPadding,
        background: preferences.background,
        watermarkText,
      });
      downloadDataUrl(dataUrl, `${baseName}.png`);
    });

  const handleExportSvg = () =>
    void runExport(async () => {
      const dataUrl = await exportToSvg(nodes, {
        width: exportDimensions.width,
        height: exportDimensions.height,
        viewportPadding,
        background: preferences.background,
        watermarkText,
      });
      downloadDataUrl(dataUrl, `${baseName}.svg`);
    });

  const handleExportGif = useCallback(async () => {
    if (nodes.length === 0) return;
    const wasAnimating = isAnimating;
    if (!wasAnimating) setIsAnimating(true);
    await new Promise((resolve) => setTimeout(resolve, 300));

    setExportError(null);
    setExporting(true);
    setProgress(0);
    try {
      const blob = await exportToGif(nodes, {
        width: exportDimensions.width,
        height: exportDimensions.height,
        viewportPadding,
        fps,
        duration: gifDuration,
        onProgress: setProgress,
        watermarkText,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${baseName}.gif`;
      anchor.click();
      URL.revokeObjectURL(url);
      setOpen(false);
      setGifMode(false);
    } catch (error) {
      setExportError(
        `GIF export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setExporting(false);
      if (!wasAnimating) setIsAnimating(false);
    }
  }, [
    nodes,
    fps,
    gifDuration,
    isAnimating,
    setIsAnimating,
    exportDimensions,
    viewportPadding,
    baseName,
    watermarkText,
  ]);

  /** Deterministic video export: frame capture steps through GSAP's global clock. */
  const handleExportVideo = useCallback(
    () =>
      void runExport(async () => {
        if (nodes.length === 0) return;
        const viewport = document.querySelector(".react-flow__viewport") as HTMLElement | null;
        if (!viewport) throw new ExportError("Canvas not found");

        setProgress(0);
        const wasAnimating = isAnimating;
        if (!wasAnimating) setIsAnimating(true);
        await new Promise((resolve) => setTimeout(resolve, 300));
        const gt = gsap.globalTimeline;
        const startTime = gt.time();
        gt.pause();

        try {
          const { width, height } = exportDimensions;
          const bounds = getNodesBounds(nodes, {
            nodeLookup: new Map(nodes.map((node) => [node.id, node as InternalNode])),
          });
          const vp = getViewportForBounds(bounds, width, height, 0.5, 2, viewportPadding);

          const blob = await exportVideo({
            durationSeconds: Math.min(gifDuration, 60),
            width,
            height,
            fps: 30,
            format: "mp4",
            onProgress: setProgress,
            seek: (timeSeconds) => gt.time(startTime + timeSeconds),
            captureFrame: async () => {
              await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
              await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
              const capturedDataUrl = await toPng(viewport, {
                width,
                height,
                pixelRatio: 1,
                backgroundColor: resolveExportBackground({ background: preferences.background }),
                style: {
                  width: `${width}px`,
                  height: `${height}px`,
                  transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
                },
              });
              const dataUrl = await addWatermarkToRasterDataUrl(
                capturedDataUrl,
                width,
                height,
                watermarkText,
              );
              return (await createImageBitmap(await (await fetch(dataUrl)).blob())) as ImageBitmap;
            },
          });

          onRenderedVideo?.({
            blob,
            format: "mp4",
            durationSeconds: gifDuration,
            width,
            height,
          });

          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `${baseName}.mp4`;
          anchor.click();
          URL.revokeObjectURL(url);
        } finally {
          gt.resume();
          if (!wasAnimating) setIsAnimating(false);
        }
      }),
    [
      nodes,
      isAnimating,
      setIsAnimating,
      gifDuration,
      preferences,
      runExport,
      onRenderedVideo,
      baseName,
      watermarkText,
      exportDimensions,
      viewportPadding,
    ],
  );

  const empty = nodes.length === 0;
  const hasLockedPaidExports = !canExportSvg || !canExportMp4;
  // DM-033: past this size client-side frame capture gets memory-heavy enough
  // that the UI should set expectations before starting an in-browser recording.
  const LARGE_EXPORT_NODE_THRESHOLD = 500;
  const largeDocument = nodes.length > LARGE_EXPORT_NODE_THRESHOLD;
  const entryClass =
    "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-accent focus-visible:bg-accent focus-visible:outline-none rounded-lg transition-colors disabled:opacity-40";

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        onClick={() => {
          setOpen(!open);
          setGifMode(false);
          setSizeMode(false);
          setExportError(null);
        }}
        className="flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors duration-100 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:px-4"
        aria-label="Export"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Download size={14} />
        <span className="hidden md:inline">Export</span>
        <ChevronDown
          size={12}
          className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100vh-5rem)] w-72 overflow-y-auto rounded-xl border border-border bg-card shadow-lg"
          role="menu"
          aria-label="Export"
        >
          {!gifMode && !sizeMode ? (
            <div className="p-1.5">
              <button
                type="button"
                onClick={() => setSizeMode(true)}
                disabled={exporting}
                className={entryClass}
                role="menuitem"
                data-menu-item
              >
                <Maximize2 size={16} className="text-primary" aria-hidden />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block font-medium">Export size</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {selectedSizePreset.label} · {sizeSummary}
                  </span>
                </span>
                <ChevronDown size={14} className="-rotate-90 text-muted-foreground" aria-hidden />
              </button>
              <div className="mx-2 my-1.5 border-t border-border" role="separator" />
              <button
                onClick={handleExportPng}
                disabled={exporting || empty}
                className={entryClass}
                role="menuitem"
                data-menu-item
              >
                {exporting ? (
                  <Loader2 size={16} className="text-primary animate-spin" />
                ) : (
                  <ImageIcon size={16} className="text-primary" />
                )}
                <span className="text-left">
                  <span className="block font-medium">Export as PNG</span>
                  <span className="block text-xs text-muted-foreground">
                    Static image · {sizeSummary}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={handleExportSvg}
                disabled={!canExportSvg || exporting || empty}
                aria-describedby={!canExportSvg ? "paid-export-upgrade" : undefined}
                className={entryClass}
                role="menuitem"
                data-menu-item
              >
                <FileCode size={16} className="text-primary" />
                <span className="min-w-0 text-left">
                  <span className="flex items-center gap-1.5 font-medium">
                    Export as SVG
                    {!canExportSvg && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <LockKeyhole size={10} aria-hidden /> {paidExportBadgeLabel}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Vector image · {sizeSummary}
                  </span>
                </span>
              </button>
              <button
                onClick={() => setGifMode(true)}
                disabled={empty}
                className={entryClass}
                role="menuitem"
                data-menu-item
              >
                <Film size={16} className="text-primary" />
                <span className="text-left">
                  <span className="block font-medium">Export as GIF</span>
                  <span className="block text-xs text-muted-foreground">
                    Animated recording · {sizeSummary} · {gifDuration}s
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={handleExportVideo}
                disabled={!canExportMp4 || exporting || empty || !isWebCodecsAvailable()}
                aria-describedby={!canExportMp4 ? "paid-export-upgrade" : undefined}
                className={entryClass}
                role="menuitem"
                data-menu-item
              >
                <Video size={16} className="text-primary" />
                <span className="min-w-0 text-left">
                  <span className="flex items-center gap-1.5 font-medium">
                    Export as MP4
                    {!canExportMp4 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <LockKeyhole size={10} aria-hidden /> {paidExportBadgeLabel}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    H.264 video (browser-dependent support)
                  </span>
                </span>
              </button>
              {hasLockedPaidExports && (
                <div
                  id="paid-export-upgrade"
                  className="mx-1.5 my-1.5 rounded-lg border border-primary/30 bg-accent p-2.5"
                >
                  <p className="text-xs font-medium text-primary">{paidExportUpgradeMessage}</p>
                  {paidExportUpgradeHref ? (
                    <a
                      href={paidExportUpgradeHref}
                      role="menuitem"
                      data-menu-item
                      className="mt-2 flex min-h-10 items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {paidExportUpgradeLabel}
                    </a>
                  ) : (
                    <p className="mt-1 text-xs text-primary">{paidExportUpgradeFallback}</p>
                  )}
                </div>
              )}

              {exporterEntries.length > 0 && (
                <>
                  <div className="mx-2 my-1.5 border-t border-border" role="separator" />
                  <p className="px-3 pb-1 pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Documents
                  </p>
                  {exporterEntries.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => {
                        setOpen(false);
                        onExportArtifact(entry.id);
                      }}
                      disabled={exporting}
                      className={entryClass}
                      role="menuitem"
                      data-menu-item
                    >
                      <Download size={16} className="text-primary" />
                      <span className="text-left">
                        <span className="block font-medium">{entry.label}</span>
                      </span>
                    </button>
                  ))}
                </>
              )}

              {hostActions.length > 0 && (
                <>
                  <div className="mx-2 my-1.5 border-t border-border" role="separator" />
                  <p className="px-3 pb-1 pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Output
                  </p>
                  {hostActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        action.onSelect();
                        queueMicrotask(() => triggerRef.current?.focus());
                      }}
                      disabled={action.disabled}
                      aria-busy={action.busy || undefined}
                      className={entryClass}
                      role="menuitem"
                      data-menu-item
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-primary">
                        {action.icon ?? <Download size={16} aria-hidden />}
                      </span>
                      <span className="min-w-0 text-left">
                        <span className="block font-medium">{action.label}</span>
                        {action.description && (
                          <span className="block text-xs text-muted-foreground">
                            {action.description}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </>
              )}

              <div className="mx-2 my-1.5 border-t border-border" role="separator" />
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-xs text-muted-foreground">Background</span>
                <div className="flex gap-1.5">
                  {(["solid", "transparent"] as const).map((value) => (
                    <button
                      key={value}
                      onClick={() => updateBackground(value)}
                      role="menuitem"
                      data-menu-item
                      className={`min-h-10 px-2 py-2 text-xs rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        preferences.background === value
                          ? "border-primary bg-accent text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {value === "solid" ? "Solid" : "Transparent"}
                    </button>
                  ))}
                </div>
              </div>

              {exportError && (
                <p className="px-3 pb-2 pt-1 text-[12px] text-danger" role="alert">
                  {exportError}
                </p>
              )}
              {largeDocument && !empty && (
                <p className="px-3 pb-2 text-[12px] text-warning">
                  This is a large diagram ({nodes.length} nodes) — animated exports may take a while
                  and use significant memory.
                </p>
              )}
              {empty && (
                <p className="px-3 pb-2 text-[12px] text-muted-foreground">
                  Add a shape to enable exports.
                </p>
              )}
            </div>
          ) : sizeMode ? (
            <div className="space-y-2 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Export size</span>
                <button
                  type="button"
                  onClick={() => setSizeMode(false)}
                  disabled={exporting}
                  data-menu-item
                  className="min-h-10 rounded px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Back
                </button>
              </div>

              <div className="space-y-1" role="group" aria-label="Export size presets">
                {EXPORT_SIZE_PRESETS.map((preset) => {
                  const dimensions = resolveExportDimensions(preset.id, diagramBounds);
                  const selected = preferences.sizePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => updateSizePreset(preset.id)}
                      disabled={exporting}
                      aria-pressed={selected}
                      data-menu-item
                      className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        selected
                          ? "border-primary bg-accent text-primary"
                          : "border-transparent text-foreground hover:border-border hover:bg-muted"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {preset.label}
                          <span className="font-normal tabular-nums text-muted-foreground">
                            {dimensions.width}×{dimensions.height}
                          </span>
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {preset.description}
                        </span>
                      </span>
                      {selected && (
                        <Check size={16} className="shrink-0 text-primary" aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="px-1 text-xs leading-5 text-muted-foreground">
                Applies to images and animation.
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Export GIF</span>
                <button
                  onClick={() => setGifMode(false)}
                  disabled={exporting}
                  data-menu-item
                  className="min-h-10 rounded px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Back
                </button>
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Duration</label>
                <div className="flex gap-1.5">
                  {[2, 3, 5, 8].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGifDuration(value)}
                      disabled={exporting}
                      data-menu-item
                      aria-pressed={gifDuration === value}
                      className={`min-h-10 flex-1 rounded-lg border py-2 text-xs font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        gifDuration === value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {value}s
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Frame Rate</label>
                <div className="flex gap-1.5">
                  {[5, 10, 15, 20].map((value) => (
                    <button
                      key={value}
                      onClick={() => setFps(value)}
                      disabled={exporting}
                      data-menu-item
                      aria-pressed={fps === value}
                      className={`min-h-10 flex-1 py-2 text-xs font-medium rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        fps === value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:border-primary/30"
                      }`}
                    >
                      {value} fps
                    </button>
                  ))}
                </div>
              </div>

              {exporting && (
                <div className="space-y-1.5">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-[width] duration-200"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    Recording frames... {Math.round(progress * 100)}%
                  </p>
                </div>
              )}

              {exportError && (
                <p className="text-[12px] text-danger" role="alert">
                  {exportError}
                </p>
              )}

              <button
                onClick={handleExportGif}
                disabled={exporting}
                data-menu-item
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {exporting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    Export GIF
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
