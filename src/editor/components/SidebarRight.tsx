"use client";

import { useState } from "react";
import {
  ChevronDown,
  Plus,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Key,
  Underline,
} from "lucide-react";
import type { EdgeRoutingMode } from "../types";
import { SEMANTIC_CONTAINER_TYPES } from "./shapes/semantic-elements";

interface TableRow {
  id: string;
  name: string;
  type: string;
}

interface ListItem {
  id: string;
  text: string;
}

interface EntityAttribute {
  id: string;
  name: string;
  isKey: boolean;
}

interface Lane {
  id: string;
  name: string;
}

interface SidebarRightProps {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedPreset: string | null;
  showPresets: boolean;
  setShowPresets: (val: boolean) => void;
  isPreviewing: boolean;
  setIsPreviewing: (val: boolean) => void;
  selectedLabel: string;
  onLabelChange: (label: string) => void;
  routingMode?: EdgeRoutingMode;
  onRoutingModeChange?: (mode: EdgeRoutingMode) => void;
  onResetEdgeBend?: () => void;
  // Style props
  nodeType?: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  fontSize?: number;
  fontWeight?: string;
  textColor?: string;
  textAlign?: string;
  fontFamily?: "sans" | "hand" | "mono";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline";
  lineHeight?: number;
  textAutoResize?: boolean;
  borderRadius?: number;
  headerColor?: string;
  onStyleChange?: (props: Record<string, unknown>) => void;
  // Motion props
  motionSpeed?: number;
  motionLoop?: boolean;
  // Image props
  imageUrl?: string;
  originalImageUrl?: string;
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
  naturalW?: number;
  naturalH?: number;
  // Table props
  tableRows?: TableRow[];
  onUpdateRows?: (rows: TableRow[]) => void;
  // UML Class props
  umlAttributes?: ListItem[];
  umlMethods?: ListItem[];
  onUpdateList?: (section: "attributes" | "methods", items: ListItem[]) => void;
  // ER Entity props
  entityAttributes?: EntityAttribute[];
  onUpdateEntityAttributes?: (attrs: EntityAttribute[]) => void;
  // Swimlane/Pool props
  lanes?: Lane[];
  onUpdateLanes?: (lanes: Lane[]) => void;
}

const UML_CLASS_TYPES = new Set(["uml-class", "uml-object"]);
const ER_ENTITY_TYPES = new Set(["er-entity", "er-weak-entity"]);
const SWIMLANE_TYPES = new Set(["swimlane-h", "swimlane-v", "bpmn-pool"]);
const ROUNDED_CONTAINER_TYPES = new Set(["group", "dashed-box", ...SEMANTIC_CONTAINER_TYPES]);

type TabId = "Style" | "Text" | "Table" | "Class" | "Entity" | "Lanes" | "Motion";

