"use client";

import React, { useMemo, useRef, useEffect, useLayoutEffect, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  useReactFlow,
  Panel,
  Handle,
  Position,
  NodeResizer,
  ConnectionMode,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type ReactFlowInstance,
  type Node,
} from "@xyflow/react";
import { CustomEdge } from "./CustomEdge";
import { EditableNodeLabel } from "./EditableNodeLabel";
import { ChatGptButton } from "./ChatGptButton";
import { TextNode } from "./TextNode";
import { ShapeBackground } from "./shapes/ShapeBackground";
import { SequenceLifelineArtwork } from "./shapes/SequenceLifelineArtwork";
import { TableNode } from "./shapes/TableNode";
import { UmlClassNode } from "./shapes/UmlClassNode";
import { EntityNode } from "./shapes/EntityNode";
import { ContainerNode } from "./shapes/ContainerNode";
import { SwimlaneNode } from "./shapes/SwimlaneNode";
import { useNodeCallbacks, useAnimationState } from "../contexts";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { isCloudIconType, getCloudIcon } from "./shapes/cloud-icons";
import { ImageCropDialog } from "./ImageCropDialog";
import { ListOrdered } from "lucide-react";
import type { SequenceEdgeToolState } from "../hooks/useEditorState";
import {
  SEQUENCE_LIFELINE_TYPES,
  SEQUENCE_ROW_COUNT,
  SEQUENCE_ROW_START_PERCENT,
  SEQUENCE_ROW_STEP_PERCENT,
  sequenceRowHandle,
} from "../sequence-edges";
import type { StoryTarget } from "../story/model";
import { STORY_ACTIVE_FILL, STORY_ACTIVE_STROKE, STORY_ACTIVE_TEXT } from "../story/highlight";
import { ALL_CONTAINER_TYPES } from "../constants";
import { sanitizeIconBody } from "../io/iconify";
import type { AppEdge, AppNode } from "../types";
import {
  getSemanticLabelPlacement,
  SEQUENCE_NODE_TYPES,
  SEMANTIC_STRETCH_ARTWORK_TYPES,
  SEMANTIC_TEXT_BELOW_TYPES,
} from "./shapes/semantic-elements";
/* eslint-disable @next/next/no-img-element */
import gsap from "gsap";

const EMPTY_STORY_TARGETS: StoryTarget[] = [];
const DEFAULT_TEXT_COLOR = "#1f2937";
const THEME_INK = "var(--drawcms-ink)";

// Existing documents store text as `customShape`. Dispatch by semantic type so
// they gain the dedicated text editor without requiring a document migration.
const CanvasCustomNode = (props: {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  selected: boolean;
}) => (props.data.type === "text" ? <TextNode {...props} /> : <CustomShapeNode {...props} />);

type ArtworkHandleStyles = Record<"top" | "left" | "right" | "bottom", React.CSSProperties>;

const DEFAULT_ARTWORK_HANDLE_STYLES: ArtworkHandleStyles = {
  top: { left: "50%", top: "40%", transform: "translate(-50%, -50%)" },
  left: { left: "20%", top: "60%", right: "auto", transform: "translate(-50%, -50%)" },
  right: { left: "90%", top: "60%", right: "auto", transform: "translate(-50%, -50%)" },
  bottom: { left: "50%", top: "90%", bottom: "auto", transform: "translate(-50%, -50%)" },
};

function CloudConnector({
  id,
  position,
  style,
}: {
  id: keyof ArtworkHandleStyles;
  position: Position;
  style: React.CSSProperties;
}) {
  return (
    <>
      <Handle
        type="source"
        position={position}
        id={id}
        style={style}
        className={`dm-cloud-handle dm-cloud-handle-${id}`}
      />
      <span aria-hidden="true" className="dm-cloud-handle-visual" style={style} />
    </>
  );
}

