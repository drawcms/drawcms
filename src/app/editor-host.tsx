"use client";

import { useEffect, useState } from "react";
import {
  DrawCMSEditor,
  createLocalStorageAdapter,
  useDocumentPersistence,
  type DrawCMSDocument,
} from "@/editor";
import { PublishPanel } from "./publish-panel";
import { ThemeToggle } from "./theme-toggle";

const CONFIGURED_CLOUD_URL = process.env.NEXT_PUBLIC_CLOUD_URL?.replace(/\/$/, "");
const HOSTED_DRAWCMS_URL =
  CONFIGURED_CLOUD_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://127.0.0.1:3000"
    : "https://your-drawcms-host.example");
const HOSTED_DRAWCMS_AVAILABLE = Boolean(
  CONFIGURED_CLOUD_URL || process.env.NODE_ENV === "development",
);

/**
 * OSS self-hosted editor shell: persists the document to browser storage
 * through the editor's public persistence boundary (DM-014). The editor core
 * knows nothing about where the document lives.
 */
export function EditorHost() {
  const [adapter] = useState(() => createLocalStorageAdapter());
  const persistence = useDocumentPersistence(adapter, { debounceMs: 1500 });
  const [loaded, setLoaded] = useState<DrawCMSDocument | null | "loading">("loading");
  const [documentName, setDocumentName] = useState("Untitled diagram");

  useEffect(() => {
    let cancelled = false;
    adapter
      .load()
      .then((document) => {
        if (!cancelled) {
          setLoaded(document);
          setDocumentName(document?.meta.name ?? "Untitled diagram");
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(null); // corrupt/unreadable storage: start empty
      });
    return () => {
      cancelled = true;
    };
  }, [adapter]);

  if (loaded === "loading") {
    return (
      <div className="flex h-full w-full flex-col bg-background" aria-busy="true">
        <div className="h-14 border-b border-border bg-card" />
        <div className="flex min-h-0 flex-1 gap-2 p-2">
          <div className="w-12 animate-pulse rounded-lg border border-border bg-muted motion-reduce:animate-none" />
          <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
            Loading diagram…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      <DrawCMSEditor
        key={loaded ? "restored" : "empty"}
        initialDocument={loaded ?? undefined}
        webMcp
        exportWatermark="Made with DrawCMS"
        cloudSaveHref={HOSTED_DRAWCMS_AVAILABLE ? HOSTED_DRAWCMS_URL : undefined}
        canExportSvg={false}
        canExportMp4={false}
        paidExportUpgradeHref={HOSTED_DRAWCMS_AVAILABLE ? HOSTED_DRAWCMS_URL : undefined}
        paidExportBadgeLabel="Cloud"
        paidExportUpgradeMessage="SVG and MP4 export are available in DrawCMS Cloud."
        paidExportUpgradeLabel="Try DrawCMS Cloud"
        paidExportUpgradeFallback="Set NEXT_PUBLIC_CLOUD_URL to unlock SVG and MP4 export through DrawCMS Cloud."
        topBarStatus={
          <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
            {persistence.status === "saving" && "Saving…"}
            {persistence.status === "saved" && "Saved locally"}
            {persistence.status === "error" && (
              <button
                type="button"
                onClick={() => void persistence.saveNow()}
                className="text-danger underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Save failed — retry
              </button>
            )}
            {persistence.status === "idle" && "Local save ready"}
          </span>
        }
        onDocumentChange={(document) => {
          setDocumentName(document.meta.name);
          persistence.schedule(document);
        }}
        topBarActions={
          <>
            <ThemeToggle hideSystemOnMobile />
            <PublishPanel
              documentName={documentName}
              hostedUrl={HOSTED_DRAWCMS_URL}
              hostedUrlAvailable={HOSTED_DRAWCMS_AVAILABLE}
            />
          </>
        }
      />
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2">
        <span
          role="note"
          aria-label="Made with DrawCMS"
          className="pointer-events-none inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-2 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm"
        >
          <span
            aria-hidden="true"
            className="relative inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-primary/20 bg-accent"
          >
            <svg viewBox="0 0 24 24" className="relative h-3/4 w-3/4 fill-primary">
              <path
                d="M 6 4 L 14 4 C 18.418 4 22 7.582 22 12 C 22 16.418 18.418 20 14 20 L 6 20 L 6 4 Z"
                opacity="0.5"
              />
              <path d="M 6 4 L 10 4 C 14.418 4 18 7.582 18 12 C 18 16.418 14.418 20 10 20 L 6 20 L 6 4 Z" />
            </svg>
          </span>
          <span>
            <span className="text-muted-foreground">Made with </span>
            DrawCMS
          </span>
        </span>
      </div>
    </div>
  );
}