export function SidebarRight({
  selectedNodeId,
  selectedEdgeId,
  selectedPreset,
  showPresets,
  setShowPresets,
  isPreviewing,
  setIsPreviewing,
  selectedLabel,
  onLabelChange,
  routingMode = "curve",
  onRoutingModeChange,
  onResetEdgeBend,
  nodeType,
  fillColor = "#ffffff",
  strokeColor = "#4b5563",
  strokeWidth = 1,
  opacity = 1,
  fontSize = 14,
  fontWeight = "500",
  textColor = "#1f2937",
  textAlign = "center",
  fontFamily = "sans",
  fontStyle = "normal",
  textDecoration = "none",
  lineHeight = 1.25,
  textAutoResize = true,
  borderRadius,
  headerColor,
  imageUrl,
  originalImageUrl,
  cropW,
  cropH,
  onStyleChange,
  motionSpeed = 0.25,
  motionLoop = true,
  tableRows,
  onUpdateRows,
  umlAttributes,
  umlMethods,
  onUpdateList,
  entityAttributes,
  onUpdateEntityAttributes,
  lanes,
  onUpdateLanes,
}: SidebarRightProps) {
  const isImage = nodeType === "image";
  const isText = nodeType === "text";
  const isTable = nodeType === "table";
  const isSwimlane = SWIMLANE_TYPES.has(nodeType || "");
  const isUmlClass = UML_CLASS_TYPES.has(nodeType || "");
  const isEntity = ER_ENTITY_TYPES.has(nodeType || "");
  const isRoundedContainer = ROUNDED_CONTAINER_TYPES.has(nodeType || "");
  const isGroup = nodeType === "group";
  const isSemanticContainer = SEMANTIC_CONTAINER_TYPES.has(nodeType || "");
  const hasSelection = !!selectedNodeId || !!selectedEdgeId;

  const tabs: TabId[] = (() => {
    if (isTable) return ["Style", "Text", "Table", "Motion"];
    if (isUmlClass) return ["Style", "Text", "Class", "Motion"];
    if (isEntity) return ["Style", "Text", "Entity", "Motion"];
    if (isSwimlane) return ["Style", "Text", "Lanes", "Motion"];
    return ["Style", "Text", "Motion"];
  })();

  const [activeTab, setActiveTab] = useState<TabId>("Style");
  const safeTab = tabs.includes(activeTab) ? activeTab : tabs[0];

  const updateStyle = (key: string, value: unknown) => {
    onStyleChange?.({ [key]: value });
  };

  // --- Table helpers ---
  const addRow = () => {
    if (!onUpdateRows) return;
    const newRow: TableRow = {
      id: Date.now().toString(),
      name: "column_" + ((tableRows?.length || 0) + 1),
      type: "varchar",
    };
    onUpdateRows([...(tableRows || []), newRow]);
  };

  const removeRow = (rowId: string) => {
    if (!onUpdateRows || !tableRows) return;
    onUpdateRows(tableRows.filter((r) => r.id !== rowId));
  };

  const updateRow = (rowId: string, field: "name" | "type", value: string) => {
    if (!onUpdateRows || !tableRows) return;
    onUpdateRows(tableRows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)));
  };

  // --- UML Class helpers ---
  const addListItem = (section: "attributes" | "methods") => {
    if (!onUpdateList) return;
    const list = section === "attributes" ? umlAttributes : umlMethods;
    const prefix = section === "attributes" ? "- field" : "+ method";
    const suffix = section === "attributes" ? `: type` : `(): void`;
    const newItem: ListItem = {
      id: Date.now().toString(),
      text: `${prefix}${(list?.length || 0) + 1}${suffix}`,
    };
    onUpdateList(section, [...(list || []), newItem]);
  };

  const removeListItem = (section: "attributes" | "methods", itemId: string) => {
    if (!onUpdateList) return;
    const list = section === "attributes" ? umlAttributes : umlMethods;
    onUpdateList(
      section,
      (list || []).filter((i) => i.id !== itemId),
    );
  };

  const updateListItem = (section: "attributes" | "methods", itemId: string, text: string) => {
    if (!onUpdateList) return;
    const list = section === "attributes" ? umlAttributes : umlMethods;
    onUpdateList(
      section,
      (list || []).map((i) => (i.id === itemId ? { ...i, text } : i)),
    );
  };

  // --- ER Entity helpers ---
  const addEntityAttr = () => {
    if (!onUpdateEntityAttributes) return;
    const newAttr: EntityAttribute = {
      id: Date.now().toString(),
      name: "attribute_" + ((entityAttributes?.length || 0) + 1),
      isKey: false,
    };
    onUpdateEntityAttributes([...(entityAttributes || []), newAttr]);
  };

  const removeEntityAttr = (attrId: string) => {
    if (!onUpdateEntityAttributes || !entityAttributes) return;
    onUpdateEntityAttributes(entityAttributes.filter((a) => a.id !== attrId));
  };

  const updateEntityAttr = (attrId: string, field: "name" | "isKey", value: string | boolean) => {
    if (!onUpdateEntityAttributes || !entityAttributes) return;
    onUpdateEntityAttributes(
      entityAttributes.map((a) => (a.id === attrId ? { ...a, [field]: value } : a)),
    );
  };

  const toggleEntityKey = (attrId: string) => {
    if (!onUpdateEntityAttributes || !entityAttributes) return;
    onUpdateEntityAttributes(
      entityAttributes.map((a) => (a.id === attrId ? { ...a, isKey: !a.isKey } : a)),
    );
  };

  // --- Swimlane/Pool lane helpers ---
  const addLane = () => {
    if (!onUpdateLanes) return;
    const newLane: Lane = {
      id: Date.now().toString(),
      name: "Lane " + ((lanes?.length || 0) + 1),
    };
    onUpdateLanes([...(lanes || []), newLane]);
  };

  const removeLane = (laneId: string) => {
    if (!onUpdateLanes || !lanes || lanes.length <= 1) return;
    onUpdateLanes(lanes.filter((l) => l.id !== laneId));
  };

  const updateLaneName = (laneId: string, name: string) => {
    if (!onUpdateLanes || !lanes) return;
    onUpdateLanes(lanes.map((l) => (l.id === laneId ? { ...l, name } : l)));
  };

  // Shared input classes
  const inputCls =
    "w-full text-xs border border-border/60 rounded-lg px-2.5 py-1.5 bg-card/60 focus:ring-1 focus:ring-ring focus:border-primary outline-none";
  const labelCls = "text-xs font-medium text-foreground";
  const labelFieldId = "drawcms-selected-element-label";
  const labelHelpId = "drawcms-selected-element-label-help";

  return (
    <div className="flex h-full w-72 flex-col overflow-hidden rounded-lg border border-border bg-card">
      {/* Panel title */}
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
        <h2 className="text-lg font-bold text-foreground">Properties & Motion</h2>
      </div>

      {/* Pill tab bar */}
      <div className="px-3 pb-2">
        <div
          className="flex bg-muted/50 rounded-lg p-0.5"
          role="tablist"
          aria-label="Properties panels"
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const index = tabs.indexOf(safeTab);
            const next =
              event.key === "ArrowRight"
                ? tabs[(index + 1) % tabs.length]
                : tabs[(index - 1 + tabs.length) % tabs.length];
            setActiveTab(next);
            (event.currentTarget.querySelector(`[data-tab="${next}"]`) as HTMLElement)?.focus();
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab}
              data-tab={tab}
              role="tab"
              aria-selected={safeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`min-h-10 flex-1 py-2 text-[11px] font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                safeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {!hasSelection ? (
          <div className="text-xs text-muted-foreground text-center py-10 px-4">
            Select a node or edge to edit its properties.
          </div>
        ) : (
          <>
            {/* STYLE TAB */}
            {safeTab === "Style" && (
              <div className="p-3 space-y-4">
                {selectedEdgeId ? (
                  <fieldset className="space-y-3">
                    <legend className="text-xs font-semibold text-foreground">Path</legend>
                    <div className="grid grid-cols-3 gap-2" aria-label="Edge path style">
                      {(["straight", "elbow", "curve"] as const).map((mode) => (
                        <label key={mode} className="relative cursor-pointer">
                          <input
                            type="radio"
                            name="edge-routing-mode"
                            value={mode}
                            checked={routingMode === mode}
                            onChange={() => onRoutingModeChange?.(mode)}
                            className="peer sr-only"
                          />
                          <span className="flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-2 text-[11px] font-medium capitalize text-muted-foreground transition-colors peer-checked:border-primary peer-checked:bg-accent peer-checked:text-primary peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 hover:bg-muted">
                            {mode}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="text-[11px] leading-4 text-muted-foreground">
                      Drag the mint handle on the selected edge. Use arrow keys for 1 px changes or
                      Shift + arrow for 10 px.
                    </p>
                    <button
                      type="button"
                      onClick={onResetEdgeBend}
                      className="min-h-10 w-full rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      Reset bend
                    </button>
                  </fieldset>
                ) : (
                  <>
                    {/* Fill Color */}
                    <div className="space-y-1.5">
                      <label className={labelCls}>Fill</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={fillColor}
                          onChange={(e) => updateStyle("fillColor", e.target.value)}
                          className="w-8 h-8 rounded-lg border border-border/60 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={fillColor}
                          onChange={(e) => updateStyle("fillColor", e.target.value)}
                          className={`flex-1 text-xs border border-border/60 rounded-lg px-2.5 py-1.5 font-mono bg-card/60
                        focus:ring-1 focus:ring-ring focus:border-primary outline-none`}
                        />
                      </div>
                    </div>

                    {/* Stroke Color */}
                    <div className="space-y-1.5">
                      <label className={labelCls}>Stroke</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={strokeColor}
                          onChange={(e) => updateStyle("strokeColor", e.target.value)}
                          className="w-8 h-8 rounded-lg border border-border/60 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={strokeColor}
                          onChange={(e) => updateStyle("strokeColor", e.target.value)}
                          className={`flex-1 text-xs border border-border/60 rounded-lg px-2.5 py-1.5 font-mono bg-card/60
                        focus:ring-1 focus:ring-ring focus:border-primary outline-none`}
                        />
                      </div>
                    </div>

                    {/* Header Color (for structured shapes & group container) */}
                    {(isTable || isUmlClass || isEntity || isGroup || isSemanticContainer) && (
                      <div className="space-y-1.5">
                        <label className={labelCls}>Header Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={
                              headerColor ||
                              (isGroup
                                ? "#4a90d9"
                                : isSemanticContainer
                                  ? "#e2e8f0"
                                  : isUmlClass
                                    ? "#dbeafe"
                                    : isEntity
                                      ? "#fef3c7"
                                      : "#e5e7eb")
                            }
                            onChange={(e) => updateStyle("headerColor", e.target.value)}
                            className="w-8 h-8 rounded-lg border border-border/60 cursor-pointer p-0.5"
                          />
                          <span className="text-[10px] text-muted-foreground">
                            Header background
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Border Radius (for group & dashed-box containers) */}
                    {isRoundedContainer && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between">
                          <label className={labelCls}>Corner Radius</label>
                          <span className="text-xs text-muted-foreground">
                            {borderRadius ?? (isGroup ? 8 : 6)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="30"
                          step="1"
                          value={borderRadius ?? (isGroup ? 8 : 6)}
                          onChange={(e) => updateStyle("borderRadius", parseInt(e.target.value))}
                          className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                      </div>
                    )}

                    {/* Stroke Width */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <label className={labelCls}>Stroke Width</label>
                        <span className="text-xs text-muted-foreground">{strokeWidth}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="8"
                        step="0.5"
                        value={strokeWidth}
                        onChange={(e) => updateStyle("strokeWidth", parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    {/* Image URL (only for image type) */}
                    {isImage && (
                      <div className="space-y-1.5">
                        <label className={labelCls}>Image URL</label>
                        <input
                          type="text"
                          value={imageUrl || ""}
                          onChange={(e) => updateStyle("imageUrl", e.target.value)}
                          placeholder="https://example.com/image.png"
                          className={inputCls}
                        />
                        <label className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary font-medium cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => {
                                updateStyle("imageUrl", reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                          Upload from file
                        </label>
                        {imageUrl && (
                          <div className="border border-border/60 rounded-lg overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imageUrl}
                              alt="Preview"
                              className="w-full h-20 object-contain bg-muted/50"
                            />
                          </div>
                        )}

                        {/* Crop Controls */}
                        {imageUrl && (
                          <div className="space-y-2.5 pt-2 border-t border-border/40">
                            <label className={labelCls}>Crop</label>
                            <div className="text-[10px] text-muted-foreground">
                              Double-click image on canvas to open crop editor
                            </div>

                            {cropW != null && originalImageUrl && (
                              <>
                                <div className="text-[10px] text-muted-foreground">
                                  Cropped: {cropW}&times;{cropH}
                                </div>
                                <button
                                  onClick={() => {
                                    onStyleChange?.({
                                      imageUrl: originalImageUrl,
                                      _originalImageUrl: undefined,
                                      cropX: undefined,
                                      cropY: undefined,
                                      cropW: undefined,
                                      cropH: undefined,
                                      _naturalW: undefined,
                                      _naturalH: undefined,
                                    });
                                  }}
                                  className="w-full py-1.5 text-[11px] text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted/60 border border-border/60 rounded-lg transition-colors"
                                >
                                  Reset Crop
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Opacity */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <label className={labelCls}>Opacity</label>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(opacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={opacity}
                        onChange={(e) => updateStyle("opacity", parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TEXT TAB */}
            {safeTab === "Text" && (
              <div className="p-3 space-y-4">
                {/* Label */}
                <div className="space-y-1.5">
                  <label className={labelCls} htmlFor={labelFieldId}>
                    {isTable
                      ? "Table Name"
                      : isUmlClass
                        ? "Class Name"
                        : isEntity
                          ? "Entity Name"
                          : "Label"}
                  </label>
                  <textarea
                    id={labelFieldId}
                    rows={4}
                    value={selectedLabel}
                    onChange={(e) => onLabelChange(e.target.value)}
                    placeholder="Enter label text"
                    aria-describedby={labelHelpId}
                    className={`${inputCls} min-h-24 resize-y leading-relaxed`}
                  />
                  <p id={labelHelpId} className="text-[11px] leading-relaxed text-muted-foreground">
                    {isText
                      ? "Double-click the text on canvas to edit it in place. Line breaks are preserved."
                      : "Line breaks are preserved. Resize the element to give longer text more room."}
                  </p>
                </div>

                {isText && (
                  <div className="space-y-1.5">
                    <label className={labelCls} htmlFor="text-font-family">
                      Font
                    </label>
                    <select
                      id="text-font-family"
                      value={fontFamily}
                      onChange={(event) => updateStyle("fontFamily", event.target.value)}
                      className={inputCls}
                    >
                      <option value="sans">Clean</option>
                      <option value="hand">Hand-drawn</option>
                      <option value="mono">Monospace</option>
                    </select>
                  </div>
                )}

                {/* Font Size */}
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <label className={labelCls}>Font Size</label>
                    <span className="text-xs text-muted-foreground">{fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max={isText ? "96" : "48"}
                    step="1"
                    value={fontSize}
                    onChange={(e) => updateStyle("fontSize", parseInt(e.target.value))}
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Font Weight */}
                <div className="space-y-1.5">
                  <label className={labelCls}>Style</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      aria-pressed={fontWeight === "700"}
                      onClick={() =>
                        updateStyle("fontWeight", fontWeight === "700" ? "400" : "700")
                      }
                      className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        fontWeight === "700"
                          ? "bg-accent border-primary/30 text-primary"
                          : "bg-card/60 border-border/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Bold size={14} aria-hidden /> Bold
                    </button>
                    <button
                      type="button"
                      aria-pressed={fontStyle === "italic"}
                      onClick={() =>
                        updateStyle("fontStyle", fontStyle === "italic" ? "normal" : "italic")
                      }
                      className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        fontStyle === "italic"
                          ? "bg-accent border-primary/30 text-primary"
                          : "bg-card/60 border-border/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Italic size={14} aria-hidden /> Italic
                    </button>
                    <button
                      type="button"
                      aria-pressed={textDecoration === "underline"}
                      onClick={() =>
                        updateStyle(
                          "textDecoration",
                          textDecoration === "underline" ? "none" : "underline",
                        )
                      }
                      className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        textDecoration === "underline"
                          ? "bg-accent border-primary/30 text-primary"
                          : "bg-card/60 border-border/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Underline size={14} aria-hidden /> Underline
                    </button>
                  </div>
                </div>

                {isText && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <label className={labelCls}>Line height</label>
                      <span className="text-xs text-muted-foreground">{lineHeight.toFixed(2)}</span>
                    </div>
                    <input
                      aria-label="Line height"
                      type="range"
                      min="1"
                      max="2"
                      step="0.05"
                      value={lineHeight}
                      onChange={(event) => updateStyle("lineHeight", Number(event.target.value))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
                    />
                  </div>
                )}

                {/* Text Color */}
                <div className="space-y-1.5">
                  <label className={labelCls}>Text Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => updateStyle("textColor", e.target.value)}
                      className="w-8 h-8 rounded-lg border border-border/60 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={textColor}
                      onChange={(e) => updateStyle("textColor", e.target.value)}
                      className={`flex-1 text-xs border border-border/60 rounded-lg px-2.5 py-1.5 font-mono bg-card/60
                        focus:ring-1 focus:ring-ring focus:border-primary outline-none`}
                    />
                  </div>
                </div>

                {isText && (
                  <div className="space-y-2">
                    <label className={labelCls}>Background</label>
                    <div className="flex items-center gap-2">
                      <input
                        aria-label="Text background color"
                        type="color"
                        value={fillColor === "transparent" ? "#ffffff" : fillColor}
                        onChange={(event) => updateStyle("fillColor", event.target.value)}
                        className="h-10 w-10 cursor-pointer rounded-lg border border-border p-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => updateStyle("fillColor", "transparent")}
                        className="min-h-10 flex-1 rounded-lg border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        No background
                      </button>
                    </div>
                  </div>
                )}

                {isText && (
                  <button
                    type="button"
                    onClick={() => updateStyle("textAutoResize", true)}
                    className="min-h-10 w-full rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {textAutoResize ? "Fitting text automatically" : "Fit box to text"}
                  </button>
                )}

                {/* Text Alignment */}
                <div className="space-y-1.5">
                  <label className={labelCls}>Alignment</label>
                  <div className="flex gap-1">
                    {(["left", "center", "right"] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        aria-label={`Align ${align}`}
                        aria-pressed={textAlign === align}
                        onClick={() => updateStyle("textAlign", align)}
                        className={`flex min-h-10 flex-1 items-center justify-center rounded-lg border py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          textAlign === align
                            ? "bg-accent border-primary/30 text-primary"
                            : "bg-card/60 border-border/60 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {align === "left" && <AlignLeft size={14} />}
                        {align === "center" && <AlignCenter size={14} />}
                        {align === "right" && <AlignRight size={14} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TABLE TAB */}
            {safeTab === "Table" && isTable && (
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <label className={labelCls}>Columns</label>
                  <button
                    onClick={addRow}
                    className="flex items-center gap-1 text-[11px] text-primary hover:text-primary font-medium"
                  >
                    <Plus size={12} /> Add Row
                  </button>
                </div>

                {(!tableRows || tableRows.length === 0) && (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    No rows yet. Click &quot;Add Row&quot; to start.
                  </div>
                )}

                <div className="space-y-1">
                  {tableRows?.map((row, index) => (
                    <div key={row.id} className="flex items-center gap-1 group">
                      <span className="text-[10px] text-muted-foreground w-4 text-right">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateRow(row.id, "name", e.target.value)}
                        className="flex-1 text-xs border border-border/60 rounded-lg px-1.5 py-1 bg-card/60
                          focus:ring-1 focus:ring-ring focus:border-primary outline-none"
                        placeholder="name"
                      />
                      <input
                        type="text"
                        value={row.type}
                        onChange={(e) => updateRow(row.id, "type", e.target.value)}
                        className="w-20 text-xs border border-border/60 rounded-lg px-1.5 py-1 text-muted-foreground bg-card/60
                          focus:ring-1 focus:ring-ring focus:border-primary outline-none"
                        placeholder="type"
                      />
                      <button
                        onClick={() => removeRow(row.id)}
                        className="p-0.5 text-muted-foreground hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* UML CLASS TAB */}
            {safeTab === "Class" && isUmlClass && (
              <div className="p-3 space-y-4">
                {/* Attributes section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Attributes</label>
                    <button
                      onClick={() => addListItem("attributes")}
                      className="flex items-center gap-1 text-[11px] text-primary hover:text-primary font-medium"
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>

                  {(!umlAttributes || umlAttributes.length === 0) && (
                    <div className="text-xs text-muted-foreground text-center py-2">
                      No attributes yet.
                    </div>
                  )}

                  <div className="space-y-1">
                    {umlAttributes?.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-1 group">
                        <span className="text-[10px] text-muted-foreground w-4 text-right">
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) => updateListItem("attributes", item.id, e.target.value)}
                          className="flex-1 text-xs border border-border/60 rounded-lg px-1.5 py-1 font-mono bg-card/60
                            focus:ring-1 focus:ring-ring focus:border-primary outline-none"
                          placeholder="- name: type"
                        />
                        <button
                          onClick={() => removeListItem("attributes", item.id)}
                          className="p-0.5 text-muted-foreground hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border/40" />

                {/* Methods section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Methods</label>
                    <button
                      onClick={() => addListItem("methods")}
                      className="flex items-center gap-1 text-[11px] text-primary hover:text-primary font-medium"
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>

                  {(!umlMethods || umlMethods.length === 0) && (
                    <div className="text-xs text-muted-foreground text-center py-2">
                      No methods yet.
                    </div>
                  )}

                  <div className="space-y-1">
                    {umlMethods?.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-1 group">
                        <span className="text-[10px] text-muted-foreground w-4 text-right">
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) => updateListItem("methods", item.id, e.target.value)}
                          className="flex-1 text-xs border border-border/60 rounded-lg px-1.5 py-1 font-mono bg-card/60
                            focus:ring-1 focus:ring-ring focus:border-primary outline-none"
                          placeholder="+ name(): type"
                        />
                        <button
                          onClick={() => removeListItem("methods", item.id)}
                          className="p-0.5 text-muted-foreground hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ER ENTITY TAB */}
            {safeTab === "Entity" && isEntity && (
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <label className={labelCls}>Attributes</label>
                  <button
                    onClick={addEntityAttr}
                    className="flex items-center gap-1 text-[11px] text-primary hover:text-primary font-medium"
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>

                {(!entityAttributes || entityAttributes.length === 0) && (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    No attributes yet.
                  </div>
                )}

                <div className="space-y-1">
                  {entityAttributes?.map((attr, index) => (
                    <div key={attr.id} className="flex items-center gap-1 group">
                      <span className="text-[10px] text-muted-foreground w-4 text-right">
                        {index + 1}
                      </span>
                      <button
                        onClick={() => toggleEntityKey(attr.id)}
                        title={attr.isKey ? "Primary key (click to unset)" : "Set as primary key"}
                        className={`p-0.5 rounded transition-colors ${
                          attr.isKey
                            ? "text-warning bg-warning-soft"
                            : "text-muted-foreground hover:text-warning"
                        }`}
                      >
                        <Key size={12} />
                      </button>
                      <input
                        type="text"
                        value={attr.name}
                        onChange={(e) => updateEntityAttr(attr.id, "name", e.target.value)}
                        className={`flex-1 text-xs border border-border/60 rounded-lg px-1.5 py-1 bg-card/60
                          focus:ring-1 focus:ring-ring focus:border-primary outline-none
                          ${attr.isKey ? "font-semibold" : ""}`}
                        placeholder="attribute name"
                      />
                      <button
                        onClick={() => removeEntityAttr(attr.id)}
                        className="p-0.5 text-muted-foreground hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
                  <Key size={10} className="text-warning" />
                  Click key icon to toggle primary key
                </div>
              </div>
            )}

            {/* LANES TAB */}
            {safeTab === "Lanes" && isSwimlane && (
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <label className={labelCls}>Lanes</label>
                  <button
                    onClick={addLane}
                    className="flex items-center gap-1 text-[11px] text-primary hover:text-primary font-medium"
                  >
                    <Plus size={12} /> Add Lane
                  </button>
                </div>

                {(!lanes || lanes.length === 0) && (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    No lanes yet. Click &quot;Add Lane&quot; to start.
                  </div>
                )}

                <div className="space-y-1">
                  {lanes?.map((lane, index) => (
                    <div key={lane.id} className="flex items-center gap-1 group">
                      <span className="text-[10px] text-muted-foreground w-4 text-right">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={lane.name}
                        onChange={(e) => updateLaneName(lane.id, e.target.value)}
                        className="flex-1 text-xs border border-border/60 rounded-lg px-1.5 py-1 bg-card/60
                          focus:ring-1 focus:ring-ring focus:border-primary outline-none"
                        placeholder="Lane name"
                      />
                      <button
                        onClick={() => removeLane(lane.id)}
                        disabled={(lanes?.length || 0) <= 1}
                        className={`p-0.5 transition-opacity ${
                          (lanes?.length || 0) <= 1
                            ? "cursor-not-allowed text-muted-foreground/50"
                            : "text-muted-foreground hover:text-danger opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="text-[10px] text-muted-foreground pt-1">
                  {nodeType === "swimlane-h" && "Horizontal lanes (rows)"}
                  {nodeType === "swimlane-v" && "Vertical lanes (columns)"}
                  {nodeType === "bpmn-pool" && "Pool lanes (horizontal)"}
                </div>
              </div>
            )}

            {/* MOTION TAB */}
            {safeTab === "Motion" && (
              <div className="space-y-4 p-3">
                <div className="space-y-1.5">
                  <label className={labelCls}>Preset</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowPresets(!showPresets)}
                      disabled={!hasSelection}
                      aria-expanded={showPresets}
                      className={`min-h-10 w-full rounded-lg border border-border/60 bg-card/60 py-2 pl-2.5 pr-8 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        !hasSelection ? "cursor-not-allowed opacity-50" : "hover:border-border"
                      }`}
                    >
                      {selectedPreset || "Choose a motion preset"}
                    </button>
                    <ChevronDown
                      className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-transform duration-100 ${
                        showPresets ? "rotate-180" : ""
                      }`}
                      size={14}
                      aria-hidden
                    />
                  </div>
                  <p className="text-[11px] leading-4 text-muted-foreground">
                    Pick a reusable effect, then preview it on this selection.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <label htmlFor="motion-speed" className={labelCls}>
                      Speed
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {motionSpeed < 0.5
                        ? "Slow"
                        : motionSpeed <= 1
                          ? "Normal"
                          : motionSpeed <= 2
                            ? "Fast"
                            : "Very fast"}{" "}
                      ({motionSpeed}x)
                    </span>
                  </div>
                  <input
                    id="motion-speed"
                    type="range"
                    min="0.25"
                    max="3"
                    step="0.25"
                    value={motionSpeed}
                    onChange={(event) =>
                      updateStyle("motionSpeed", Number.parseFloat(event.target.value))
                    }
                    disabled={!hasSelection || !selectedPreset}
                    className="h-10 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>

                <div className="flex min-h-10 items-center justify-between">
                  <label htmlFor="motion-loop-toggle" className={labelCls}>
                    Loop continuously
                  </label>
                  <label className="relative inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center">
                    <input
                      id="motion-loop-toggle"
                      type="checkbox"
                      className="peer sr-only"
                      checked={motionLoop}
                      onChange={(event) => updateStyle("motionLoop", event.target.checked)}
                      disabled={!hasSelection || !selectedPreset}
                    />
                    <span
                      aria-hidden
                      className="relative h-5 w-9 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-border after:bg-card after:content-[''] after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-card peer-disabled:opacity-40 peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                    />
                  </label>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={() => setIsPreviewing(!isPreviewing)}
          disabled={!hasSelection || !selectedPreset}
          aria-pressed={isPreviewing}
          className={`min-h-10 w-full rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isPreviewing
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : hasSelection && selectedPreset
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "cursor-not-allowed bg-muted/60 text-muted-foreground"
          }`}
        >
          {isPreviewing
            ? "Stop preview"
            : selectedPreset
              ? "Preview selected motion"
              : "Choose a preset to preview"}
        </button>
      </div>
    </div>
  );
}
