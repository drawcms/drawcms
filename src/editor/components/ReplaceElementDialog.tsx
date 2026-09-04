"use client";

import React, { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { SHAPE_CATEGORIES, type ShapeDefinition } from "./shapes/catalog";
import { ShapeThumbnail } from "./shapes/ShapeThumbnail";
import { isSequenceEdgeType } from "../types";

interface ReplaceElementDialogProps {
  currentType: string;
  onChoose: (type: string) => void;
  onOpenChange: (open: boolean) => void;
}

function matchesShape(shape: ShapeDefinition, query: string) {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return true;
  return (
    shape.title.toLowerCase().includes(normalizedQuery) ||
    shape.id.toLowerCase().includes(normalizedQuery) ||
    shape.keywords?.some((keyword) => keyword.toLowerCase().includes(normalizedQuery))
  );
}

/** Searchable element picker for the context-menu "Replace" action. */
export function ReplaceElementDialog({
  currentType,
  onChoose,
  onOpenChange,
}: ReplaceElementDialogProps) {
  const [query, setQuery] = useState("");

  const categories = useMemo(
    () =>
      SHAPE_CATEGORIES.map((category) => ({
        ...category,
        shapes: category.shapes.filter((shape) => !isSequenceEdgeType(shape.id)),
      }))
        .map((category) => ({
          ...category,
          shapes: category.shapes.filter((shape) => matchesShape(shape, query)),
        }))
        .filter((category) => category.shapes.length > 0),
    [query],
  );

  const totalResults = categories.reduce((sum, category) => sum + category.shapes.length, 0);
  const firstResult = categories[0]?.shapes[0];

  const handleSearchKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && firstResult) {
      event.preventDefault();
      onChoose(firstResult.id);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(40rem,calc(100dvh-6rem))] w-[calc(100%_-_2rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-xl bg-card p-0"
      >
        <DialogTitle className="border-b border-border px-4 py-3 text-sm font-semibold">
          Replace element
        </DialogTitle>
        <DialogDescription className="sr-only">
          Search elements and choose one to swap the selected element in place. Its label, colors,
          position, and connections are kept.
        </DialogDescription>

        <div className="border-b border-border px-3 py-2.5">
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={14}
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Search elements"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
              aria-label="Search elements"
              className="min-h-10 w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2" tabIndex={-1}>
          {categories.map((category) => (
            <div key={category.id} className="mb-1">
              <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {category.title}
              </p>
              <div className="grid grid-cols-4 gap-1">
                {category.shapes.map((shape) => {
                  const isCurrent = shape.id === currentType;
                  return (
                    <button
                      key={shape.id}
                      type="button"
                      onClick={() => onChoose(shape.id)}
                      title={shape.title}
                      aria-label={
                        isCurrent
                          ? `${shape.title} (current element)`
                          : `Replace with ${shape.title}`
                      }
                      aria-pressed={isCurrent}
                      className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border p-1.5 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isCurrent
                          ? "border-primary/40 bg-accent"
                          : "border-border/60 bg-card/60 hover:bg-accent hover:border-primary/30"
                      }`}
                    >
                      <ShapeThumbnail type={shape.id} size={28} />
                      <span className="w-full truncate text-center text-[8px] leading-tight text-muted-foreground">
                        {shape.title}
                      </span>
                      {isCurrent && (
                        <Check
                          size={11}
                          aria-hidden="true"
                          className="absolute right-1 top-1 text-primary"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {totalResults === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No elements match “{query.trim()}”
            </p>
          )}
        </div>

        <p className="border-t border-border px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          The element keeps its label, colors, position, and connections. Press Enter to pick the
          first search result.
        </p>
      </DialogContent>
    </Dialog>
  );
}
