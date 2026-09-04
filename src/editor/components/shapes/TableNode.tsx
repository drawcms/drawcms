"use client";

import React, { useState, useRef, useEffect } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import { useNodeCallbacks, useAnimationState } from "../../contexts";
import { EditableNodeLabel } from "../EditableNodeLabel";
import {
  STORY_ACTIVE_DIVIDER,
  STORY_ACTIVE_FILL,
  STORY_ACTIVE_HEADER,
  STORY_ACTIVE_STROKE,
} from "../../story/highlight";
import gsap from "gsap";

interface TableRow {
  id: string;
  name: string;
  type: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TableNode({ id, data, selected }: { id: string; data: any; selected: boolean }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [editingHeader, setEditingHeader] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editField, setEditField] = useState<"name" | "type">("name");
  const callbacks = useNodeCallbacks();
  const {
    isGlobalAnimating,
    isPreviewingSelected,
    selectedNodeId,
    activeStoryNodeIds,
    isStoryStepPlaying,
  } = useAnimationState();

  const label: string = data?.label || "Table";
  const rows: TableRow[] = data?.rows || [];
  const fillColor: string = data?.fillColor || "white";
  const strokeColor: string = data?.strokeColor || "#4b5563";
  const headerColor: string = data?.headerColor || "#e5e7eb";
  const fontSize: number = data?.fontSize || 12;
  const textColor: string = data?.textColor || "#1f2937";
  const preset = data?.preset;
  const isStoryTarget = activeStoryNodeIds.includes(id);
  const storyStrokeColor = isStoryTarget ? STORY_ACTIVE_STROKE : strokeColor;
  const storyFillColor = isStoryTarget ? STORY_ACTIVE_FILL : fillColor;
  const storyHeaderColor = isStoryTarget ? STORY_ACTIVE_HEADER : headerColor;
  const storyDividerColor = isStoryTarget ? STORY_ACTIVE_DIVIDER : strokeColor;
  const isAnimating =
    isGlobalAnimating ||
    (isPreviewingSelected && id === selectedNodeId) ||
    (isStoryStepPlaying && isStoryTarget);

  useEffect(() => {
    if (!nodeRef.current) return;
    const node = nodeRef.current;
    gsap.killTweensOf(node);
    gsap.set(node, { clearProps: "all" });
    if (!isAnimating) return;
    if (preset === "Bounce") {
      gsap.to(node, { y: -15, duration: 0.4, yoyo: true, repeat: -1, ease: "power1.inOut" });
    } else if (preset === "Spin") {
      gsap.to(node, { rotation: 360, duration: 2, repeat: -1, ease: "linear" });
    } else if (preset === "Pulse Node") {
      gsap.to(node, { scale: 1.1, duration: 0.6, yoyo: true, repeat: -1, ease: "sine.inOut" });
    } else if (preset === "Shake") {
      gsap.to(node, { x: 5, duration: 0.1, yoyo: true, repeat: -1, ease: "sine.inOut" });
    }
  }, [preset, isAnimating]);

  function commitHeaderEdit(value: string) {
    setEditingHeader(false);
    callbacks?.onLabelChange(id, value);
  }

  function commitRowEdit(rowId: string, field: "name" | "type", value: string) {
    setEditingRowId(null);
    if (callbacks?.onUpdateRows) {
      const updated = rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r));
      callbacks.onUpdateRows(id, updated);
    }
  }

  const rowHeight = Math.max(24, fontSize + 12);
  const headerHeight = Math.max(28, fontSize + 16);

  return (
    <>
      <NodeResizer isVisible={selected && !data?.locked} minWidth={100} minHeight={40} />
      <div ref={nodeRef} className="relative w-full" style={{ fontFamily: "Inter, sans-serif" }}>
        <Handle
          type="source"
          position={Position.Top}
          id="top"
          className="h-3 w-3 border-2 border-muted-foreground bg-card"
        />
        <Handle
          type="source"
          position={Position.Left}
          id="left"
          className="h-3 w-3 border-2 border-muted-foreground bg-card"
        />

        <div
          className="w-full rounded border shadow-md"
          data-story-active={isStoryTarget ? "true" : undefined}
          style={{ borderColor: storyStrokeColor, backgroundColor: storyFillColor }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-center border-b px-2 py-1 font-semibold"
            style={{
              backgroundColor: storyHeaderColor,
              borderColor: storyDividerColor,
              minHeight: headerHeight,
              fontSize,
              color: textColor,
            }}
            onDoubleClick={() => setEditingHeader(true)}
          >
            <EditableNodeLabel
              value={label}
              isEditing={editingHeader}
              onCommit={commitHeaderEdit}
              onCancel={() => setEditingHeader(false)}
              ariaLabel="Edit table name"
              className="min-h-5"
              displayClassName="font-semibold"
              editorClassName="min-h-16 font-semibold"
              style={{ fontSize, color: textColor, textAlign: "center" }}
              fitText={false}
            />
          </div>

          {/* Rows */}
          <div className="flex-1">
            {rows.length === 0 && (
              <div className="text-center py-2 text-gray-400 text-xs italic">No rows</div>
            )}
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex border-b last:border-b-0"
                style={{ borderColor: storyDividerColor, height: rowHeight }}
              >
                <div
                  className="flex-1 px-2 flex items-center border-r truncate"
                  style={{
                    borderColor: storyDividerColor,
                    fontSize: fontSize - 1,
                    color: textColor,
                  }}
                  onDoubleClick={() => {
                    setEditingRowId(row.id);
                    setEditField("name");
                  }}
                >
                  {editingRowId === row.id && editField === "name" ? (
                    <input
                      autoFocus
                      defaultValue={row.name}
                      className="w-full bg-transparent outline-none"
                      style={{ fontSize: fontSize - 1, color: textColor }}
                      onBlur={(e) => commitRowEdit(row.id, "name", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          commitRowEdit(row.id, "name", (e.target as HTMLInputElement).value);
                      }}
                    />
                  ) : (
                    <span className="truncate">{row.name}</span>
                  )}
                </div>
                <div
                  className="w-[40%] px-2 flex items-center text-gray-500 truncate"
                  style={{ fontSize: fontSize - 1 }}
                  onDoubleClick={() => {
                    setEditingRowId(row.id);
                    setEditField("type");
                  }}
                >
                  {editingRowId === row.id && editField === "type" ? (
                    <input
                      autoFocus
                      defaultValue={row.type}
                      className="w-full bg-transparent outline-none text-gray-500"
                      style={{ fontSize: fontSize - 1 }}
                      onBlur={(e) => commitRowEdit(row.id, "type", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          commitRowEdit(row.id, "type", (e.target as HTMLInputElement).value);
                      }}
                    />
                  ) : (
                    <span className="truncate">{row.type}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="h-3 w-3 border-2 border-muted-foreground bg-card"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="h-3 w-3 border-2 border-muted-foreground bg-card"
        />
      </div>
    </>
  );
}
