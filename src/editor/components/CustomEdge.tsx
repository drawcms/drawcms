"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useAnimationState, useEdgeRoutingCallbacks } from "../contexts";
import { isSequenceEdgeType, type EdgeBend, type EdgeRoutingMode } from "../types";

gsap.registerPlugin(MotionPathPlugin);

const EDGE_ACCENT = "#0c8c5e";
const EDGE_ACCENT_LIGHT = "#63d2a4";
const EDGE_ACCENT_SOFT = "#ecf8f2";
const EDGE_ACCENT_INK = "#121715";

/**
 * html-to-image reliably preserves SVG presentation attributes, while styles
 * written by GSAP can be lost when the viewport is cloned for export. Keep
 * dash geometry on attributes so an animated packet cannot become a solid
 * colored connector in PNG, SVG, GIF, or MP4 output.
 */
function setExportStableDash(
  path: SVGPathElement,
  strokeDasharray: string,
  strokeDashoffset: number,
) {
  path.style.removeProperty("stroke-dasharray");
  path.style.removeProperty("stroke-dashoffset");
  path.setAttribute("stroke-dasharray", strokeDasharray);
  path.setAttribute("stroke-dashoffset", String(strokeDashoffset));
}

function isEdgeBend(value: unknown): value is EdgeBend {
  return (
    typeof value === "object" &&
    value !== null &&
    "x" in value &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    "y" in value &&
    typeof value.y === "number" &&
    Number.isFinite(value.y)
  );
}

interface EdgeBendHandleProps {
  edgeId: string;
  routingMode: EdgeRoutingMode;
  midpointX: number;
  midpointY: number;
  handleX: number;
  handleY: number;
}

function EdgeBendHandle({
  edgeId,
  routingMode,
  midpointX,
  midpointY,
  handleX,
  handleY,
}: EdgeBendHandleProps) {
  const callbacks = useEdgeRoutingCallbacks();
  const { screenToFlowPosition } = useReactFlow();
  const activePointerRef = useRef<number | null>(null);
  const changeStartedRef = useRef(false);

  const updateBend = useCallback(
    (bend: EdgeBend) => {
      if (!callbacks) return;
      if (!changeStartedRef.current) {
        callbacks.onRoutingChangeStart();
        changeStartedRef.current = true;
      }
      callbacks.onRoutingChange(edgeId, routingMode === "straight" ? "curve" : routingMode, bend);
    },
    [callbacks, edgeId, routingMode],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    activePointerRef.current = event.pointerId;
    changeStartedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    updateBend({ x: point.x - midpointX, y: point.y - midpointY });
  };

  const finishPointerChange = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    changeStartedRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const direction = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    callbacks?.onRoutingChangeStart();
    callbacks?.onRoutingChange(edgeId, routingMode === "straight" ? "curve" : routingMode, {
      x: handleX - midpointX + direction.x * step,
      y: handleY - midpointY + direction.y * step,
    });
  };

  if (!callbacks) return null;

  return (
    <EdgeLabelRenderer>
      <button
        type="button"
        aria-label={`Adjust ${routingMode} edge bend`}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
        title="Drag to bend. Use arrow keys for precise changes; Shift moves 10 px."
        className="nodrag nopan group flex h-10 w-10 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        style={{
          position: "absolute",
          transform: `translate(-50%, -50%) translate(${handleX}px,${handleY}px)`,
          pointerEvents: "all",
          touchAction: "none",
          cursor: "move",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerChange}
        onPointerCancel={finishPointerChange}
        onKeyDown={handleKeyDown}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          callbacks.onRoutingChangeStart();
          callbacks.onRoutingChange(edgeId, routingMode, null);
        }}
      >
        <span
          aria-hidden="true"
          className="h-3 w-3 rounded-full border-2 border-card ring-1 ring-ring transition-transform group-hover:scale-110 motion-reduce:transition-none"
          style={{ backgroundColor: "var(--drawcms-accent)" }}
        />
      </button>
    </EdgeLabelRenderer>
  );
}

