"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, Search, TriangleAlert } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover";
import {
  ICONIFY_API_HOST,
  IconifyError,
  fetchIconArtwork,
  searchIcons,
  type IconSearchResult,
} from "../io/iconify";

export interface AddIconInput {
  icon: string;
  body: string;
  viewBox: string;
  label: string;
}

function iconPreviewUrl(icon: string): string {
  return `${ICONIFY_API_HOST}/${icon}.svg?color=%2366706c`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function IconPickerContent({
  onAddIcon,
  onClose,
}: {
  onAddIcon: (input: AddIconInput) => void;
  onClose: () => void;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IconSearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [errorHint, setErrorHint] = useState("");
  const [addingIcon, setAddingIcon] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestSeq = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const sequence = ++requestSeq.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setStatus("loading");
        try {
          const found = await searchIcons(trimmed, { signal: controller.signal });
          if (requestSeq.current !== sequence) return;
          setResults(found);
          setStatus("ready");
        } catch (error) {
          if (isAbortError(error) || requestSeq.current !== sequence) return;
          setStatus("error");
          setErrorHint(error instanceof IconifyError ? error.recoveryHint : "Try searching again.");
        }
      })();
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, reloadKey]);

  const handlePick = (item: IconSearchResult) => {
    void (async () => {
      setAddingIcon(item.icon);
      try {
        const artwork = await fetchIconArtwork(item.icon);
        onAddIcon({
          icon: item.icon,
          body: artwork.body,
          viewBox: artwork.viewBox,
          label: item.name,
        });
        onClose();
      } catch (error) {
        if (isAbortError(error)) return;
        setStatus("error");
        setErrorHint(error instanceof IconifyError ? error.recoveryHint : "Try another icon.");
      } finally {
        setAddingIcon(null);
      }
    })();
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="px-3 py-2">
        <label htmlFor={searchId} className="sr-only">
          Search icons
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={16}
            aria-hidden="true"
          />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search icons (e.g. home, cloud)"
            className="h-10 w-full rounded-md border border-border bg-muted pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {status === "idle" && (
          <div className="flex min-h-24 flex-col items-center justify-center gap-1 px-2 text-center">
            <p className="text-sm font-medium text-foreground">Open-source icons</p>
            <p className="text-xs text-muted-foreground">
              Search the Iconify library. Icons are stored in your diagram.
            </p>
          </div>
        )}

        {status === "loading" && (
          <div className="flex min-h-24 items-center justify-center gap-2 text-xs text-muted-foreground">
            <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
            Searching…
          </div>
        )}

        {status === "error" && (
          <div className="flex min-h-24 flex-col items-center justify-center gap-2 px-2 text-center">
            <TriangleAlert size={16} className="text-warning" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Icons are unavailable</p>
            <p className="text-xs text-muted-foreground">{errorHint}</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="min-h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Retry
            </button>
          </div>
        )}

        {status === "ready" &&
          (results.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {results.map((item) => (
                <button
                  key={item.icon}
                  type="button"
                  disabled={addingIcon !== null}
                  onClick={() => handlePick(item)}
                  aria-label={`Add ${item.icon} icon`}
                  title={`${item.icon} · ${item.setTitle} (${item.licenseTitle})`}
                  className="relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-center transition-colors duration-100 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-50"
                >
                  <img
                    src={iconPreviewUrl(item.icon)}
                    alt=""
                    width={28}
                    height={28}
                    loading="lazy"
                    draggable={false}
                    className="pointer-events-none object-contain"
                  />
                  <span className="line-clamp-2 w-full text-[10px] leading-tight text-muted-foreground">
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-24 flex-col items-center justify-center gap-1 px-2 text-center">
              <p className="text-sm font-medium text-foreground">No matching icons</p>
              <p className="text-xs text-muted-foreground">Try another word, like “server”.</p>
            </div>
          ))}
      </div>

      <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
        Icons via Iconify API. Each icon&apos;s set and license are shown on hover.
      </div>
    </div>
  );
}

export function IconPicker({ onAddIcon }: { onAddIcon: (input: AddIconInput) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex min-h-10 w-full items-center gap-2 rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Search size={14} aria-hidden="true" />
            Search icons…
          </button>
        }
      />
      <PopoverContent className="flex max-h-[min(30rem,calc(100dvh-1rem))] w-80 max-w-[calc(100vw-4rem)] flex-col overflow-hidden p-0">
        <div className="border-b border-border px-3 py-2.5">
          <PopoverTitle>Icons</PopoverTitle>
          <PopoverDescription className="mt-0.5">
            Search open-source icons. The picked icon is added to the canvas.
          </PopoverDescription>
        </div>
        <IconPickerContent onAddIcon={onAddIcon} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
