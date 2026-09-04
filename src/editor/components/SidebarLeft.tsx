"use client";

import React, { useId, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { ShapeThumbnail } from "./shapes/ShapeThumbnail";
import { AWS_ICONS, GCP_ICONS, AZURE_ICONS, INFRA_ICONS } from "./shapes/cloud-icons";
import { SEMANTIC_ELEMENT_GROUPS } from "./shapes/semantic-elements";
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

export { DEFAULT_COLLAPSED_CATEGORY_IDS } from "./sidebar-defaults";

interface ShapeDefinition {
  id: string;
  title: string;
  defaultLabel?: string;
  keywords?: string[];
}

interface ShapeCategory {
  id: string;
  title: string;
  representativeShapeId: string;
  shapes: ShapeDefinition[];
}

export const SHAPE_CATEGORIES: ShapeCategory[] = [
  {
    id: "general",
    title: "Basic",
    representativeShapeId: "star",
    shapes: [
      { id: "rect", title: "Rectangle", keywords: ["square", "box"] },
      { id: "round-rect", title: "Rounded Rect", keywords: ["rounded", "pill"] },
      { id: "circle", title: "Circle", keywords: ["ellipse", "oval"] },
      { id: "triangle", title: "Triangle" },
      { id: "diamond", title: "Diamond", keywords: ["rhombus"] },
      { id: "pentagon", title: "Pentagon" },
      { id: "hexagon", title: "Hexagon" },
      { id: "octagon", title: "Octagon" },
      { id: "parallelogram", title: "Parallelogram" },
      { id: "trapezoid", title: "Trapezoid" },
      { id: "cylinder", title: "Cylinder", keywords: ["db"] },
      { id: "cloud", title: "Cloud" },
      { id: "star", title: "Star" },
      { id: "cross", title: "Cross", keywords: ["plus"] },
      { id: "callout", title: "Callout", keywords: ["speech", "bubble"] },
      { id: "note", title: "Note", keywords: ["sticky"] },
      { id: "card", title: "Card" },
      { id: "tape", title: "Tape" },
      { id: "step", title: "Step", keywords: ["chevron", "ribbon"] },
      { id: "banner", title: "Banner", keywords: ["flag"] },
      {
        id: "text",
        title: "Text",
        defaultLabel: "",
        keywords: ["label", "annotation", "heading", "caption"],
      },
      { id: "image", title: "Image", keywords: ["photo", "picture"] },
      { id: "table", title: "Table", keywords: ["db", "entity", "model", "schema"] },
    ],
  },
  {
    id: "arrows",
    title: "Arrows",
    representativeShapeId: "arrow-right",
    shapes: [
      { id: "arrow-right", title: "Right Arrow", keywords: ["east"] },
      { id: "arrow-left", title: "Left Arrow", keywords: ["west"] },
      { id: "arrow-up", title: "Up Arrow", keywords: ["north"] },
      { id: "arrow-down", title: "Down Arrow", keywords: ["south"] },
      { id: "arrow-double-h", title: "Double H", keywords: ["horizontal", "bidirectional"] },
      { id: "arrow-double-v", title: "Double V", keywords: ["vertical", "bidirectional"] },
      { id: "chevron", title: "Chevron" },
      { id: "notched-arrow", title: "Notched Arrow" },
    ],
  },
  ...SEMANTIC_ELEMENT_GROUPS,
  {
    id: "icons",
    title: "Icons",
    representativeShapeId: "icon",
    shapes: [],
  },
  {
    id: "flowchart",
    title: "Flowchart",
    representativeShapeId: "decision",
    shapes: [
      { id: "process", title: "Process", keywords: ["step"] },
      { id: "decision", title: "Decision", keywords: ["if", "branch"] },
      { id: "terminator", title: "Terminator", keywords: ["start", "end"] },
      { id: "document", title: "Document", keywords: ["page"] },
      { id: "data", title: "Data (I/O)", keywords: ["input", "output"] },
      { id: "database", title: "Database", keywords: ["db", "storage"] },
      { id: "predefined", title: "Predefined", keywords: ["subroutine"] },
      { id: "internal-storage", title: "Int. Storage" },
      { id: "delay", title: "Delay", keywords: ["wait"] },
      { id: "manual-input", title: "Manual Input" },
      { id: "manual-operation", title: "Manual Op" },
      { id: "display", title: "Display", keywords: ["screen"] },
      { id: "preparation", title: "Preparation", keywords: ["prep"] },
      { id: "loop-limit", title: "Loop Limit" },
    ],
  },
  {
    id: "uml",
    title: "UML",
    representativeShapeId: "actor",
    shapes: [
      { id: "actor", title: "Actor", keywords: ["user", "person", "stick"] },
      { id: "use-case", title: "Use Case", keywords: ["ellipse"] },
      { id: "uml-class", title: "Class", keywords: ["attributes", "methods"] },
      { id: "uml-component", title: "Component" },
      { id: "uml-interface", title: "Interface", keywords: ["lollipop"] },
      { id: "uml-package", title: "Package", keywords: ["module"] },
      { id: "uml-state", title: "State", keywords: ["state machine"] },
      { id: "uml-object", title: "Object", keywords: ["instance"] },
      { id: "uml-note", title: "Note", keywords: ["comment"] },
      { id: "uml-artifact", title: "Artifact", keywords: ["file"] },
    ],
  },
  {
    id: "bpmn",
    title: "BPMN",
    representativeShapeId: "bpmn-gateway-parallel",
    shapes: [
      { id: "bpmn-start", title: "Start Event", keywords: ["begin"] },
      { id: "bpmn-end", title: "End Event", keywords: ["finish"] },
      { id: "bpmn-intermediate", title: "Intermediate", keywords: ["event"] },
      { id: "bpmn-task", title: "Task", keywords: ["activity", "step"] },
      { id: "bpmn-gateway-exclusive", title: "Exclusive GW", keywords: ["xor", "decision"] },
      { id: "bpmn-gateway-parallel", title: "Parallel GW", keywords: ["and", "fork"] },
      { id: "bpmn-gateway-inclusive", title: "Inclusive GW", keywords: ["or"] },
      { id: "bpmn-pool", title: "Pool", keywords: ["lane", "swimlane"] },
    ],
  },
  {
    id: "er",
    title: "Entity Relationship",
    representativeShapeId: "er-multivalued",
    shapes: [
      { id: "er-entity", title: "Entity", keywords: ["table"] },
      { id: "er-weak-entity", title: "Weak Entity" },
      { id: "er-relationship", title: "Relationship" },
      { id: "er-weak-relationship", title: "Weak Relation" },
      { id: "er-attribute", title: "Attribute" },
      { id: "er-key-attribute", title: "Key Attribute", keywords: ["primary"] },
      { id: "er-multivalued", title: "Multi-Valued" },
      { id: "er-derived", title: "Derived", keywords: ["computed"] },
    ],
  },
  {
    id: "containers",
    title: "Containers",
    representativeShapeId: "folder",
    shapes: [
      { id: "group", title: "Group", keywords: ["container"] },
      { id: "folder", title: "Folder", keywords: ["tab", "package"] },
      { id: "swimlane-h", title: "H. Swimlane", keywords: ["horizontal"] },
      { id: "swimlane-v", title: "V. Swimlane", keywords: ["vertical"] },
      { id: "dashed-box", title: "Boundary", keywords: ["dashed"] },
    ],
  },
  {
    id: "aws",
    title: "AWS",
    representativeShapeId: "aws-ec2",
    shapes: AWS_ICONS.map((i) => ({ id: i.id, title: i.title, keywords: i.keywords })),
  },
  {
    id: "gcp",
    title: "GCP",
    representativeShapeId: "gcp-compute-engine",
    shapes: GCP_ICONS.map((i) => ({ id: i.id, title: i.title, keywords: i.keywords })),
  },
  {
    id: "azure",
    title: "Azure",
    representativeShapeId: "azure-vm",
    shapes: AZURE_ICONS.map((i) => ({ id: i.id, title: i.title, keywords: i.keywords })),
  },
  {
    id: "infra",
    title: "Infrastructure",
    representativeShapeId: "infra-kubernetes",
    shapes: INFRA_ICONS.map((i) => ({ id: i.id, title: i.title, keywords: i.keywords })),
  },
];

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
      className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg border border-border/60 bg-card/60
        hover:bg-accent hover:border-primary/30 ${isEdgeTool ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        transition-colors duration-100`}
    >
      <ShapeThumbnail type={shapeId} size={28} />
      <span className="text-[8px] text-muted-foreground leading-tight truncate w-full text-center">
        {title}
      </span>
    </button>
  );
}

function IconGroupTool({ onAddIcon }: { onAddIcon: (input: AddIconInput) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Icons: search the Iconify library"
            aria-label="Search icons"
            data-element-group="icons"
          />
        }
      >
        <ShapeThumbnail type="icon" size={24} />
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

function ElementGroupTool({
  category,
  onAddNode,
  onAddIcon,
  selectedShapeId,
  onSelectedShapeChange,
}: {
  category: ShapeCategory;
  onAddNode: (type: string, title: string) => void;
  onAddIcon: (input: AddIconInput) => void;
  selectedShapeId: string | undefined;
  onSelectedShapeChange: (categoryId: string, shapeId: string) => void;
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
    return <IconGroupTool onAddIcon={onAddIcon} />;
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
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={`${category.title}: ${selectedShape.title}`}
            aria-label={`${category.title} elements, ${selectedShape.title} selected`}
            data-element-group={category.id}
          />
        }
      >
        <ShapeThumbnail type={selectedShape.id} size={24} />
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
            <div className="grid grid-cols-4 gap-2">
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
                    className={`relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-center transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

  return (
    <div className="dm-elements-panel dm-panel-enter relative flex h-fit max-h-full w-full">
      <aside
        aria-label="Element tools"
        className="flex h-fit max-h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card"
      >
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-[3px] py-1">
          {activeVisibleCategoryIds.map((categoryId) => {
            const category = SHAPE_CATEGORIES.find((candidate) => candidate.id === categoryId);
            if (!category) return null;
            return (
              <ElementGroupTool
                key={`${category.id}-${dismissSignal}`}
                category={category}
                onAddNode={onAddNode}
                onAddIcon={onAddIcon}
                selectedShapeId={activeSelectedShapeIds[category.id]}
                onSelectedShapeChange={handleSelectedShapeChange}
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
        className="absolute -right-5 top-1/2 -z-10 flex h-12 w-10 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-border bg-card pl-[20px] text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        title="Expand elements panel"
        aria-label="Expand elements panel"
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: true,
    arrows: false,
    icons: true,
    sequence: false,
    architecture: true,
    boundaries: false,
    lifecycle: false,
    dataflow: false,
    annotations: false,
    flowchart: true,
    uml: false,
    bpmn: false,
    er: false,
    containers: false,
    aws: false,
    gcp: false,
    azure: false,
    infra: false,
  });
  const [searchQuery, setSearchQuery] = useState("");

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return SHAPE_CATEGORIES;
    const query = searchQuery.toLowerCase().trim();
    return SHAPE_CATEGORIES.map((category) => ({
      ...category,
      shapes: category.shapes.filter((shape) => {
        return matchesShape(shape, query);
      }),
    })).filter((category) => category.shapes.length > 0);
  }, [searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="dm-elements-panel dm-panel-enter relative h-full w-full">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card">
        {/* Panel title */}
        <div className="flex items-center px-4 pt-4 pb-2">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Elements</h2>
        </div>

        {/* Search */}
        <div className="px-3 pb-2.5">
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={14}
            />
            <input
              type="text"
              placeholder="Search Elements"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-h-10 w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm
              focus:ring-1 focus:ring-ring focus:border-primary outline-none
              placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Shape categories */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredCategories.map((category) => (
            <div key={category.id}>
              <button
                onClick={() => toggleSection(category.id)}
                aria-expanded={isSearching || openSections[category.id]}
                className="flex items-center justify-between w-full px-4 py-2 text-left text-sm font-semibold
                min-h-10 text-foreground border-b border-border/60 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring transition-colors"
              >
                {category.title}
                <ChevronDown
                  size={14}
                  className={`text-muted-foreground transition-transform ${
                    isSearching || openSections[category.id] ? "" : "-rotate-90"
                  }`}
                />
              </button>
              {(isSearching || openSections[category.id]) &&
                (category.id === "icons" ? (
                  <div className="p-2">
                    <IconPicker onAddIcon={onAddIcon} />
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1 p-2">
                    {category.shapes.map((shape) => (
                      <ShapeButton
                        key={shape.id}
                        shapeId={shape.id}
                        title={shape.title}
                        defaultLabel={shape.defaultLabel}
                        onClick={() => onAddNode(shape.id, shape.defaultLabel ?? shape.title)}
                      />
                    ))}
                  </div>
                ))}
            </div>
          ))}
          {filteredCategories.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-xs">No shapes found</div>
          )}
        </div>
      </div>
      {onCollapse && (
        <button
          type="button"
          onClick={onCollapse}
          className="absolute -right-5 top-1/2 -z-10 flex h-12 w-10 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-border bg-card pl-[20px] text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          title="Hide elements panel"
          aria-label="Hide elements panel"
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