interface SequenceMessageMoveHandleProps {
  edgeId: string;
  isSelfMessage: boolean;
  sourceOffset: EdgeBend;
  targetOffset: EdgeBend;
  handleX: number;
  handleY: number;
}

interface SequenceEndpointHandleProps {
  edgeId: string;
  endpoint: "source" | "target";
  anchorX: number;
  anchorY: number;
  offset: EdgeBend;
}

function SequenceEndpointHandle({
  edgeId,
  endpoint,
  anchorX,
  anchorY,
  offset,
}: SequenceEndpointHandleProps) {
  const callbacks = useEdgeRoutingCallbacks();
  const { screenToFlowPosition } = useReactFlow();
  const activePointerRef = useRef<number | null>(null);
  const mouseDragActiveRef = useRef(false);
  const changeStartedRef = useRef(false);
  const handleX = anchorX + offset.x;
  const handleY = anchorY + offset.y;

  const updateOffset = useCallback(
    (nextOffset: EdgeBend) => {
      if (!callbacks) return;
      if (!changeStartedRef.current) {
        callbacks.onRoutingChangeStart();
        changeStartedRef.current = true;
      }
      callbacks.onSequenceEndpointChange(edgeId, endpoint, nextOffset);
    },
    [callbacks, edgeId, endpoint],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    activePointerRef.current = event.pointerId;
    mouseDragActiveRef.current = true;
    changeStartedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    updateOffset({ x: point.x - anchorX, y: point.y - anchorY });
  };

  useEffect(() => {
    const updateFromClientPoint = (clientX: number, clientY: number) => {
      const point = screenToFlowPosition({ x: clientX, y: clientY });
      updateOffset({ x: point.x - anchorX, y: point.y - anchorY });
    };
    const handleMouseMove = (event: MouseEvent) => {
      if (!mouseDragActiveRef.current) return;
      event.preventDefault();
      updateFromClientPoint(event.clientX, event.clientY);
    };
    const handleGlobalPointerMove = (event: PointerEvent) => {
      if (!mouseDragActiveRef.current) return;
      event.preventDefault();
      updateFromClientPoint(event.clientX, event.clientY);
    };
    const handleMouseUp = () => {
      mouseDragActiveRef.current = false;
      changeStartedRef.current = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("pointermove", handleGlobalPointerMove);
    window.addEventListener("pointerup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleMouseUp);
    };
  }, [anchorX, anchorY, screenToFlowPosition, updateOffset]);

  const handleMouseDown = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    mouseDragActiveRef.current = true;
    changeStartedRef.current = false;
  };

  const finishPointerChange = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    mouseDragActiveRef.current = false;
    changeStartedRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const direction = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    callbacks?.onRoutingChangeStart();
    callbacks?.onSequenceEndpointChange(edgeId, endpoint, {
      x: offset.x + direction.x * step,
      y: offset.y + direction.y * step,
    });
  };

  if (!callbacks) return null;

  return (
    <EdgeLabelRenderer>
      <button
        type="button"
        aria-label={`Move sequence message ${endpoint}`}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
        title={`Drag the ${endpoint} point freely. Double-click to reset.`}
        className="dm-sequence-endpoint-control nodrag nopan group flex h-10 w-10 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        data-endpoint={endpoint}
        style={{
          position: "absolute",
          transform: `translate(-50%, -50%) translate(${handleX}px,${handleY}px)`,
          pointerEvents: "all",
          touchAction: "none",
          cursor: "move",
        }}
        onPointerDown={handlePointerDown}
        onMouseDown={handleMouseDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerChange}
        onPointerCancel={finishPointerChange}
        onKeyDown={handleKeyDown}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          callbacks.onRoutingChangeStart();
          callbacks.onSequenceEndpointChange(edgeId, endpoint, null);
        }}
      >
        <span
          aria-hidden="true"
          className="h-3 w-3 rounded-full border-2 border-primary bg-card transition-transform group-hover:scale-110 motion-reduce:transition-none"
        />
      </button>
    </EdgeLabelRenderer>
  );
}

/**
 * Moves the whole message freely: both endpoints keep their relative
 * attachment offsets while shifting together by the drag delta.
 */
