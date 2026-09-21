"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, LayoutGrid, Search, X } from "lucide-react";
import { DIAGRAM_COLLECTIONS } from "./shapes/catalog";
import { ShapeThumbnail } from "./shapes/ShapeThumbnail";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover";

const LIBRARY_SECTIONS = [
  { title: "Workflows", ids: ["flowchart", "activity", "state", "user-flow", "cicd"] },
  { title: "Planning", ids: ["mind-map", "org-chart", "timeline"] },
  {
    title: "Software & systems",
    ids: [
      "architecture",
      "sequence",
      "erd",
      "class",
      "component",
      "deployment",
      "use-case",
      "data-flow",
      "network",
    ],
  },
];

export function DiagramCollectionPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = DIAGRAM_COLLECTIONS.find((item) => item.id === value);
  const matches = useMemo(
    () =>
      DIAGRAM_COLLECTIONS.filter((item) =>
        [item.title, ...item.keywords].some((text) =>
          text.toLowerCase().includes(query.trim().toLowerCase()),
        ),
      ),
    [query],
  );

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Diagram type: ${selected?.title ?? "All elements"}`}
            className="group flex min-h-14 w-full items-center gap-3 rounded border border-border bg-card px-3 py-2 text-left transition-colors duration-100 hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded bg-accent text-primary"
          aria-hidden="true"
        >
          {selected ? (
            <ShapeThumbnail type={selected.elementIds[0]} size={22} />
          ) : (
            <LayoutGrid size={18} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted-foreground">Diagram library</span>
          <span className="block text-sm font-medium text-foreground">
            {selected?.title ?? "All elements"}
          </span>
        </span>
        <ChevronDown size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        className="flex max-h-[min(36rem,var(--available-height))] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl bg-card p-0"
      >
        <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-3">
          <div>
            <PopoverTitle>Choose a diagram type</PopoverTitle>
            <PopoverDescription className="mt-1">The right elements, together.</PopoverDescription>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close diagram library"
            className="-mr-2 -mt-1 flex size-10 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-3 pb-3">
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              aria-label="Search diagram types"
              placeholder="Find a diagram type…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 w-full rounded border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="custom-scrollbar min-h-0 overflow-y-auto border-t border-border p-2">
          {!query.trim() && (
            <button
              type="button"
              aria-pressed={value === "all"}
              onClick={() => choose("all")}
              className="mb-2 flex min-h-11 w-full items-center gap-3 rounded px-2 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LayoutGrid size={18} className="text-primary" />
              <span className="flex-1 text-left">All elements</span>
              {value === "all" && <Check size={16} className="text-primary" />}
            </button>
          )}
          {LIBRARY_SECTIONS.map((section) => {
            const items = section.ids.flatMap((id) => matches.filter((item) => item.id === id));
            if (!items.length) return null;
            return (
              <section key={section.title} className="mb-2">
                <h3 className="px-2 py-2 text-xs font-medium text-muted-foreground">
                  {section.title}
                </h3>
                <div className="grid grid-cols-2 gap-1">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={value === item.id}
                      aria-label={`Choose ${item.title}`}
                      onClick={() => choose(item.id)}
                      className={`flex min-h-16 items-center gap-2 rounded px-2 py-2 text-left text-xs leading-4 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${value === item.id ? "bg-accent text-primary" : "text-foreground hover:bg-muted"}`}
                    >
                      <span aria-hidden="true" className="shrink-0 text-primary">
                        <ShapeThumbnail type={item.elementIds[0]} size={24} />
                      </span>
                      <span className="flex-1">{item.title}</span>
                      {value === item.id && (
                        <Check size={12} className="shrink-0" aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
          {!matches.length && (
            <div role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">
              <p>No matching diagram types.</p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-2 min-h-10 rounded px-3 text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
