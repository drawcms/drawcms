"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Shapes,
  PanelLeftClose,
  X,
  MousePointer2,
} from "lucide-react";
import { DiagramCollectionPicker } from "./DiagramCollectionPicker";
import { ShapeThumbnail } from "./shapes/ShapeThumbnail";
import {
  SHAPE_CATEGORIES,
  filterShapeCategories,
  DIAGRAM_COLLECTIONS,
  type ShapeDefinition,
  type ShapeCategory,
} from "./shapes/catalog";
export { SHAPE_CATEGORIES } from "./shapes/catalog";
import { IconPicker, IconPickerContent, type AddIconInput } from "./IconPicker";
import { isSequenceEdgeType } from "../types";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover";
import { DEFAULT_COLLAPSED_CATEGORY_IDS } from "./sidebar-defaults";
import {
  ELEMENT_CATEGORY_SHORTCUT_COUNT,
  isTypingTarget,
  SHORTCUTS,
  shortcutHint,
} from "../shortcuts";

export { DEFAULT_COLLAPSED_CATEGORY_IDS } from "./sidebar-defaults";

interface SidebarLeftProps {
  onAddNode: (type: string, title: string) => void;
  onAddIcon?: (input: AddIconInput) => void;
  onCollapse?: () => void;
}

interface CollapsedElementsRailProps {
  onAddNode: (type: string, title: string) => void;
  onAddIcon?: (input: AddIconInput) => void;
  onExpand: () => void;
  /** Increments when the canvas dismisses transient editor overlays. */
  dismissSignal?: number;
  selectedShapeIds?: Record<string, string>;
  onSelectedShapeChange?: (categoryId: string, shapeId: string) => void;
  visibleCategoryIds?: string[];
  onVisibleCategoryIdsChange?: (categoryIds: string[]) => void;
}

const NOOP_ADD_ICON: (input: AddIconInput) => void = () => {};

