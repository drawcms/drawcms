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

interface Lane {
  id: string;
  name: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SwimlaneNode({ id, data, selected }: { id: string; data: any; selected: boolean }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [editingLaneId, setEditingLaneId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const callbacks = useNodeCallbacks();
  const {
    isGlobalAnimating,
    isPreviewingSelected,
    selectedNodeId,
    activeStoryNodeIds,
    isStoryStepPlaying,
  } = useAnimationState();

  const label: string = data?.label || "Pool";
  const shapeType: string = data?.type || "swimlane-h";
  const lanes: Lane[] = data?.lanes || [
    { id: "1", name: "Lane 1" },
    { id: "2", name: "Lane 2" },
  ];
  const fillColor = (data?.fillColor as string) || "white";
  const strokeColor = (data?.strokeColor as string) || "#4b5563";
  const strokeWidth = (data?.strokeWidth as number) || 1;
  const opacity = (data?.opacity as number) ?? 1;
  const fontSize = (data?.fontSize as number) || 11;
  const textColor = (data?.textColor as string) || "#1f2937";
  const preset = data?.preset;
  const isHorizontal = shapeType === "swimlane-h" || shapeType === "bpmn-pool";
  const isPool = shapeType === "bpmn-pool";
  const isStoryTarget = activeStoryNodeIds.includes(id);
  const storyStrokeColor = isStoryTarget ? STORY_ACTIVE_STROKE : strokeColor;
  const storyFillColor = isStoryTarget ? STORY_ACTIVE_FILL : fillColor;
  const storyHeaderColor = isStoryTarget ? STORY_ACTIVE_HEADER : isPool ? "#e5e7eb" : "#f3f4f6";
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
    if (preset === "Pulse Node") {
      gsap.to(node, { scale: 1.05, duration: 0.6, yoyo: true, repeat: -1, ease: "sine.inOut" });
    }
  }, [preset, isAnimating]);

  function commitTitleEdit(value: string) {
    setEditingTitle(false);
    callbacks?.onLabelChange(id, value);
  }

  function commitLaneEdit(laneId: string, value: string) {
    setEditingLaneId(null);
    if (callbacks?.onUpdateLanes) {
      const updated = lanes.map((l) => (l.id === laneId ? { ...l, name: value } : l));
      callbacks.onUpdateLanes(id, updated);
    }
  }

  const headerSize = isPool ? 30 : 24;

  if (isHorizontal) {
    return (
      <>
        <NodeResizer isVisible={selected && !data?.locked} minWidth={200} minHeight={100} />
        <div
          ref={nodeRef}
          data-story-active={isStoryTarget ? "true" : undefined}
          style={{
            opacity,
            borderColor: storyStrokeColor,
            borderWidth: strokeWidth,
            backgroundColor: storyFillColor,
          }}
          className="relative w-full h-full flex border rounded-sm bg-white"
        >
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

          {/* Header column on left */}
          <div
            className="shrink-0 flex items-center justify-center border-r"
            style={{
              width: headerSize,
              borderColor: storyDividerColor,
              backgroundColor: storyHeaderColor,
            }}
            onDoubleClick={() => setEditingTitle(true)}
          >
            <EditableNodeLabel
              value={label}
              isEditing={editingTitle}
              onCommit={commitTitleEdit}
              onCancel={() => setEditingTitle(false)}
              ariaLabel="Edit swimlane title"
              displayClassName="font-semibold"
              editorClassName="min-h-24"
              style={{
                fontSize,
                color: textColor,
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                textAlign: "center",
              }}
            />
          </div>

          {/* Lanes area - stacked vertically */}
          <div className="flex-1 flex flex-col" style={{ backgroundColor: storyFillColor }}>
            {lanes.map((lane, i) => (
              <div
                key={lane.id}
                className={`flex-1 relative ${i < lanes.length - 1 ? "border-b" : ""}`}
                style={{ borderColor: storyDividerColor }}
              >
                <div
                  className="absolute left-2 top-1 z-10"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingLaneId(lane.id);
                  }}
                >
                  {editingLaneId === lane.id ? (
                    <input
                      autoFocus
                      defaultValue={lane.name}
                      className="rounded bg-card/90 px-1 text-xs text-foreground outline-none ring-1 ring-ring"
                      style={{ fontSize: fontSize - 1, color: textColor }}
                      onBlur={(e) => commitLaneEdit(lane.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          commitLaneEdit(lane.id, (e.target as HTMLInputElement).value);
                      }}
                    />
                  ) : (
                    <span
                      className="text-xs text-gray-400 italic"
                      style={{ fontSize: fontSize - 1 }}
                    >
                      {lane.name}
                    </span>
                  )}
                </div>
              </div>
            ))}
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

  // Vertical swimlane: header row on top, lanes side by side
  return (
    <>
      <NodeResizer isVisible={selected && !data?.locked} minWidth={200} minHeight={100} />
      <div
        ref={nodeRef}
        data-story-active={isStoryTarget ? "true" : undefined}
        style={{
          opacity,
          borderColor: storyStrokeColor,
          borderWidth: strokeWidth,
          backgroundColor: storyFillColor,
        }}
        className="relative w-full h-full flex flex-col border rounded-sm bg-white"
      >
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

        {/* Header row on top */}
        <div
          className="shrink-0 flex items-center justify-center border-b"
          style={{
            minHeight: headerSize,
            borderColor: storyDividerColor,
            backgroundColor: storyHeaderColor,
          }}
          onDoubleClick={() => setEditingTitle(true)}
        >
          <EditableNodeLabel
            value={label}
            isEditing={editingTitle}
            onCommit={commitTitleEdit}
            onCancel={() => setEditingTitle(false)}
            ariaLabel="Edit swimlane title"
            className="min-h-6"
            displayClassName="font-semibold"
            editorClassName="min-h-16 font-semibold"
            style={{ fontSize, color: textColor, textAlign: "center" }}
            fitText={false}
          />
        </div>

        {/* Lane columns */}
        <div className="flex-1 flex" style={{ backgroundColor: storyFillColor }}>
          {lanes.map((lane, i) => (
            <div
              key={lane.id}
              className={`flex-1 relative ${i < lanes.length - 1 ? "border-r" : ""}`}
              style={{ borderColor: storyDividerColor }}
            >
              <div
                className="absolute left-1/2 -translate-x-1/2 top-1 z-10"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingLaneId(lane.id);
                }}
              >
                {editingLaneId === lane.id ? (
                  <input
                    autoFocus
                    defaultValue={lane.name}
                    className="rounded bg-card/90 px-1 text-center text-xs text-foreground outline-none ring-1 ring-ring"
                    style={{ fontSize: fontSize - 1, color: textColor }}
                    onBlur={(e) => commitLaneEdit(lane.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        commitLaneEdit(lane.id, (e.target as HTMLInputElement).value);
                    }}
                  />
                ) : (
                  <span className="text-xs text-gray-400 italic" style={{ fontSize: fontSize - 1 }}>
                    {lane.name}
                  </span>
                )}
              </div>
            </div>
          ))}
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
