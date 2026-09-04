"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, FileText, Share2, X } from "lucide-react";
import { documentFileSlug } from "@/editor";

interface PublishPanelProps {
  documentName: string;
  hostedUrl: string;
  hostedUrlAvailable: boolean;
}

/**
 * OSS self-hosted share modal: the local editor can only export files, so the
 * panel is a funnel to DrawCMS Cloud where share links, embeds, and the
 * GitHub/docs snippets live.
 */
export function PublishPanel({ documentName, hostedUrl, hostedUrlAvailable }: PublishPanelProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gifFileName = `${documentFileSlug(documentName)}.gif`;

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as HTMLElement)) setOpen(false);
    };
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKeyboard);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKeyboard);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Share and publish"
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="publish-panel"
        className="flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors duration-100 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Share2 size={15} strokeWidth={1.75} aria-hidden />
        <span className="hidden lg:inline">Share</span>
      </button>

      {open && (
        <div
          id="publish-panel"
          role="dialog"
          aria-label="Share this diagram"
          className="fixed inset-x-2 top-28 z-50 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-xl border border-border bg-card shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[26rem]"
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Sharing is a Cloud feature</p>
              <p className="text-xs text-muted-foreground">
                The self-hosted editor stays local-only; share links come from DrawCMS Cloud.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close share panel"
              className="flex min-h-10 min-w-10 items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <X size={15} aria-hidden />
            </button>
          </header>

          <div className="space-y-4 p-4">
            <section
              aria-labelledby="cloud-share-title"
              className="rounded-lg border border-primary/30 bg-accent p-3"
            >
              <div className="flex items-start gap-2">
                <Share2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div>
                  <h3 id="cloud-share-title" className="text-sm font-semibold text-foreground">
                    Get a view-only share link
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    DrawCMS Cloud adds private view-only links, docs and blog embeds, GitHub README
                    snippets, autosave, and version history on top of this exact editor.
                  </p>
                </div>
              </div>
              {hostedUrlAvailable ? (
                <a
                  href={hostedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors duration-100 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Share with DrawCMS Cloud
                  <ExternalLink size={13} aria-hidden />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <p className="mt-3 rounded-md border border-border bg-card px-3 py-2 text-xs leading-5 text-muted-foreground">
                  Set <code>NEXT_PUBLIC_CLOUD_URL</code> to connect this editor to a hosted DrawCMS
                  instance and enable this CTA.
                </p>
              )}
            </section>

            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Without Cloud
            </p>

            <section
              aria-labelledby="export-local-title"
              className="rounded-lg border border-border p-3"
            >
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div>
                  <h3 id="export-local-title" className="text-sm font-semibold text-foreground">
                    Export and self-host
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    The self-hosted editor can only export files. Use{" "}
                    <span className="font-medium text-foreground">Export → GIF</span> to save{" "}
                    {gifFileName} as an animated recording, then host it yourself. Share links and
                    the embed snippets that wire them up come from DrawCMS Cloud.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