function SequenceMessageMoveHandle({
  edgeId,
  sourceOffset,
  targetOffset,
  handleX,
  handleY,
}: SequenceMessageMoveHandleProps) {
  const callbacks = useEdgeRoutingCallbacks();
  const { screenToFlowPosition } = useReactFlow();
  const activePointerRef = useRef<number | null>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    sourceOffset: EdgeBend;
    targetOffset: EdgeBend;
  } | null>(null);
  const changeStartedRef = useRef(false);

  const updateOffsets = useCallback(
    (nextSourceOffset: EdgeBend, nextTargetOffset: EdgeBend) => {
      if (!callbacks) return;
      if (!changeStartedRef.current) {
        callbacks.onRoutingChangeStart();
        changeStartedRef.current = true;
      }
      callbacks.onSequenceMessageMove(edgeId, nextSourceOffset, nextTargetOffset);
    },
    [callbacks, edgeId],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    activePointerRef.current = event.pointerId;
    dragStartRef.current = { pointerX: point.x, pointerY: point.y, sourceOffset, targetOffset };
    changeStartedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = dragStartRef.current;
    if (activePointerRef.current !== event.pointerId || !start) return;
    event.preventDefault();
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const deltaX = point.x - start.pointerX;
    const deltaY = point.y - start.pointerY;
    updateOffsets(
      { x: start.sourceOffset.x + deltaX, y: start.sourceOffset.y + deltaY },
      { x: start.targetOffset.x + deltaX, y: start.targetOffset.y + deltaY },
    );
  };

  const finishPointerChange = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    dragStartRef.current = null;
    changeStartedRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const direction = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    callbacks?.onRoutingChangeStart();
    callbacks?.onSequenceMessageMove(
      edgeId,
      {
        x: sourceOffset.x + direction.x * step,
        y: sourceOffset.y + direction.y * step,
      },
      {
        x: targetOffset.x + direction.x * step,
        y: targetOffset.y + direction.y * step,
      },
    );
  };

  if (!callbacks) return null;

  return (
    <EdgeLabelRenderer>
      <button
        type="button"
        aria-label="Move sequence message freely"
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
        title="Drag to move the whole message freely. Arrow keys move 1 px; Shift moves 10 px."
        className="nodrag nopan group flex h-10 w-10 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        style={{
          position: "absolute",
          transform: `translate(-50%, -50%) translate(${handleX}px,${handleY}px)`,
          pointerEvents: "all",
          touchAction: "none",
          cursor: "move",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerChange}
        onPointerCancel={finishPointerChange}
        onKeyDown={handleKeyDown}
      >
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-full border border-primary bg-card text-[10px] font-bold leading-none text-primary transition-transform group-hover:scale-110 motion-reduce:transition-none"
        >
          ✥
        </span>
      </button>
    </EdgeLabelRenderer>
  );
}

