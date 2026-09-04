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

interface EntityAttribute {
  id: string;
  name: string;
  isKey: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function EntityNode({ id, data, selected }: { id: string; data: any; selected: boolean }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [editingHeader, setEditingHeader] = useState(false);
  const [editingAttrId, setEditingAttrId] = useState<string | null>(null);
  const callbacks = useNodeCallbacks();
  const {
    isGlobalAnimating,
    isPreviewingSelected,
    selectedNodeId,
    activeStoryNodeIds,
    isStoryStepPlaying,
  } = useAnimationState();

  const label: string = data?.label || "Entity";
  const entityAttributes: EntityAttribute[] = data?.entityAttributes || [];
  const fillColor: string = data?.fillColor || "white";
  const strokeColor: string = data?.strokeColor || "#4b5563";
  const headerColor: string = data?.headerColor || "#fef3c7";
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
  const isWeak = data?.type === "er-weak-entity";

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

  function commitAttrEdit(attrId: string, value: string) {
    setEditingAttrId(null);
    if (callbacks?.onUpdateEntityAttributes) {
      const updated = entityAttributes.map((a) => (a.id === attrId ? { ...a, name: value } : a));
      callbacks.onUpdateEntityAttributes(id, updated);
    }
  }

  const rowHeight = Math.max(24, fontSize + 12);
  const headerHeight = Math.max(30, fontSize + 18);

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
          className={`w-full rounded shadow-md ${isWeak ? "border-4 border-double" : "border"}`}
          data-story-active={isStoryTarget ? "true" : undefined}
          style={{ borderColor: storyStrokeColor, backgroundColor: storyFillColor }}
        >
          {/* Header - entity name */}
          <div
            className="flex items-center justify-center border-b px-2 py-1 font-bold"
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
              ariaLabel="Edit entity name"
              className="min-h-5"
              displayClassName="font-bold"
              editorClassName="min-h-16 font-bold"
              style={{ fontSize, color: textColor, textAlign: "center" }}
              fitText={false}
            />
          </div>

          {/* Attributes */}
          <div>
            {entityAttributes.length === 0 && (
              <div className="text-center py-2 text-gray-400 text-xs italic">No attributes</div>
            )}
            {entityAttributes.map((attr) => (
              <div
                key={attr.id}
                className="flex items-center border-b last:border-b-0 px-2 gap-1.5"
                style={{ borderColor: storyDividerColor, height: rowHeight }}
                onDoubleClick={() => setEditingAttrId(attr.id)}
              >
                {attr.isKey && (
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="shrink-0">
                    <path
                      d="M11.5 1a4.5 4.5 0 00-3.6 7.2L2 14.1V16h1.9l5.9-5.9A4.5 4.5 0 1011.5 1zm0 7a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"
                      fill="#d97706"
                    />
                  </svg>
                )}
                {editingAttrId === attr.id ? (
                  <input
                    autoFocus
                    defaultValue={attr.name}
                    className="flex-1 bg-transparent outline-none"
                    style={{ fontSize: fontSize - 1, color: textColor }}
                    onBlur={(e) => commitAttrEdit(attr.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        commitAttrEdit(attr.id, (e.target as HTMLInputElement).value);
                    }}
                  />
                ) : (
                  <span
                    className={`truncate ${attr.isKey ? "underline font-semibold" : ""}`}
                    style={{ fontSize: fontSize - 1, color: textColor }}
                  >
                    {attr.name}
                  </span>
                )}
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