function SequenceLifelineHandles() {
  return Array.from({ length: SEQUENCE_ROW_COUNT }, (_, index) => {
    const row = index + 1;
    const top = SEQUENCE_ROW_START_PERCENT + index * SEQUENCE_ROW_STEP_PERCENT;
    return (
      <Handle
        key={row}
        type="source"
        position={Position.Right}
        id={sequenceRowHandle(row)}
        aria-label={`Sequence message row ${row}`}
        className="dm-sequence-row-handle"
        style={{ left: "50%", right: "auto", top: `${top}%` }}
      />
    );
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomShapeNode = ({ id, data, selected }: { id: string; data: any; selected: boolean }) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const visualAreaRef = useRef<HTMLDivElement>(null);
  const [artworkHandleStyles, setArtworkHandleStyles] = useState(DEFAULT_ARTWORK_HANDLE_STYLES);
  const [isEditing, setIsEditing] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const callbacks = useNodeCallbacks();
  const {
    isGlobalAnimating,
    isPreviewingSelected,
    selectedNodeId,
    activeStoryNodeIds,
    isStoryStepPlaying,
  } = useAnimationState();
  const preset = data?.preset;
  const isStoryTarget = activeStoryNodeIds.includes(id);
  const isAnimating =
    isGlobalAnimating ||
    (isPreviewingSelected && id === selectedNodeId) ||
    (isStoryStepPlaying && isStoryTarget);

  // Style props with defaults
  const fillColor = (data?.fillColor as string) || "white";
  const strokeColor = (data?.strokeColor as string) || "#4b5563";
  const strokeWidth = String(data?.strokeWidth || 1);
  const storyFillColor =
    isStoryTarget && fillColor !== "transparent" && fillColor !== "none"
      ? STORY_ACTIVE_FILL
      : fillColor;
  const storyStrokeColor = isStoryTarget ? STORY_ACTIVE_STROKE : strokeColor;
  const opacity = (data?.opacity as number) ?? 1;
  const fontSize = (data?.fontSize as number) || 14;
  const fontWeight = (data?.fontWeight as string) || "500";
  const textColor = (data?.textColor as string) || DEFAULT_TEXT_COLOR;
  const textAlign = (data?.textAlign as string) || "center";
  const isSequenceNode = SEQUENCE_NODE_TYPES.has(data.type as string);
  const isSequenceLifeline = SEQUENCE_LIFELINE_TYPES.has(String(data.type));

  // Shapes where text goes below the shape (like draw.io)
  const textBelowTypes = new Set([
    "actor",
    "image",
    "cylinder",
    "database",
    "cloud",
    "star",
    "uml-interface",
    "bpmn-start",
    "bpmn-end",
    "bpmn-intermediate",
    "triangle",
    "cross",
    "pentagon",
    "octagon",
    "er-relationship",
    "er-weak-relationship",
    "bpmn-gateway-exclusive",
    "bpmn-gateway-parallel",
    "bpmn-gateway-inclusive",
  ]);
  const hasCustomImage = data.type === "image" && data.imageUrl;
  const isIconNode = data.type === "icon" && typeof data.iconBody === "string";
  // Stored icon bodies re-enter the app from files, storage, and hosts —
  // re-apply the SVG trust boundary at render time (DM-SEC-1).
  const sanitizedIconBody = useMemo(
    () => (isIconNode ? sanitizeIconBody(String(data.iconBody)) : ""),
    [isIconNode, data.iconBody],
  );
  const isCloudShape = data.type === "cloud";
  const semanticLabelPlacement = getSemanticLabelPlacement(data.type as string);
  const semanticLabelClassName =
    data.type === "sequence-note"
      ? "absolute bottom-[10%] left-[12%] right-[10%] top-[20%] z-10 flex items-center justify-center overflow-hidden text-center"
      : data.type === "sequence-reference"
        ? "absolute bottom-[10%] left-[10%] right-[10%] top-[36%] z-10 flex items-center justify-center overflow-hidden text-center"
        : data.type === "text"
          ? "absolute inset-0 z-10 flex items-center justify-center overflow-hidden text-center"
          : semanticLabelPlacement === "participant-header"
            ? "absolute left-[4%] right-[4%] top-[4%] z-10 flex justify-center overflow-hidden text-center"
            : semanticLabelPlacement === "actor-header"
              ? "absolute left-[4%] right-[4%] top-[29%] z-10 flex justify-center overflow-hidden text-center"
              : semanticLabelPlacement === "message-header"
                ? "absolute left-[4%] right-[4%] top-[5%] z-10 flex justify-center overflow-hidden text-center"
                : semanticLabelPlacement === "badge-body"
                  ? "absolute bottom-[8%] left-[32%] right-[7%] top-[8%] z-10 flex items-center justify-center overflow-hidden text-center"
                  : semanticLabelPlacement === "card-header"
                    ? "absolute left-[9%] right-[9%] top-[7%] z-10 flex h-[22%] items-center justify-center overflow-hidden text-center"
                    : "absolute inset-[10%] z-10 flex items-center justify-center overflow-hidden text-center";
  const isTextBelow =
    !hasCustomImage &&
    (textBelowTypes.has(data.type as string) ||
      SEMANTIC_TEXT_BELOW_TYPES.has(data.type as string) ||
      isCloudIconType(data.type as string));
  // Labels beneath a symbol (and sequence actors) are drawn against the
  // canvas, unlike labels inside a filled node. Let the default color follow
  // the host theme while preserving every explicit diagram color.
  const canvasLabelTextColor =
    textColor === DEFAULT_TEXT_COLOR && (isTextBelow || data.type === "sequence-actor")
      ? THEME_INK
      : textColor;
  const storyTextColor =
    isStoryTarget && data.type === "text" ? STORY_ACTIVE_TEXT : canvasLabelTextColor;

  // Text-below symbols preserve their artwork aspect ratio inside a wider resize
  // frame. Measure the painted SVG bounds so connectors meet the visible symbol
  // instead of stopping at the frame edge.
  useLayoutEffect(() => {
    if (!isTextBelow || hasCustomImage || isCloudIconType(data.type as string)) return;
    const visualArea = visualAreaRef.current;
    if (!visualArea) return;

    const updateHandlePositions = () => {
      const svg = visualArea.querySelector<SVGSVGElement>(".dm-node-shape");
      if (!svg) return;

      const areaRect = visualArea.getBoundingClientRect();
      const paintedRects = Array.from(svg.children)
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 || rect.height > 0);
      if (!areaRect.width || !areaRect.height || paintedRects.length === 0) return;

      const artworkRect = paintedRects.reduce(
        (bounds, rect) => ({
          left: Math.min(bounds.left, rect.left),
          right: Math.max(bounds.right, rect.right),
          top: Math.min(bounds.top, rect.top),
          bottom: Math.max(bounds.bottom, rect.bottom),
        }),
        {
          left: paintedRects[0].left,
          right: paintedRects[0].right,
          top: paintedRects[0].top,
          bottom: paintedRects[0].bottom,
        },
      );

      const percent = (value: number, total: number) =>
        `${Math.max(0, Math.min(100, (value / total) * 100))}%`;
      const artworkLeft = artworkRect.left - areaRect.left;
      const artworkTop = artworkRect.top - areaRect.top;
      const artworkRight = artworkRect.right - areaRect.left;
      const artworkBottom = artworkRect.bottom - areaRect.top;
      const artworkCenterX = (artworkLeft + artworkRight) / 2;
      const artworkCenterY = (artworkTop + artworkBottom) / 2;
      const next: ArtworkHandleStyles = {
        top: {
          left: percent(artworkCenterX, areaRect.width),
          top: percent(artworkTop, areaRect.height),
          transform: "translate(-50%, -50%)",
        },
        left: {
          left: percent(artworkLeft, areaRect.width),
          top: percent(artworkCenterY, areaRect.height),
          right: "auto",
          transform: "translate(-50%, -50%)",
        },
        right: {
          left: percent(artworkRight, areaRect.width),
          top: percent(artworkCenterY, areaRect.height),
          right: "auto",
          transform: "translate(-50%, -50%)",
        },
        bottom: {
          left: percent(artworkCenterX, areaRect.width),
          top: percent(artworkBottom, areaRect.height),
          bottom: "auto",
          transform: "translate(-50%, -50%)",
        },
      };

      setArtworkHandleStyles((current) => {
        const unchanged = (key: keyof ArtworkHandleStyles) =>
          current[key].left === next[key].left &&
          current[key].top === next[key].top &&
          current[key].right === next[key].right &&
          current[key].bottom === next[key].bottom &&
          current[key].transform === next[key].transform;
        return (Object.keys(next) as Array<keyof ArtworkHandleStyles>).every(unchanged)
          ? current
          : next;
      });
    };

    updateHandlePositions();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateHandlePositions);
    observer.observe(visualArea);
    const svg = visualArea.querySelector<SVGSVGElement>(".dm-node-shape");
    if (svg) observer.observe(svg);
    return () => observer.disconnect();
  }, [data.type, hasCustomImage, isTextBelow]);

  const motionSpeed = (data?.motionSpeed as number) || 0.25;
  const motionLoop = (data?.motionLoop as boolean) ?? true;

  useEffect(() => {
    if (!nodeRef.current) return;
    const node = nodeRef.current;
    gsap.killTweensOf(node);
    gsap.set(node, { clearProps: "all" });
    if (!isAnimating) return;
    const r = motionLoop ? -1 : 0;
    if (preset === "Bounce") {
      gsap.to(node, {
        y: -15,
        duration: 0.4 / motionSpeed,
        yoyo: true,
        repeat: r,
        ease: "power1.inOut",
      });
    } else if (preset === "Spin") {
      gsap.to(node, { rotation: 360, duration: 2 / motionSpeed, repeat: r, ease: "linear" });
    } else if (preset === "Pulse Node") {
      gsap.to(node, {
        scale: 1.1,
        duration: 0.6 / motionSpeed,
        yoyo: true,
        repeat: r,
        ease: "sine.inOut",
      });
    } else if (preset === "Shake") {
      gsap.to(node, {
        x: 5,
        duration: 0.1 / motionSpeed,
        yoyo: true,
        repeat: r,
        ease: "sine.inOut",
      });
    }
  }, [preset, isAnimating, motionSpeed, motionLoop]);

  const commitEdit = useCallback(
    (value: string) => {
      setIsEditing(false);
      callbacks?.onLabelChange(id, value);
    },
    [callbacks, id],
  );

  // ── Crop: original image stored for re-editing, cropped image displayed ──
  const originalImageUrl = (data._originalImageUrl as string) || "";
  const hasCrop = !!data.cropW;

  const handleDoubleClick = useCallback(() => {
    if (hasCustomImage) {
      setShowCropDialog(true);
    } else if (!isIconNode) {
      setIsEditing(true);
    }
  }, [hasCustomImage, isIconNode]);

  // The Cloud outline is inset inside its resize frame. Keep only its unused
  // frame transparent to pointer input so an edge beneath it remains selectable.
  // Selection therefore comes from the visible Cloud artwork.
  const handleVisualSelect = useCallback(
    (event: React.MouseEvent<HTMLElement | SVGElement>) => {
      const onSelectNode = callbacks?.onSelectNode;
      if (!onSelectNode) return;
      event.stopPropagation();
      onSelectNode(id, { additive: event.metaKey || event.ctrlKey || event.shiftKey });
    },
    [callbacks, id],
  );

  const handleVisualDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLElement | SVGElement>) => {
      event.stopPropagation();
      handleDoubleClick();
    },
    [handleDoubleClick],
  );

  const handleCropApply = useCallback(
    (result: {
      croppedImageUrl: string;
      cropX: number;
      cropY: number;
      cropW: number;
      cropH: number;
      _naturalW: number;
      _naturalH: number;
    }) => {
      // Save original image URL (if not already saved), swap display to cropped version
      const origUrl = originalImageUrl || (data.imageUrl as string);
      // Resize node to match crop region's aspect ratio (keep width, adjust height)
      const el = nodeRef.current;
      const currentW = el ? el.offsetWidth : 160;
      const newH = Math.round(currentW * (result.cropH / result.cropW));
      callbacks?.onStyleChange(
        id,
        {
          _originalImageUrl: origUrl,
          imageUrl: result.croppedImageUrl,
          cropX: result.cropX,
          cropY: result.cropY,
          cropW: result.cropW,
          cropH: result.cropH,
          _naturalW: result._naturalW,
          _naturalH: result._naturalH,
        },
        { width: currentW, height: newH },
      );
      setShowCropDialog(false);
    },
    [callbacks, id, originalImageUrl, data.imageUrl],
  );

  // ── Label element ──
  const labelEl = (
    <EditableNodeLabel
      value={String(data.label ?? "")}
      isEditing={isEditing}
      onCommit={commitEdit}
      onCancel={() => setIsEditing(false)}
      ariaLabel={`Edit ${String(data.type || "element")} label`}
      className={data.type === "text" ? "dm-story-text-surface" : ""}
      displayClassName={`tracking-wide ${data.type === "text" ? "text-base" : ""}`}
      style={{
        fontSize,
        fontWeight,
        color: storyTextColor,
        textAlign: textAlign as React.CSSProperties["textAlign"],
      }}
      fitText={!isTextBelow}
      allowOverflow={isTextBelow}
      storyActive={isStoryTarget && data.type === "text"}
      onClick={isCloudShape ? handleVisualSelect : undefined}
      onDoubleClick={isCloudShape ? handleVisualDoubleClick : undefined}
    />
  );

  // ── Image element — always a simple <img>, already cropped if crop was applied ──
  const imgSrc = data.imageUrl as string;
  const imgAlt = data.label as string;

  const imageElement = hasCustomImage && (
    <img
      src={imgSrc}
      alt={imgAlt}
      draggable={false}
      className="dm-story-media-surface w-full h-full object-cover"
      data-story-active={isStoryTarget ? "true" : undefined}
    />
  );

  // ── Crop dialog — always uses the original (uncropped) image for editing ──
  const dialogImageUrl = originalImageUrl || imgSrc;
  const cropDialog = showCropDialog && hasCustomImage && (
    <ImageCropDialog
      open={showCropDialog}
      onOpenChange={setShowCropDialog}
      imageUrl={dialogImageUrl}
      cropX={hasCrop ? (data.cropX as number) : undefined}
      cropY={hasCrop ? (data.cropY as number) : undefined}
      cropW={hasCrop ? (data.cropW as number) : undefined}
      cropH={hasCrop ? (data.cropH as number) : undefined}
      naturalW={(data._naturalW as number) || undefined}
      naturalH={(data._naturalH as number) || undefined}
      onApply={handleCropApply}
    />
  );

  // ── Render: text-below layout ──
  if (isTextBelow) {
    return (
      <>
        <NodeResizer
          isVisible={selected && !data?.locked}
          minWidth={40}
          minHeight={40}
          handleClassName={isSequenceNode ? "dm-sequence-resize-handle" : undefined}
          lineClassName={isSequenceNode ? "dm-sequence-resize-line" : undefined}
        />
        <div
          ref={nodeRef}
          style={{ opacity }}
          className={`relative w-full h-full flex flex-col items-center ${
            isCloudShape ? "pointer-events-none" : ""
          }`}
          onDoubleClick={isCloudShape ? undefined : handleDoubleClick}
        >
          <div
            ref={visualAreaRef}
            className="w-full relative shrink-0"
            style={{ height: "calc(100% - 22px)" }}
          >
            {isCloudShape ? (
              <>
                <CloudConnector id="top" position={Position.Top} style={artworkHandleStyles.top} />
                <CloudConnector
                  id="left"
                  position={Position.Left}
                  style={artworkHandleStyles.left}
                />
                <CloudConnector
                  id="right"
                  position={Position.Right}
                  style={artworkHandleStyles.right}
                />
                <CloudConnector
                  id="bottom"
                  position={Position.Bottom}
                  style={artworkHandleStyles.bottom}
                />
                <div className="dm-cloud-node-visual pointer-events-none absolute left-1/2 top-0 h-full w-auto max-w-full aspect-square -translate-x-1/2">
                  <svg
                    className="dm-node-shape absolute inset-0 w-full h-full drop-shadow-lg pointer-events-none overflow-visible"
                    viewBox="-2 -2 104 104"
                    preserveAspectRatio="none"
                    onClick={handleVisualSelect}
                    onDoubleClick={handleVisualDoubleClick}
                  >
                    <g
                      className="dm-node-surface"
                      onClick={handleVisualSelect}
                      onDoubleClick={handleVisualDoubleClick}
                    >
                      <ShapeBackground
                        type={data.type}
                        fill={storyFillColor}
                        stroke={storyStrokeColor}
                        strokeWidth={strokeWidth}
                        onClick={handleVisualSelect}
                        onDoubleClick={handleVisualDoubleClick}
                      />
                    </g>
                  </svg>
                </div>
              </>
            ) : data.type === "image" && data.imageUrl ? (
              <div className="absolute inset-0 w-full h-full overflow-hidden">{imageElement}</div>
            ) : isCloudIconType(data.type as string) ? (
              <img
                src={getCloudIcon(data.type as string)?.iconPath}
                alt={data.label as string}
                draggable={false}
                className="dm-story-media-surface absolute inset-0 w-full h-full object-contain drop-shadow-lg"
                data-story-active={isStoryTarget ? "true" : undefined}
              />
            ) : (
              <svg
                className="dm-node-shape absolute inset-0 w-full h-full drop-shadow-lg pointer-events-none overflow-visible"
                viewBox="-2 -2 104 104"
                preserveAspectRatio={
                  SEMANTIC_STRETCH_ARTWORK_TYPES.has(data.type as string) ? "none" : "xMidYMid meet"
                }
              >
                <ShapeBackground
                  type={data.type}
                  fill={storyFillColor}
                  stroke={storyStrokeColor}
                  strokeWidth={strokeWidth}
                />
              </svg>
            )}
          </div>

          {/* The label is painted against the canvas, not inside the shape, so it
              is taken out of the flex column entirely. In flow it competed with
              the artwork for the node's height: the artwork is the only
              shrinkable item here and its children are all absolutely
              positioned, so its min-content height is 0 and a wrapped label
              could shrink the symbol to nothing. Anchored at the same
              `calc(100% - 22px)` offset the in-flow track used, a single-line
              label is pixel-identical and extra lines grow downward past the
              node box instead. */}
          <div
            className={`absolute left-0 z-10 w-full text-center ${
              isCloudShape ? "pointer-events-none flex justify-center" : ""
            }`}
            style={{ top: "calc(100% - 22px)", minHeight: 22 }}
          >
            {isCloudShape ? <span className="dm-cloud-node-label">{labelEl}</span> : labelEl}
          </div>

          {!isCloudShape && (
            <>
              <Handle
                type="source"
                position={Position.Top}
                id="top"
                className="h-3 w-3 border-2 border-muted-foreground bg-card"
                style={artworkHandleStyles.top}
              />
              <Handle
                type="source"
                position={Position.Left}
                id="left"
                className="h-3 w-3 border-2 border-muted-foreground bg-card"
                style={artworkHandleStyles.left}
              />
              <Handle
                type="source"
                position={Position.Right}
                id="right"
                className="h-3 w-3 border-2 border-muted-foreground bg-card"
                style={artworkHandleStyles.right}
              />
              <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                className="h-3 w-3 border-2 border-muted-foreground bg-card"
                style={artworkHandleStyles.bottom}
              />
            </>
          )}
        </div>
        {cropDialog}
      </>
    );
  }

  // ── Render: regular layout ──
  return (
    <>
      <NodeResizer
        color="#0c8c5e"
        isVisible={selected && !data?.locked}
        minWidth={60}
        minHeight={40}
        handleClassName={isSequenceNode ? "dm-sequence-resize-handle" : undefined}
        lineClassName={isSequenceNode ? "dm-sequence-resize-line" : undefined}
      />
      <div
        ref={nodeRef}
        style={{ opacity }}
        className="relative w-full h-full flex items-center justify-center"
        onDoubleClick={handleDoubleClick}
      >
        <Handle
          type="source"
          position={Position.Top}
          id="top"
          className="h-3 w-3 border-2 border-muted-foreground bg-card"
        />
        {SEQUENCE_LIFELINE_TYPES.has(String(data.type)) && <SequenceLifelineHandles />}
        <Handle
          type="source"
          position={Position.Left}
          id="left"
          className="h-3 w-3 border-2 border-muted-foreground bg-card"
        />

        {isSequenceLifeline ? (
          <SequenceLifelineArtwork
            type={data.type as "sequence-actor" | "sequence-participant"}
            fill={storyFillColor}
            stroke={storyStrokeColor}
            strokeWidth={strokeWidth}
            label={labelEl}
          />
        ) : hasCustomImage ? (
          <div className="absolute inset-0 w-full h-full overflow-hidden">{imageElement}</div>
        ) : isIconNode ? (
          <svg
            className="dm-story-media-surface absolute inset-0 w-full h-full drop-shadow-lg pointer-events-none"
            viewBox={String(data.iconViewBox ?? "0 0 24 24")}
            preserveAspectRatio="xMidYMid meet"
            style={{ color: String(data.iconColor ?? "#4b5563") }}
            dangerouslySetInnerHTML={{ __html: sanitizedIconBody }}
            data-story-active={isStoryTarget ? "true" : undefined}
          />
        ) : (
          <svg
            className="dm-node-shape absolute inset-0 w-full h-full drop-shadow-lg pointer-events-none overflow-visible"
            viewBox="-2 -2 104 104"
            preserveAspectRatio="none"
          >
            <ShapeBackground
              type={data.type}
              fill={storyFillColor}
              stroke={storyStrokeColor}
              strokeWidth={strokeWidth}
            />
          </svg>
        )}

        {!hasCustomImage && !isIconNode && !isSequenceLifeline && (
          <div className={semanticLabelClassName}>{labelEl}</div>
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
      {cropDialog}
    </>
  );
};

interface DiagramCanvasProps {
  nodes: AppNode[];
  edges: AppEdge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  /** Called only for an intentional canvas/node/edge click, not selection bookkeeping. */
  onCanvasSelectionIntent?: () => void;
  /** Called when the user clicks unoccupied canvas space. */
  onBlankCanvasClick?: () => void;
  /** Right-click on a node, edge, or the pane. Coordinates are viewport px. */
  onRequestContextMenu?: (request: {
    x: number;
    y: number;
    kind: "node" | "edge" | "pane";
    /** Flow-space position for pane actions such as "add node here". */
    flowPosition?: { x: number; y: number };
    targets: StoryTarget[];
  }) => void;
  onOpenSteps?: () => void;
  onAddNode?: (
    type: string,
    title: string,
    position: { x: number; y: number },
    parentId?: string,
  ) => void;
  onNodeDragStop?: (nodeId: string, position: { x: number; y: number }) => void;
  /** Plugin-contributed renderers, merged over the built-in registries. */
  extraNodeTypes?: Record<string, React.ComponentType>;
  extraEdgeTypes?: Record<string, React.ComponentType>;
  /** Disables every authoring gesture while preserving pan and zoom. */
  readOnly?: boolean;
  /** Ephemeral presentation targets rendered with a visible highlight. */
  activeStoryTargets?: StoryTarget[];
  /** One-shot message connector selected from the Sequence palette. */
  activeSequenceEdgeTool?: SequenceEdgeToolState | null;
  onSequenceEdgeNodeClick?: (nodeId: string) => boolean;
  onCancelSequenceEdgeTool?: () => void;
  /** Smallest camera zoom. Viewer thumbnails may opt below the editor default. */
  minZoom?: number;
  /** Enables the "Generate with ChatGPT" WebMCP deep link in the canvas controls. */
  webMcp?: boolean;
}

function CanvasControls({ onOpenSteps }: { onOpenSteps?: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const reducedMotion = useReducedMotion();
  // Instant camera moves under prefers-reduced-motion (DM-032).
  const zoomDuration = reducedMotion ? 0 : 200;

  const btnCls =
    "flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

  return (
    <Panel position="bottom-center" className="!mb-3">
      <div
        role="group"
        aria-label="Canvas controls"
        className="flex flex-row overflow-hidden rounded-lg border border-border bg-card"
      >
        <button
          onClick={() => zoomIn({ duration: zoomDuration })}
          className={btnCls}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <div className="w-px bg-border" />
        <button
          onClick={() => zoomOut({ duration: zoomDuration })}
          className={btnCls}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <div className="w-px bg-border" />
        <button
          onClick={() => fitView({ padding: 0.2, duration: reducedMotion ? 0 : 300 })}
          className={btnCls}
          title="Fit all elements"
          aria-label="Fit all elements"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 7V2h5" />
            <path d="M22 7V2h-5" />
            <path d="M2 17v5h5" />
            <path d="M22 17v5h-5" />
            <rect x="7" y="7" width="10" height="10" rx="1" />
          </svg>
        </button>
        {onOpenSteps && (
          <>
            <div className="w-px bg-border" />
            <button
              type="button"
              onClick={onOpenSteps}
              className="flex h-10 items-center justify-center gap-2 px-3 text-xs font-semibold text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              title="Open presentation steps"
              aria-label="Open presentation steps"
            >
              <ListOrdered size={16} aria-hidden="true" />
              Steps
            </button>
          </>
        )}
      </div>
    </Panel>
  );
}

export function DiagramCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  setSelectedNodeId,
  setSelectedEdgeId,
  onCanvasSelectionIntent,
  onBlankCanvasClick,
  onRequestContextMenu,
  onOpenSteps,
  onAddNode,
  onNodeDragStop,
  extraNodeTypes,
  extraEdgeTypes,
  readOnly = false,
  activeStoryTargets = EMPTY_STORY_TARGETS,
  activeSequenceEdgeTool = null,
  onSequenceEdgeNodeClick,
  onCancelSequenceEdgeTool,
  minZoom = 0.5,
  webMcp = false,
}: DiagramCanvasProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reactFlowRef = useRef<ReactFlowInstance<any, any> | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fitViewOptions = useMemo(
    () => (readOnly ? { padding: 0.2, minZoom } : undefined),
    [minZoom, readOnly],
  );

  useEffect(() => {
    if (!readOnly || typeof ResizeObserver === "undefined") return;
    const canvasContainer = canvasContainerRef.current;
    if (!canvasContainer) return;

    const fitToViewport = () => {
      if (!fitViewOptions) return;
      void reactFlowRef.current?.fitView({ ...fitViewOptions, duration: 0 });
    };
    const observer = new ResizeObserver(fitToViewport);
    observer.observe(canvasContainer);
    fitToViewport();
    return () => observer.disconnect();
  }, [fitViewOptions, readOnly]);

  const edgeTypes = useMemo(() => ({ custom: CustomEdge, ...extraEdgeTypes }), [extraEdgeTypes]);
  const nodeTypes = useMemo(
    () => ({
      customShape: CanvasCustomNode,
      tableShape: TableNode,
      umlClassShape: UmlClassNode,
      entityShape: EntityNode,
      containerShape: ContainerNode,
      swimlaneShape: SwimlaneNode,
      ...extraNodeTypes,
    }),
    [extraNodeTypes],
  );
  const activeStoryNodeIds = useMemo(
    () =>
      new Set(
        activeStoryTargets
          .filter((target) => target.targetKind === "node")
          .map((target) => target.targetId),
      ),
    [activeStoryTargets],
  );
  const displayNodes = useMemo(
    () =>
      nodes.map((node) => {
        const active = activeStoryNodeIds.has(node.id);
        const sequenceSource = activeSequenceEdgeTool?.sourceId === node.id;
        const locked = node.data?.locked === true;
        // Only Cloud has inset artwork that leaves unused resize-frame space.
        // Keep other palette shapes on React Flow's standard full-frame hit area.
        const usesPreciseHitArea = node.type === "customShape" && node.data.type === "cloud";
        const base = locked
          ? { ...node, draggable: false, deletable: false, connectable: false }
          : node;
        if (!active && !usesPreciseHitArea && !sequenceSource) return base;
        const className = [
          base.className,
          active ? "dm-story-target" : "",
          usesPreciseHitArea ? "dm-precise-node-hitbox" : "",
          sequenceSource ? "dm-sequence-edge-source" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return { ...base, className };
      }),
    [activeSequenceEdgeTool?.sourceId, activeStoryNodeIds, nodes],
  );

  // Find the container node at a given flow position
  const findContainerAtPosition = useCallback(
    (pos: { x: number; y: number }, excludeId?: string) => {
      return nodes.find((n) => {
        if (excludeId && n.id === excludeId) return false;
        const nType = (n.data as Record<string, unknown>)?.type as string;
        if (!ALL_CONTAINER_TYPES.has(nType)) return false;
        if (n.parentId) return false; // don't nest into child-containers
        const w = Number(n.style?.width || 300);
        const h = Number(n.style?.height || 200);
        return (
          pos.x >= n.position.x &&
          pos.x <= n.position.x + w &&
          pos.y >= n.position.y &&
          pos.y <= n.position.y + h
        );
      });
    },
    [nodes],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/drawcms-shape");
      if (!raw || !reactFlowRef.current || !onAddNode) return;
      const { type, title } = JSON.parse(raw);
      const position = reactFlowRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Check if dropping inside a container
      const containerNode = findContainerAtPosition(position);
      if (containerNode && !ALL_CONTAINER_TYPES.has(type)) {
        const relativePosition = {
          x: position.x - containerNode.position.x,
          y: position.y - containerNode.position.y,
        };
        onAddNode(type, title, relativePosition, containerNode.id);
      } else {
        onAddNode(type, title, position);
      }
    },
    [onAddNode, findContainerAtPosition],
  );

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onNodeDragStop) {
        onNodeDragStop(node.id, node.position);
      }
    },
    [onNodeDragStop],
  );

  return (
    <div
      ref={canvasContainerRef}
      className={`absolute inset-0 overflow-hidden bg-background ${
        readOnly ? "dm-canvas-readonly" : ""
      }`}
    >
      <ReactFlow
        className={activeSequenceEdgeTool ? "dm-sequence-edge-mode" : ""}
        nodes={displayNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(instance) => {
          reactFlowRef.current = instance;
        }}
        onDrop={readOnly ? undefined : onDrop}
        onDragOver={readOnly ? undefined : onDragOver}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        nodesFocusable={!readOnly}
        edgesFocusable={!readOnly}
        deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
        minZoom={minZoom}
        onNodeDragStop={readOnly ? undefined : handleNodeDragStop}
        onNodeClick={
          readOnly
            ? undefined
            : (_event, node) => {
                onCanvasSelectionIntent?.();
                onSequenceEdgeNodeClick?.(node.id);
              }
        }
        onEdgeClick={readOnly ? undefined : onCanvasSelectionIntent}
        onPaneClick={
          readOnly
            ? undefined
            : () => {
                onCanvasSelectionIntent?.();
                onBlankCanvasClick?.();
              }
        }
        onNodeContextMenu={(event, node) => {
          if (!onRequestContextMenu) return;
          event.preventDefault();
          const preserveSelection = Boolean(node.selected);
          const selectedNodes = preserveSelection ? nodes.filter((item) => item.selected) : [node];
          const selectedEdges = preserveSelection ? edges.filter((item) => item.selected) : [];
          if (!preserveSelection) {
            onNodesChange(
              nodes.map((item) => ({
                id: item.id,
                type: "select" as const,
                selected: item.id === node.id,
              })),
            );
            onEdgesChange(
              edges.map((item) => ({ id: item.id, type: "select" as const, selected: false })),
            );
            setSelectedNodeId(node.id);
            setSelectedEdgeId(null);
          }
          onRequestContextMenu({
            x: event.clientX,
            y: event.clientY,
            kind: "node",
            targets: [
              ...selectedNodes.map((item) => ({
                targetId: item.id,
                targetKind: "node" as const,
              })),
              ...selectedEdges.map((item) => ({
                targetId: item.id,
                targetKind: "edge" as const,
              })),
            ],
          });
        }}
        onEdgeContextMenu={(event, edge) => {
          if (!onRequestContextMenu) return;
          event.preventDefault();
          const preserveSelection = Boolean(edge.selected);
          const selectedNodes = preserveSelection ? nodes.filter((item) => item.selected) : [];
          const selectedEdges = preserveSelection ? edges.filter((item) => item.selected) : [edge];
          if (!preserveSelection) {
            onNodesChange(
              nodes.map((item) => ({ id: item.id, type: "select" as const, selected: false })),
            );
            onEdgesChange(
              edges.map((item) => ({
                id: item.id,
                type: "select" as const,
                selected: item.id === edge.id,
              })),
            );
            setSelectedNodeId(null);
            setSelectedEdgeId(edge.id);
          }
          onRequestContextMenu({
            x: event.clientX,
            y: event.clientY,
            kind: "edge",
            targets: [
              ...selectedNodes.map((item) => ({
                targetId: item.id,
                targetKind: "node" as const,
              })),
              ...selectedEdges.map((item) => ({
                targetId: item.id,
                targetKind: "edge" as const,
              })),
            ],
          });
        }}
        onPaneContextMenu={
          readOnly || !onRequestContextMenu
            ? undefined
            : (event) => {
                event.preventDefault();
                const flowPosition = reactFlowRef.current?.screenToFlowPosition({
                  x: event.clientX,
                  y: event.clientY,
                });
                onRequestContextMenu({
                  x: event.clientX,
                  y: event.clientY,
                  kind: "pane",
                  flowPosition,
                  targets: [],
                });
              }
        }
        onSelectionChange={
          readOnly
            ? undefined
            : (params) => {
                if (params.nodes.length > 0) {
                  setSelectedNodeId(params.nodes[0].id);
                } else {
                  setSelectedNodeId(null);
                }
                if (params.edges.length > 0) {
                  setSelectedEdgeId(params.edges[0].id);
                } else {
                  setSelectedEdgeId(null);
                }
              }
        }
        fitView
        fitViewOptions={fitViewOptions}
      >
        <Background color="var(--drawcms-canvas-dots)" gap={24} size={1.5} />
        {activeSequenceEdgeTool && (
          <Panel position="top-center" className="!mt-3">
            <div
              role="status"
              aria-live="polite"
              className="flex min-h-11 items-center gap-3 rounded-lg border border-primary/30 bg-card px-3 py-2 text-sm text-muted-foreground"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <div className="min-w-0">
                <span className="font-semibold text-foreground">
                  {activeSequenceEdgeTool.type === "sequence-message-return"
                    ? "Return message"
                    : activeSequenceEdgeTool.type === "sequence-message-async"
                      ? "Async message"
                      : activeSequenceEdgeTool.type === "sequence-message-self"
                        ? "Self message"
                        : "Message"}
                </span>{" "}
                <span>{activeSequenceEdgeTool.message}</span>
              </div>
              <button
                type="button"
                onClick={onCancelSequenceEdgeTool}
                className="ml-2 min-h-10 shrink-0 rounded-md px-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Cancel <span className="text-muted-foreground">Esc</span>
              </button>
            </div>
          </Panel>
        )}
        <CanvasControls onOpenSteps={onOpenSteps} />
        {webMcp && (
          <Panel position="bottom-left" className="!mb-3">
            <ChatGptButton />
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
