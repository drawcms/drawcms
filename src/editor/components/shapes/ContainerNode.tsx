"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import { ShapeBackground } from "./ShapeBackground";
import { useNodeCallbacks, useAnimationState } from "../../contexts";
import type { AppNodeData } from "../../types";
import { STORY_ACTIVE_FILL, STORY_ACTIVE_STROKE } from "../../story/highlight";
import { SEMANTIC_CONTAINER_TYPES, SEQUENCE_NODE_TYPES } from "./semantic-elements";
import { EditableNodeLabel } from "../EditableNodeLabel";
import gsap from "gsap";

export function ContainerNode({
  id,
  data,
  selected,
}: {
  id: string;
  data: AppNodeData;
  selected: boolean;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const callbacks = useNodeCallbacks();
  const {
    isGlobalAnimating,
    isPreviewingSelected,
    selectedNodeId,
    activeStoryNodeIds,
    isStoryStepPlaying,
  } = useAnimationState();

  const label: string = data?.label || "Group";
  const shapeType: string = data?.type || "group";
  const isSemanticContainer = SEMANTIC_CONTAINER_TYPES.has(shapeType);
  const isSequenceNode = SEQUENCE_NODE_TYPES.has(shapeType);
  const isSemanticBoundary = shapeType.startsWith("boundary-");
  const fillColor = (data?.fillColor as string) || "#ffffff";
  const strokeColor = (data?.strokeColor as string) || "#666666";
  const strokeWidth = String(data?.strokeWidth || 1);
  const opacity = (data?.opacity as number) ?? 1;
  const fontSize = (data?.fontSize as number) || 12;
  const textColor = (data?.textColor as string) || "#1f2937";
  const borderRadius = data?.borderRadius as number | undefined;
  const headerColor = (data?.headerColor as string) || undefined;
  const preset = data?.preset;
  const isStoryTarget = activeStoryNodeIds.includes(id);
  const storyFillColor = isStoryTarget ? STORY_ACTIVE_FILL : fillColor;
  const storyStrokeColor = isStoryTarget ? STORY_ACTIVE_STROKE : strokeColor;
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
      gsap.to(node, {
        y: -15,
        duration: 0.4,
        yoyo: true,
        repeat: -1,
        ease: "power1.inOut",
      });
    } else if (preset === "Pulse Node") {
      gsap.to(node, {
        scale: 1.05,
        duration: 0.6,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
    }
  }, [preset, isAnimating]);

  const commitEdit = useCallback(
    (value: string) => {
      setIsEditing(false);
      callbacks?.onLabelChange(id, value);
    },
    [callbacks, id],
  );

  return (
    <>
      <NodeResizer
        isVisible={selected && !data?.locked}
        minWidth={120}
        minHeight={80}
        handleClassName={isSequenceNode ? "dm-sequence-resize-handle" : undefined}
        lineClassName={isSequenceNode ? "dm-sequence-resize-line" : undefined}
      />
      <div ref={nodeRef} style={{ opacity }} className="relative w-full h-full">
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

        {/* Simple and semantic boundaries use CSS so their border remains crisp
            at any resize. Structured containers keep their SVG artwork. */}
        {shapeType === "group" || shapeType === "dashed-box" || isSemanticBoundary ? (
          <div
            className="absolute inset-0 pointer-events-none"
            data-story-active={isStoryTarget ? "true" : undefined}
            style={{
              backgroundColor: storyFillColor,
              borderWidth:
                shapeType === "boundary-trust"
                  ? Math.max(2, Number(strokeWidth))
                  : Number(strokeWidth),
              borderStyle:
                shapeType === "dashed-box" ||
                shapeType === "boundary-security-group" ||
                shapeType === "boundary-trust" ||
                shapeType === "boundary-data"
                  ? "dashed"
                  : shapeType === "boundary-deployment"
                    ? "dotted"
                    : "solid",
              borderColor: storyStrokeColor,
              borderRadius: borderRadius ?? (shapeType === "group" ? 8 : 6),
            }}
          />
        ) : (
          <svg
            className="dm-node-shape absolute inset-0 w-full h-full pointer-events-none overflow-visible"
            data-story-active={isStoryTarget ? "true" : undefined}
            viewBox="-2 -2 104 104"
            preserveAspectRatio="none"
          >
            <ShapeBackground
              type={shapeType}
              fill={storyFillColor}
              stroke={storyStrokeColor}
              strokeWidth={strokeWidth}
            />
          </svg>
        )}

        {/* Label — group uses a draw.io-style tab at top-left; others use plain text */}
        {shapeType === "group" ? (
          <div
            className="absolute z-10 left-0 min-w-28 max-w-[70%] px-2 py-1 font-semibold"
            style={{
              top: -(Number(strokeWidth) || 1),
              left: -(Number(strokeWidth) || 1),
              backgroundColor: isStoryTarget ? STORY_ACTIVE_STROKE : headerColor || "#4a90d9",
              color: textColor === "#1f2937" ? "#ffffff" : textColor,
              fontSize,
              borderRadius: `${borderRadius ?? 8}px 0 ${borderRadius ?? 8}px 0`,
            }}
            onDoubleClick={() => setIsEditing(true)}
          >
            <EditableNodeLabel
              value={label}
              isEditing={isEditing}
              onCommit={commitEdit}
              onCancel={() => setIsEditing(false)}
              ariaLabel="Edit group label"
              editorClassName="min-h-16 min-w-48 text-left"
              displayClassName="font-semibold"
              style={{ fontSize, color: "inherit", textAlign: "left" }}
              fitText={false}
            />
          </div>
        ) : (
          <div
            className={`absolute z-10 left-2 top-1.5 min-h-7 overflow-hidden ${isSemanticContainer ? "rounded px-1" : ""}`}
            style={{
              maxWidth: "90%",
              maxHeight: isEditing ? "none" : "45%",
              ...(isSemanticContainer
                ? { backgroundColor: isStoryTarget ? STORY_ACTIVE_FILL : headerColor || fillColor }
                : {}),
            }}
            onDoubleClick={() => setIsEditing(true)}
          >
            <EditableNodeLabel
              value={label}
              isEditing={isEditing}
              onCommit={commitEdit}
              onCancel={() => setIsEditing(false)}
              ariaLabel={`Edit ${shapeType} label`}
              editorClassName="min-h-16 min-w-48 text-left"
              displayClassName="font-semibold"
              style={{ fontSize, color: textColor, textAlign: "left" }}
              fitText={false}
            />
          </div>
        )}

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