function setShapeDragData(event: React.DragEvent, shape: ShapeDefinition) {
  event.dataTransfer.setData(
    "application/drawcms-shape",
    JSON.stringify({ type: shape.id, title: shape.defaultLabel ?? shape.title }),
  );
  event.dataTransfer.effectAllowed = "move";
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

function ShapeButton({
  shapeId,
  title,
  defaultLabel,
  onClick,
}: {
  shapeId: string;
  title: string;
  defaultLabel?: string;
  onClick: () => void;
}) {
  const isEdgeTool = isSequenceEdgeType(shapeId);
  const onDragStart = (e: React.DragEvent) => {
    setShapeDragData(e, { id: shapeId, title, defaultLabel });
  };

  return (
    <button
      type="button"
      draggable={!isEdgeTool}
      onDragStart={isEdgeTool ? undefined : onDragStart}
      onClick={onClick}
      title={title}
      aria-label={`${isEdgeTool ? "Connect" : "Add"} ${title} ${isEdgeTool ? "between participants" : "to canvas"}`}
      className={`group flex min-h-20 min-w-0 flex-col items-center justify-start gap-1.5 rounded-lg border border-transparent px-1 py-1.5 text-foreground
        hover:bg-accent hover:border-primary/20 ${isEdgeTool ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        transition-colors duration-100 motion-reduce:transition-none`}
    >
      <span
        aria-hidden="true"
        className="flex h-7 w-full items-center justify-center text-muted-foreground transition-colors duration-100 group-hover:text-primary group-focus-visible:text-primary motion-reduce:transition-none"
      >
        <ShapeThumbnail type={shapeId} size={24} />
      </span>
      <span className="w-full break-words text-center text-xs leading-4">{title}</span>
    </button>
  );
}

function IconGroupTool({
  onAddIcon,
  shortcutDigit,
}: {
  onAddIcon: (input: AddIconInput) => void;
  shortcutDigit?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-primary data-popup-open:bg-accent data-popup-open:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={
              shortcutDigit
                ? `Icons: search the Iconify library (${shortcutDigit})`
                : "Icons: search the Iconify library"
            }
            aria-label="Search icons"
            aria-keyshortcuts={shortcutDigit ? String(shortcutDigit) : undefined}
            data-element-group="icons"
          />
        }
      >
        <ShapeThumbnail type="icon" size={24} />
        {shortcutDigit && <RailShortcutBadge digit={shortcutDigit} />}
        <span
          aria-hidden="true"
          className="absolute bottom-0.5 right-0.5 h-0 w-0 border-b-[3px] border-l-[3px] border-b-muted-foreground border-l-transparent"
        />
      </PopoverTrigger>

      <PopoverContent className="flex max-h-[min(30rem,calc(100dvh-1rem))] w-80 max-w-[calc(100vw-4rem)] flex-col overflow-hidden p-0">
        <div className="border-b border-border px-3 py-2.5">
          <PopoverTitle>Icons</PopoverTitle>
          <PopoverDescription className="mt-0.5">
            Search open-source icons and add one to the canvas.
          </PopoverDescription>
        </div>
        <IconPickerContent onAddIcon={onAddIcon} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Excalidraw-style corner digit marking the key that opens a rail group.
 * `aria-hidden` because the accessible name already carries the group and the
 * binding is announced through `aria-keyshortcuts` on the button itself.
 */
function RailShortcutBadge({ digit }: { digit: number }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-0.5 top-0.5 text-[8px] font-semibold leading-none text-muted-foreground/70"
    >
      {digit}
    </span>
  );
}

/**
 * Arrow-key navigation for a flyout's shape grid. The tiles are a plain
 * four-column grid of buttons, so Tab alone would walk them one at a time; this
 * makes Up/Down move a whole row the way a grid is expected to behave.
 */
function handleShapeGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>, columns: number) {
  const keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const tiles = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
  if (tiles.length === 0) return;
  const current = tiles.indexOf(document.activeElement as HTMLButtonElement);
  const step =
    event.key === "ArrowRight"
      ? 1
      : event.key === "ArrowLeft"
        ? -1
        : event.key === "ArrowDown"
          ? columns
          : event.key === "ArrowUp"
            ? -columns
            : 0;
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tiles.length - 1
        : current < 0
          ? 0
          : Math.min(tiles.length - 1, Math.max(0, current + step));
  event.preventDefault();
  tiles[next]?.focus();
}

