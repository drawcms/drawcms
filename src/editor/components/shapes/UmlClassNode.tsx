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

interface ListItem {
  id: string;
  text: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function UmlClassNode({ id, data, selected }: { id: string; data: any; selected: boolean }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [editingHeader, setEditingHeader] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<"attributes" | "methods" | null>(null);
  const callbacks = useNodeCallbacks();
  const {
    isGlobalAnimating,
    isPreviewingSelected,
    selectedNodeId,
    activeStoryNodeIds,
    isStoryStepPlaying,
  } = useAnimationState();

  const label: string = data?.label || "ClassName";
  const stereotype: string = data?.stereotype || "";
  const attributes: ListItem[] = data?.attributes || [];
  const methods: ListItem[] = data?.methods || [];
  const fillColor: string = data?.fillColor || "white";
  const strokeColor: string = data?.strokeColor || "#4b5563";
  const headerColor: string = data?.headerColor || "#dbeafe";
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
  const isObject = data?.type === "uml-object";

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

  function commitItemEdit(section: "attributes" | "methods", itemId: string, value: string) {
    setEditingItemId(null);
    setEditingSection(null);
    if (callbacks?.onUpdateList) {
      const list = section === "attributes" ? attributes : methods;
      const updated = list.map((item) => (item.id === itemId ? { ...item, text: value } : item));
      callbacks.onUpdateList(id, section, updated);
    }
  }

  const rowHeight = Math.max(22, fontSize + 10);
  const headerHeight = Math.max(32, fontSize + 20);

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
          {/* Header - class name */}
          <div
            className="flex flex-col items-center justify-center border-b px-2"
            style={{
              backgroundColor: storyHeaderColor,
              borderColor: storyDividerColor,
              minHeight: headerHeight,
              fontSize,
              color: textColor,
            }}
            onDoubleClick={() => setEditingHeader(true)}
          >
            {stereotype && (
              <span className="text-gray-400 italic" style={{ fontSize: fontSize - 2 }}>
                &laquo;{stereotype}&raquo;
              </span>
            )}
            <EditableNodeLabel
              value={label}
              isEditing={editingHeader}
              onCommit={commitHeaderEdit}
              onCancel={() => setEditingHeader(false)}
              ariaLabel="Edit class name"
              className="min-h-5"
              displayClassName={`font-bold ${isObject ? "underline" : ""}`}
              editorClassName="min-h-16 font-bold"
              style={{ fontSize, color: textColor, textAlign: "center" }}
              fitText={false}
            />
          </div>

          {/* Attributes section */}
          <div className="border-b" style={{ borderColor: storyDividerColor }}>
            {attributes.length === 0 ? (
              <div
                className="text-center py-1.5 text-gray-300 italic"
                style={{ fontSize: fontSize - 2 }}
              >
                &mdash;
              </div>
            ) : (
              attributes.map((item) => (
                <div
                  key={item.id}
                  className="px-2 flex items-center"
                  style={{ height: rowHeight, fontSize: fontSize - 1, color: textColor }}
                  onDoubleClick={() => {
                    setEditingItemId(item.id);
                    setEditingSection("attributes");
                  }}
                >
                  {editingItemId === item.id && editingSection === "attributes" ? (
                    <input
                      autoFocus
                      defaultValue={item.text}
                      className="w-full bg-transparent outline-none"
                      style={{ fontSize: fontSize - 1, color: textColor }}
                      onBlur={(e) => commitItemEdit("attributes", item.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          commitItemEdit(
                            "attributes",
                            item.id,
                            (e.target as HTMLInputElement).value,
                          );
                      }}
                    />
                  ) : (
                    <span className="truncate font-mono" style={{ fontSize: fontSize - 1 }}>
                      {item.text}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Methods section */}
          <div>
            {methods.length === 0 ? (
              <div
                className="text-center py-1.5 text-gray-300 italic"
                style={{ fontSize: fontSize - 2 }}
              >
                &mdash;
              </div>
            ) : (
              methods.map((item) => (
                <div
                  key={item.id}
                  className="px-2 flex items-center"
                  style={{ height: rowHeight, fontSize: fontSize - 1, color: textColor }}
                  onDoubleClick={() => {
                    setEditingItemId(item.id);
                    setEditingSection("methods");
                  }}
                >
                  {editingItemId === item.id && editingSection === "methods" ? (
                    <input
                      autoFocus
                      defaultValue={item.text}
                      className="w-full bg-transparent outline-none"
                      style={{ fontSize: fontSize - 1, color: textColor }}
                      onBlur={(e) => commitItemEdit("methods", item.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          commitItemEdit("methods", item.id, (e.target as HTMLInputElement).value);
                      }}
                    />
                  ) : (
                    <span className="truncate font-mono" style={{ fontSize: fontSize - 1 }}>
                      {item.text}
                    </span>
                  )}
                </div>
              ))
            )}
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