export function CustomEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const { activeStoryEdgeIds, isStoryStepPlaying, prefersReducedMotion } = useAnimationState();
  const sequenceType = isSequenceEdgeType(data?.sequenceType) ? data.sequenceType : null;
  const configuredScale = data?.scale;
  const edgeScale =
    typeof configuredScale === "number" && Number.isFinite(configuredScale)
      ? Math.max(0.5, Math.min(2, configuredScale))
      : 1;
  const isSelfMessage = sequenceType === "sequence-message-self" && source === target;
  const sourceOffset = isEdgeBend(data?.sourceOffset)
    ? { x: data.sourceOffset.x, y: data.sourceOffset.y }
    : { x: 0, y: 0 };
  const targetOffset = isEdgeBend(data?.targetOffset)
    ? { x: data.targetOffset.x, y: data.targetOffset.y }
    : { x: 0, y: 0 };
  const effectiveSourceX = sourceX + sourceOffset.x;
  const effectiveSourceY = sourceY + sourceOffset.y;
  const effectiveTargetX = targetX + targetOffset.x;
  const effectiveTargetY = targetY + targetOffset.y;
  const [defaultEdgePath, defaultLabelX, defaultLabelY] = getBezierPath({
    sourceX: effectiveSourceX,
    sourceY: effectiveSourceY,
    sourcePosition,
    targetX: effectiveTargetX,
    targetY: effectiveTargetY,
    targetPosition,
    // Give U-turn and self-referential connections more clearance from their nodes.
    // Direct left-to-right routes retain their normal geometry.
    curvature: 0.45,
  });
  const configuredRoutingMode = data?.routingMode;
  const routingMode: EdgeRoutingMode =
    configuredRoutingMode === "straight" ||
    configuredRoutingMode === "elbow" ||
    configuredRoutingMode === "curve"
      ? configuredRoutingMode
      : "curve";
  const configuredBend = data?.bend;
  const bend = isEdgeBend(configuredBend) ? { x: configuredBend.x, y: configuredBend.y } : null;
  const configuredCurveOffset = data?.curveOffset;
  const curveOffset =
    typeof configuredCurveOffset === "number" && Number.isFinite(configuredCurveOffset)
      ? configuredCurveOffset
      : 0;
  const midpointX = (effectiveSourceX + effectiveTargetX) / 2;
  const midpointY = (effectiveSourceY + effectiveTargetY) / 2;
  const editableBend = bend ?? (curveOffset ? { x: 0, y: curveOffset } : null);
  const bendX = midpointX + (editableBend?.x ?? 0);
  const bendY = midpointY + (editableBend?.y ?? 0);
  let edgePath = defaultEdgePath;
  let labelX = defaultLabelX;
  let labelY = defaultLabelY;
  let handleX = defaultLabelX;
  let handleY = defaultLabelY;

  if (routingMode === "straight") {
    [edgePath, labelX, labelY] = getStraightPath({
      sourceX: effectiveSourceX,
      sourceY: effectiveSourceY,
      targetX: effectiveTargetX,
      targetY: effectiveTargetY,
    });
    handleX = labelX;
    handleY = labelY;
  } else if (routingMode === "elbow") {
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX: effectiveSourceX,
      sourceY: effectiveSourceY,
      sourcePosition,
      targetX: effectiveTargetX,
      targetY: effectiveTargetY,
      targetPosition,
      centerX: bendX,
      centerY: bendY,
      borderRadius: 8,
      offset: 16,
    });
    handleX = bendX;
    handleY = bendY;
  } else if (editableBend) {
    edgePath = `M${effectiveSourceX},${effectiveSourceY} Q${midpointX + editableBend.x * 2},${midpointY + editableBend.y * 2} ${effectiveTargetX},${effectiveTargetY}`;
    labelX = bendX;
    labelY = bendY;
    handleX = bendX;
    handleY = bendY;
  }

  if (isSelfMessage) {
    const loopOffset = Math.max(48, Math.abs(editableBend?.x ?? 64)) * edgeScale;
    const loopX = effectiveSourceX + loopOffset;
    if (routingMode === "curve") {
      edgePath = `M${effectiveSourceX},${effectiveSourceY} C${loopX},${effectiveSourceY} ${loopX},${effectiveTargetY} ${effectiveTargetX},${effectiveTargetY}`;
    } else {
      edgePath = `M${effectiveSourceX},${effectiveSourceY} L${loopX},${effectiveSourceY} L${loopX},${effectiveTargetY} L${effectiveTargetX},${effectiveTargetY}`;
    }
    // Keep the label clear of an execution bar painted over the lifeline.
    // Centering it on the short outgoing segment hides its first characters.
    labelX = effectiveSourceX + loopOffset;
    labelY = Math.min(effectiveSourceY, effectiveTargetY) - 14;
    handleX = loopX;
    handleY = (effectiveSourceY + effectiveTargetY) / 2;
  } else if (sequenceType) {
    labelY -= 14;
  }

  const selectedLabelOffset = selected && data?.label ? 36 * edgeScale : 0;
  const displayLabelX =
    selectedLabelOffset &&
    Math.abs(effectiveTargetX - effectiveSourceX) < Math.abs(effectiveTargetY - effectiveSourceY)
      ? labelX + selectedLabelOffset
      : labelX;
  const displayLabelY =
    selectedLabelOffset &&
    Math.abs(effectiveTargetX - effectiveSourceX) >= Math.abs(effectiveTargetY - effectiveSourceY)
      ? labelY - selectedLabelOffset
      : labelY;

  const pathRef = useRef<SVGPathElement>(null);
  const orbitRef = useRef<SVGCircleElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const storyPacketRef = useRef<SVGCircleElement>(null);
  const storyMarkerId = `dm-story-arrow-${useId().replace(/:/g, "")}`;
  const sequenceMarkerId = `dm-sequence-arrow-${useId().replace(/:/g, "")}`;
  const hasFilledSequenceArrow =
    sequenceType === "sequence-message" || sequenceType === "sequence-message-self";

  const preset = data?.preset as string | undefined;
  const isStoryTarget = activeStoryEdgeIds.includes(id);
  const isAnimating =
    (data?.isAnimating as boolean | undefined) || (isStoryStepPlaying && isStoryTarget);
  const isSelected = selected;
  const baseStrokeWidth =
    (isStoryTarget ? 3 : isSelected ? 2 : sequenceType ? 1.5 : 1) * (sequenceType ? edgeScale : 1);
  const motionSpeed = (data?.motionSpeed as number) || 0.25;
  const motionLoop = (data?.motionLoop as boolean) ?? true;

  useEffect(() => {
    if (!pathRef.current) return;

    const path = pathRef.current;
    const orbit = orbitRef.current;
    const glow = glowRef.current;

    // Kill any existing animations
    gsap.killTweensOf([path, orbit, glow]);

    // Reset styles
    setExportStableDash(path, sequenceType === "sequence-message-return" ? "7 5" : "none", 0);
    gsap.set(path, { opacity: 1, strokeWidth: baseStrokeWidth });
    if (orbit) gsap.set(orbit, { opacity: 0 });
    if (glow) {
      setExportStableDash(glow, "none", 0);
      gsap.set(glow, {
        opacity: 0,
      });
    }

    // Apply static styles based on preset
    if (sequenceType === "sequence-message-return") {
      setExportStableDash(path, "7 5", 0);
    } else if (preset === "Data Flow") {
      setExportStableDash(path, "4 4", 0);
    } else if (preset === "Pulse") {
      gsap.set(path, { strokeWidth: Math.max(baseStrokeWidth, 4) });
    } else if (preset === "Sequential Glow") {
      if (glow) {
        const length = path.getTotalLength() || 1000;
        setExportStableDash(glow, `15 ${length}`, length);
        gsap.set(glow, { opacity: 1 });
      }
    } else if (preset === "Orbit") {
      if (orbit) {
        gsap.set(orbit, { opacity: 1 });
        gsap.set(orbit, {
          motionPath: {
            path: path,
            align: path,
            alignOrigin: [0.5, 0.5],
            start: 0,
            end: 0,
          },
        });
      }
    }

    if (!isAnimating) return;

    const r = motionLoop ? -1 : 0;

    // Animations
    if (preset === "Data Flow") {
      setExportStableDash(path, "4 4", 0);
      gsap.to(path, {
        attr: { "stroke-dashoffset": -20 },
        duration: 0.5 / motionSpeed,
        ease: "none",
        repeat: r,
      });
    } else if (preset === "Sequence Flow") {
      if (glow && !isStoryTarget) {
        const length = path.getTotalLength?.() || 1_000;
        setExportStableDash(glow, `24 ${Math.max(24, length)}`, 24);
        gsap.set(glow, { opacity: 0.9 });
        gsap.to(glow, {
          attr: { "stroke-dashoffset": -(length + 24) },
          duration: 0.5 / motionSpeed,
          ease: "none",
          repeat: r,
        });
      }
    } else if (preset === "Pulse") {
      gsap.to(path, {
        strokeWidth: Math.max(baseStrokeWidth + 2, 5),
        opacity: 0.5,
        duration: 0.8 / motionSpeed,
        yoyo: true,
        repeat: r,
        ease: "sine.inOut",
      });
    } else if (preset === "Sequential Glow") {
      if (glow) {
        const length = path.getTotalLength() || 1000;
        setExportStableDash(glow, `15 ${length}`, length);
        gsap.set(glow, { opacity: 1 });
        gsap.to(glow, {
          attr: { "stroke-dashoffset": -15 },
          duration: 2 / motionSpeed,
          ease: "none",
          repeat: r,
        });
      }
    } else if (preset === "Fade Path") {
      gsap.to(path, {
        opacity: 0.2,
        duration: 1.5 / motionSpeed,
        yoyo: true,
        repeat: r,
        ease: "power1.inOut",
      });
    } else if (preset === "Orbit") {
      if (orbit) {
        gsap.set(orbit, { opacity: 1 });
        gsap.to(orbit, {
          motionPath: {
            path: path,
            align: path,
            alignOrigin: [0.5, 0.5],
          },
          duration: 2 / motionSpeed,
          repeat: r,
          ease: "none",
        });
      }
    }
  }, [
    preset,
    isAnimating,
    baseStrokeWidth,
    edgePath,
    motionSpeed,
    motionLoop,
    sequenceType,
    isStoryTarget,
  ]);

  useEffect(() => {
    const packet = storyPacketRef.current;
    const path = pathRef.current;
    if (!packet || !path) return;

    gsap.killTweensOf(packet);
    gsap.set(packet, { opacity: 0 });
    if (!isStoryTarget || !isStoryStepPlaying || prefersReducedMotion) return;

    gsap.set(packet, {
      motionPath: {
        path,
        align: path,
        alignOrigin: [0.5, 0.5],
        start: 0,
        end: 0,
      },
    });
    const timeline = gsap.timeline({ repeat: -1, repeatDelay: 0.35 });
    timeline.to(packet, { opacity: 1, duration: 0.15, ease: "power2.out" }, 0);
    timeline.to(
      packet,
      {
        motionPath: {
          path,
          align: path,
          alignOrigin: [0.5, 0.5],
          start: 0,
          end: 1,
        },
        duration: 1.4,
        ease: "power2.inOut",
      },
      0,
    );
    timeline.to(packet, { opacity: 0, duration: 0.15, ease: "power1.in" }, 1.25);

    return () => {
      timeline.kill();
    };
  }, [edgePath, isStoryStepPlaying, isStoryTarget, prefersReducedMotion]);

  let strokeColor =
    isSelected || isStoryTarget ? EDGE_ACCENT : sequenceType ? "#475569" : "#94a3b8";

  if (isStoryTarget) {
    strokeColor = EDGE_ACCENT;
  } else if (preset === "Data Flow") {
    strokeColor = isSelected ? EDGE_ACCENT : EDGE_ACCENT_LIGHT;
  } else if (preset === "Pulse" || preset === "Orbit") {
    strokeColor = isSelected ? "#3b82f6" : "#60a5fa";
  } else if (preset === "Sequential Glow" || preset === "Fade Path") {
    strokeColor = isSelected ? EDGE_ACCENT : EDGE_ACCENT_LIGHT;
  }

  const strokeWidth = baseStrokeWidth;

  return (
    <>
      {(isStoryTarget || sequenceType) && (
        <defs>
          {isStoryTarget && (
            <marker
              id={storyMarkerId}
              viewBox="0 0 8 8"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill={EDGE_ACCENT} />
            </marker>
          )}
          {sequenceType && (
            <marker
              id={sequenceMarkerId}
              viewBox="0 0 10 10"
              markerWidth={10 * edgeScale}
              markerHeight={10 * edgeScale}
              refX={hasFilledSequenceArrow ? 10 : 9}
              refY="5"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              {hasFilledSequenceArrow ? (
                <path d="M 0 0 L 10 5 L 0 10 z" fill={strokeColor} />
              ) : (
                <path
                  d="M 1 1 L 9 5 L 1 9"
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </marker>
          )}
        </defs>
      )}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />
      {isStoryTarget && (
        <>
          <path
            d={edgePath}
            fill="none"
            stroke={EDGE_ACCENT_LIGHT}
            strokeWidth={7}
            strokeLinecap="round"
            opacity={0.38}
            className="dm-story-edge-underlay"
            pointerEvents="none"
          />
          <path
            d={edgePath}
            fill="none"
            stroke={EDGE_ACCENT}
            strokeWidth={3}
            strokeLinecap="round"
            className="dm-story-edge-highlight"
            markerEnd={`url(#${storyMarkerId})`}
            pointerEvents="none"
          />
        </>
      )}
      <path
        id={id}
        ref={pathRef}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        // Inline style beats React Flow's `.react-flow__edge-path` CSS rule
        // (which would otherwise override the presentation attribute) and is
        // preserved by html-to-image exports, so the exported diagram matches
        // the canvas.
        style={{ stroke: strokeColor, strokeWidth }}
        className={`react-flow__edge-path ${isStoryTarget ? "dm-story-edge-active" : ""}`}
        markerEnd={
          isStoryTarget ? undefined : sequenceType ? `url(#${sequenceMarkerId})` : markerEnd
        }
      />
      <path
        ref={glowRef}
        d={edgePath}
        fill="none"
        stroke={EDGE_ACCENT_LIGHT}
        strokeWidth={strokeWidth + 2}
        className="react-flow__edge-path"
        style={{ opacity: 0, stroke: EDGE_ACCENT_LIGHT, strokeWidth: strokeWidth + 2 }}
      />
      <circle ref={orbitRef} r="4" fill="#3b82f6" style={{ opacity: 0 }} />
      {isStoryTarget && (
        <circle
          ref={storyPacketRef}
          r="5"
          fill={EDGE_ACCENT}
          stroke="white"
          strokeWidth="3"
          className="dm-story-flow-packet"
          style={{ opacity: 0 }}
          pointerEvents="none"
          aria-hidden="true"
        />
      )}
      {selected && (
        <EdgeBendHandle
          edgeId={id}
          routingMode={routingMode}
          midpointX={midpointX}
          midpointY={midpointY}
          handleX={handleX}
          handleY={handleY}
        />
      )}
      {selected && sequenceType && (
        <>
          <SequenceEndpointHandle
            edgeId={id}
            endpoint="source"
            anchorX={sourceX}
            anchorY={sourceY}
            offset={sourceOffset}
          />
          <SequenceEndpointHandle
            edgeId={id}
            endpoint="target"
            anchorX={targetX}
            anchorY={targetY}
            offset={targetOffset}
          />
          <SequenceMessageMoveHandle
            edgeId={id}
            isSelfMessage={isSelfMessage}
            sourceOffset={sourceOffset}
            targetOffset={targetOffset}
            handleX={isSelfMessage ? handleX + 64 : midpointX}
            handleY={isSelfMessage ? handleY : midpointY + 64}
          />
        </>
      )}
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            data-edge-label="true"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${displayLabelX}px,${displayLabelY}px)`,
              background: isStoryTarget ? EDGE_ACCENT_SOFT : sequenceType ? "#f8f9fa" : "#eef2f6",
              padding: sequenceType ? `${2 * edgeScale}px ${6 * edgeScale}px` : "4px 8px",
              borderRadius: sequenceType ? 4 * edgeScale : 4,
              fontSize: sequenceType ? 12 * edgeScale : 12,
              fontWeight: 600,
              color: isStoryTarget || isSelected ? EDGE_ACCENT_INK : "#475569",
              border: sequenceType
                ? isSelected
                  ? `1px solid ${EDGE_ACCENT}`
                  : "1px solid transparent"
                : `1px solid ${isStoryTarget || isSelected ? EDGE_ACCENT : "#cbd5e1"}`,
              maxWidth: Math.max(96, 220 * edgeScale),
              lineHeight: 1.25,
              overflowWrap: "anywhere",
              pointerEvents: "none",
              textAlign: "center",
              whiteSpace: "pre-wrap",
            }}
            className="nodrag nopan"
          >
            {String(data.label)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