function ElementGroupTool({
  category,
  onAddNode,
  onAddIcon,
  selectedShapeId,
  onSelectedShapeChange,
  shortcutDigit,
}: {
  category: ShapeCategory;
  onAddNode: (type: string, title: string) => void;
  onAddIcon: (input: AddIconInput) => void;
  selectedShapeId: string | undefined;
  onSelectedShapeChange: (categoryId: string, shapeId: string) => void;
  /** Digit key that opens this group, or undefined past the ninth rail slot. */
  shortcutDigit?: number;
}) {
  const searchId = useId();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const representativeShape =
    category.shapes.find((shape) => shape.id === category.representativeShapeId) ??
    category.shapes[0];
  const visibleShapes = useMemo(
    () => category.shapes.filter((shape) => matchesShape(shape, searchQuery)),
    [category.shapes, searchQuery],
  );

  if (category.id === "icons") {
    return <IconGroupTool onAddIcon={onAddIcon} shortcutDigit={shortcutDigit} />;
  }

  const selectedShape =
    category.shapes.find((shape) => shape.id === selectedShapeId) ?? representativeShape;
  if (!selectedShape) return null;
  const selectedIsEdgeTool = isSequenceEdgeType(selectedShape.id);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSearchQuery("");
  };

  const handleChooseShape = (shape: ShapeDefinition) => {
    onSelectedShapeChange(category.id, shape.id);
    onAddNode(shape.id, shape.defaultLabel ?? shape.title);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            draggable={!selectedIsEdgeTool}
            onDragStart={
              selectedIsEdgeTool ? undefined : (event) => setShapeDragData(event, selectedShape)
            }
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-primary data-popup-open:bg-accent data-popup-open:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={
              shortcutDigit
                ? `${category.title}: ${selectedShape.title} (${shortcutDigit})`
                : `${category.title}: ${selectedShape.title}`
            }
            aria-label={`${category.title} elements, ${selectedShape.title} selected`}
            aria-keyshortcuts={shortcutDigit ? String(shortcutDigit) : undefined}
            data-element-group={category.id}
          />
        }
      >
        <ShapeThumbnail type={selectedShape.id} size={24} />
        {shortcutDigit && <RailShortcutBadge digit={shortcutDigit} />}
        <span
          aria-hidden="true"
          className="absolute bottom-0.5 right-0.5 h-0 w-0 border-b-[3px] border-l-[3px] border-b-muted-foreground border-l-transparent"
        />
      </PopoverTrigger>

      <PopoverContent className="flex max-h-[min(30rem,calc(100dvh-1rem))] w-80 max-w-[calc(100vw-4rem)] flex-col overflow-hidden p-0">
        <div className="border-b border-border px-3 py-2.5">
          <PopoverTitle>{category.title} elements</PopoverTitle>
          <PopoverDescription className="sr-only">
            Choose an element to add or connect. Your choice becomes this group&apos;s rail tool.
          </PopoverDescription>
        </div>

        <div className="px-3 py-2">
          <label htmlFor={searchId} className="sr-only">
            Search {category.title} elements
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
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={`Search ${category.title}`}
              className="h-10 w-full rounded-md border border-border bg-muted pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
        </div>

        <div className="custom-scrollbar min-h-0 overflow-y-auto px-3 pb-3">
          {visibleShapes.length > 0 ? (
            <div
              className="grid grid-cols-3 gap-2"
              onKeyDown={(event) => handleShapeGridKeyDown(event, 3)}
            >
              {visibleShapes.map((shape) => {
                const selected = shape.id === selectedShape.id;
                const isEdgeTool = isSequenceEdgeType(shape.id);
                return (
                  <button
                    key={shape.id}
                    type="button"
                    onClick={() => handleChooseShape(shape)}
                    aria-label={`${isEdgeTool ? "Connect" : "Add"} ${shape.title} ${isEdgeTool ? "between participants" : "to canvas"}`}
                    aria-pressed={selected}
                    className={`relative flex min-h-24 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-center transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selected ? "bg-accent text-primary" : "text-foreground hover:bg-accent"
                    }`}
                  >
                    {selected && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check size={10} strokeWidth={2.5} aria-hidden="true" />
                      </span>
                    )}
                    <ShapeThumbnail type={shape.id} size={28} />
                    <span className="line-clamp-2 w-full text-xs leading-tight">{shape.title}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-24 flex-col items-center justify-center gap-1 text-center">
              <p className="text-sm font-medium text-foreground">No matching elements</p>
              <p className="text-xs text-muted-foreground">Try another name or keyword.</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ElementGroupPicker({
  visibleCategoryIds,
  onToggleCategory,
}: {
  visibleCategoryIds: string[];
  onToggleCategory: (categoryId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-primary data-popup-open:bg-accent data-popup-open:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Choose element groups"
            aria-label="Choose element groups"
          />
        }
      >
        <Plus size={20} aria-hidden="true" />
      </PopoverTrigger>

      <PopoverContent className="flex max-h-[min(32rem,calc(100dvh-1rem))] w-72 max-w-[calc(100vw-4rem)] flex-col overflow-hidden p-0">
        <div className="border-b border-border px-3 py-2.5">
          <PopoverTitle>Choose element groups</PopoverTitle>
          <PopoverDescription className="mt-0.5 text-muted-foreground">
            Basic stays on the rail. Select any other groups you use often.
          </PopoverDescription>
        </div>

        <div className="custom-scrollbar min-h-0 overflow-y-auto p-2">
          <div className="grid grid-cols-2 gap-1.5">
            {SHAPE_CATEGORIES.map((category) => {
              const visible = visibleCategoryIds.includes(category.id);
              const locked = category.id === "general";
              const representativeShape =
                category.shapes.find((shape) => shape.id === category.representativeShapeId) ??
                category.shapes[0];
              if (!representativeShape && category.id !== "icons") return null;

              return (
                <button
                  key={category.id}
                  type="button"
                  disabled={locked}
                  aria-pressed={visible}
                  aria-label={
                    locked
                      ? `${category.title} group, always shown`
                      : `${category.title} group, ${visible ? "shown" : "hidden"}`
                  }
                  onClick={() => onToggleCategory(category.id)}
                  className={`relative flex min-h-12 min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-70 ${
                    visible ? "bg-accent text-primary" : "text-foreground hover:bg-accent"
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                    <ShapeThumbnail type={representativeShape?.id ?? "icon"} size={22} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{category.title}</span>
                  {visible && (
                    <Check
                      size={14}
                      strokeWidth={2.5}
                      className="shrink-0 text-primary"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CollapsedElementsRail({
  onAddNode,
  onAddIcon = NOOP_ADD_ICON,
  onExpand,
  dismissSignal,
  selectedShapeIds,
  onSelectedShapeChange,
  visibleCategoryIds,
  onVisibleCategoryIdsChange,
}: CollapsedElementsRailProps) {
  const [internalSelectedShapeIds, setInternalSelectedShapeIds] = useState<Record<string, string>>(
    {},
  );
  const [internalVisibleCategoryIds, setInternalVisibleCategoryIds] = useState<string[]>(
    DEFAULT_COLLAPSED_CATEGORY_IDS,
  );
  const activeSelectedShapeIds = selectedShapeIds ?? internalSelectedShapeIds;
  const requestedVisibleCategoryIds = visibleCategoryIds ?? internalVisibleCategoryIds;
  const activeVisibleCategoryIds = [
    "general",
    ...requestedVisibleCategoryIds.filter(
      (categoryId, index) =>
        categoryId !== "general" &&
        requestedVisibleCategoryIds.indexOf(categoryId) === index &&
        SHAPE_CATEGORIES.some((category) => category.id === categoryId),
    ),
  ];
  const handleSelectedShapeChange = (categoryId: string, shapeId: string) => {
    if (onSelectedShapeChange) {
      onSelectedShapeChange(categoryId, shapeId);
      return;
    }
    setInternalSelectedShapeIds((current) => ({ ...current, [categoryId]: shapeId }));
  };
  const handleToggleCategory = (categoryId: string) => {
    if (categoryId === "general") return;
    const nextVisibleCategoryIds = activeVisibleCategoryIds.includes(categoryId)
      ? activeVisibleCategoryIds.filter((currentCategoryId) => currentCategoryId !== categoryId)
      : [...activeVisibleCategoryIds, categoryId];
    if (onVisibleCategoryIdsChange) {
      onVisibleCategoryIdsChange(nextVisibleCategoryIds);
      return;
    }
    setInternalVisibleCategoryIds(nextVisibleCategoryIds);
  };

  /**
   * Digits `1`–`8` open the matching rail group, the way Excalidraw binds its
   * tools. This clicks the group's own trigger rather than lifting each flyout's
   * open state, so the icon picker and the shape flyouts — two different popover
   * components — both respond, and each keeps managing its own focus trap.
   */
  const railRef = useRef<HTMLElement>(null);
  const visibleCount = activeVisibleCategoryIds.length;
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isTypingTarget(event) || event.metaKey || event.ctrlKey || event.altKey) return;
      const digit = Number(event.key);
      if (!Number.isInteger(digit) || digit < 1) return;
      if (digit > Math.min(visibleCount, ELEMENT_CATEGORY_SHORTCUT_COUNT)) return;
      const categoryId = activeVisibleCategoryIds[digit - 1];
      const trigger = railRef.current?.querySelector<HTMLButtonElement>(
        `[data-element-group="${categoryId}"]`,
      );
      if (!trigger) return;
      event.preventDefault();
      trigger.focus();
      trigger.click();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // `activeVisibleCategoryIds` is rebuilt every render; its length and contents
    // only change when the visible groups do, which `visibleCount` and the joined
    // ids capture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCount, activeVisibleCategoryIds.join(",")]);

  return (
    <div className="dm-elements-panel dm-panel-enter relative flex h-fit max-h-full w-full">
      <aside
        ref={railRef}
        aria-label="Element tools"
        className="flex h-fit max-h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card"
      >
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-[3px] py-1">
          {activeVisibleCategoryIds.map((categoryId, index) => {
            const category = SHAPE_CATEGORIES.find((candidate) => candidate.id === categoryId);
            if (!category) return null;
            const digit = index + 1;
            return (
              <ElementGroupTool
                key={`${category.id}-${dismissSignal}`}
                category={category}
                onAddNode={onAddNode}
                onAddIcon={onAddIcon}
                selectedShapeId={activeSelectedShapeIds[category.id]}
                onSelectedShapeChange={handleSelectedShapeChange}
                shortcutDigit={digit <= ELEMENT_CATEGORY_SHORTCUT_COUNT ? digit : undefined}
              />
            );
          })}
          <div className="mt-0.5 border-t border-border pt-1">
            <ElementGroupPicker
              key={`group-picker-${dismissSignal}`}
              visibleCategoryIds={activeVisibleCategoryIds}
              onToggleCategory={handleToggleCategory}
            />
          </div>
        </div>
      </aside>
      <button
        type="button"
        onClick={onExpand}
        className="absolute -right-5 top-1/2 -z-10 flex h-12 w-10 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-border bg-card pl-[20px] text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-primary data-popup-open:bg-accent data-popup-open:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        title={`Expand elements panel (${shortcutHint("toggleElementsPanel")})`}
        aria-label="Expand elements panel"
        aria-keyshortcuts={SHORTCUTS.toggleElementsPanel.label}
      >
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export function SidebarLeft({
  onAddNode,
  onAddIcon = NOOP_ADD_ICON,
  onCollapse,
}: SidebarLeftProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ general: true });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionId, setCollectionId] = useState("all");
  const filterId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const collection = DIAGRAM_COLLECTIONS.find((item) => item.id === collectionId);
  const filteredCategories = useMemo(
    () => filterShapeCategories(searchQuery, collectionId),
    [searchQuery, collectionId],
  );
  const isFiltered = searchQuery.trim().length > 0 || collectionId !== "all";
  const resultCount = filteredCategories.reduce(
    (total, category) => total + category.shapes.length,
    0,
  );
  const clearSearch = () => {
    setSearchQuery("");
    searchRef.current?.focus();
  };

  return (
    <div className="dm-elements-panel dm-panel-enter relative h-full w-full">
      <aside
        aria-label="Element library"
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
      >
        <div className="flex shrink-0 items-center gap-2 px-4 pb-3 pt-4">
          <span className="flex size-8 items-center justify-center rounded bg-accent text-primary">
            <Shapes size={18} aria-hidden="true" />
          </span>
          <h2 className="flex-1 text-sm font-semibold tracking-tight text-foreground">Elements</h2>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              title={`Hide elements panel (${shortcutHint("toggleElementsPanel")})`}
              aria-label="Hide elements panel"
              aria-keyshortcuts={SHORTCUTS.toggleElementsPanel.label}
              className="-mr-2 flex size-10 items-center justify-center rounded text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PanelLeftClose size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="shrink-0 space-y-3 border-b border-border px-3 pb-3">
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={searchRef}
              type="text"
              aria-label="Search elements"
              placeholder={collection ? "Search this library…" : "Search all elements…"}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  clearSearch();
                }
              }}
              className="h-11 w-full rounded border border-border bg-background pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear element search"
                className="absolute right-0.5 top-0.5 flex size-10 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          <DiagramCollectionPicker
            value={collectionId}
            onChange={(id) => {
              setCollectionId(id);
              setSearchQuery("");
            }}
          />
          {collection && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                {collection.elementIds.length} elements in this library
              </span>
              <button
                type="button"
                onClick={() => {
                  setCollectionId("all");
                  setSearchQuery("");
                }}
                className="min-h-10 rounded px-2 font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                View all
              </button>
            </div>
          )}
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
          {collection && !searchQuery && (
            <p className="px-2 pb-1 pt-3 text-xs leading-5 text-muted-foreground">
              {collection.hint}
            </p>
          )}
          {searchQuery.trim() && (
            <p role="status" className="px-2 pt-3 text-xs text-muted-foreground">
              {resultCount} {resultCount === 1 ? "element" : "elements"} found
            </p>
          )}
          {filteredCategories.map((category) => {
            const open = isFiltered || !!openSections[category.id];
            const showAll = isFiltered || expandedGroups[category.id];
            const shapes = showAll ? category.shapes : category.shapes.slice(0, 9);
            return (
              <section key={category.id} className="border-b border-border/60 last:border-b-0">
                {isFiltered ? (
                  <h3 className="px-2 pb-1 pt-4 text-xs font-semibold text-foreground">
                    {collection ? "Elements" : category.title}
                  </h3>
                ) : (
                  <button
                    type="button"
                    aria-label={category.title}
                    aria-expanded={open}
                    aria-controls={`${filterId}-${category.id}`}
                    onClick={() =>
                      setOpenSections((current) => ({
                        ...current,
                        [category.id]: !current[category.id],
                      }))
                    }
                    className="flex min-h-12 w-full items-center gap-2 rounded px-2 py-2 text-left text-xs font-medium text-foreground transition-colors duration-100 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span
                      aria-hidden="true"
                      className={open ? "text-primary" : "text-muted-foreground"}
                    >
                      <ShapeThumbnail type={category.representativeShapeId} size={18} />
                    </span>
                    <span className="flex-1">{category.title}</span>
                    <span aria-hidden="true" className="text-xs tabular-nums text-muted-foreground">
                      {category.shapes.length || ""}
                    </span>
                    <ChevronDown
                      size={14}
                      aria-hidden="true"
                      className={`shrink-0 text-muted-foreground transition-transform duration-100 motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}
                    />
                  </button>
                )}
                <div id={`${filterId}-${category.id}`} hidden={!open}>
                  {open &&
                    (category.id === "icons" ? (
                      <div className="px-2 pb-3">
                        <IconPicker onAddIcon={onAddIcon} />
                      </div>
                    ) : (
                      <>
                        <div
                          className="grid grid-cols-3 gap-1 pb-2"
                          onKeyDown={(event) => handleShapeGridKeyDown(event, 3)}
                        >
                          {shapes.map((shape) => (
                            <ShapeButton
                              key={shape.id}
                              shapeId={shape.id}
                              title={shape.title}
                              defaultLabel={shape.defaultLabel}
                              onClick={() => onAddNode(shape.id, shape.defaultLabel ?? shape.title)}
                            />
                          ))}
                        </div>
                        {!isFiltered && category.shapes.length > 9 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedGroups((current) => ({
                                ...current,
                                [category.id]: !current[category.id],
                              }))
                            }
                            className="mb-2 flex min-h-10 w-full items-center justify-center gap-1 rounded text-xs font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {showAll ? "Show fewer" : `Show ${category.shapes.length - 9} more`}
                            <ChevronDown
                              size={14}
                              aria-hidden="true"
                              className={showAll ? "rotate-180" : ""}
                            />
                          </button>
                        )}
                      </>
                    ))}
                </div>
              </section>
            );
          })}
          {filteredCategories.length === 0 && (
            <div className="px-3 py-8 text-center">
              <Search size={24} aria-hidden="true" className="mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                No matching elements{collection ? ` in ${collection.title}` : ""}.
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Try another name or browse all libraries.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCollectionId("all");
                  clearSearch();
                }}
                className="mt-3 min-h-10 rounded bg-accent px-3 text-xs font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Show all elements
              </button>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 border-t border-border bg-background px-4 py-3 text-xs text-muted-foreground">
          <MousePointer2 size={14} aria-hidden="true" />
          <span>Click to add · Drag to place</span>
        </div>
      </aside>
    </div>
  );
}
