"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Handle, NodeResizer, Position } from "@xyflow/react";
import { useAnimationState, useNodeCallbacks } from "../contexts";
import { STORY_ACTIVE_TEXT } from "../story/highlight";
import type { AppNodeData } from "../types";

export const TEXT_FONT_FAMILIES = {
  sans: '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  hand: '"Comic Sans MS", "Bradley Hand", "Segoe Print", cursive',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
} as const;

const DEFAULT_TEXT_COLOR = "#1f2937";
const THEME_INK = "var(--drawcms-ink)";

/**
 * Frames to keep trying to focus a just-created text editor. Roughly a quarter of
 * a second at 60fps — long enough to outlast React Flow measuring the node and
 * settling focus, short enough to give up quietly if it never becomes visible.
 */
const FOCUS_ON_CREATE_ATTEMPTS = 15;

export type TextFontFamily = keyof typeof TEXT_FONT_FAMILIES;

export function resolveTextFontFamily(value: unknown): string {
  return TEXT_FONT_FAMILIES[value as TextFontFamily] ?? TEXT_FONT_FAMILIES.sans;
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** A standalone, directly editable canvas text element. */
export function TextNode({
  id,
  data,
  selected,
}: {
  id: string;
  data: AppNodeData;
  selected: boolean;
}) {
  const callbacks = useNodeCallbacks();
  const { activeStoryNodeIds } = useAnimationState();
  const initialValueRef = useRef(String(data.label ?? ""));
  const editFinishedRef = useRef(false);
  const measureRef = useRef<HTMLSpanElement>(null);
  const lastMeasuredRef = useRef<{ width: number; height: number } | null>(null);
  const [isEditing, setIsEditing] = useState(data.textEditOnMount === true);
  const startedInEditModeRef = useRef(data.textEditOnMount === true);
  const [draft, setDraft] = useState(String(data.label ?? ""));

  const fontSize = safeNumber(data.fontSize, 20);
  const lineHeight = Math.max(1, Math.min(2, safeNumber(data.lineHeight, 1.25)));
  const fontFamily = resolveTextFontFamily(data.fontFamily);
  const fontWeight = String(data.fontWeight ?? "400");
  const fontStyle = data.fontStyle === "italic" ? "italic" : "normal";
  const textDecoration = data.textDecoration === "underline" ? "underline" : "none";
  const textAlign =
    data.textAlign === "center" || data.textAlign === "right" ? data.textAlign : "left";
  const fillColor =
    typeof data.fillColor === "string" && data.fillColor !== "none"
      ? data.fillColor
      : "transparent";
  const configuredTextColor = String(data.textColor ?? DEFAULT_TEXT_COLOR);
  // Default text sits directly on the canvas. Resolve it through a theme token
  // so it stays legible when the canvas switches to dark mode; explicit colors
  // remain exactly as the diagram author chose them.
  const textColor =
    fillColor === "transparent" && configuredTextColor === DEFAULT_TEXT_COLOR
      ? THEME_INK
      : configuredTextColor;
  const autoResize = data.textAutoResize !== false;
  const opacity = Math.max(0, Math.min(1, safeNumber(data.opacity, 1)));
  const isStoryTarget = activeStoryNodeIds.includes(id);
  const visibleText = isEditing ? draft : String(data.label ?? "");
  const renderedColor = isStoryTarget ? STORY_ACTIVE_TEXT : textColor;

  const sharedStyle: React.CSSProperties = {
    color: renderedColor,
    fontFamily,
    fontSize,
    fontStyle,
    fontWeight,
    lineHeight,
    textAlign,
    textDecoration,
  };

  useLayoutEffect(() => {
    if (!autoResize) return;
    const measurement = measureRef.current;
    if (!measurement) return;

    const width = Math.max(40, Math.min(1200, Math.ceil(measurement.scrollWidth) + 4));
    const height = Math.max(
      Math.ceil(fontSize * lineHeight) + 6,
      Math.ceil(measurement.scrollHeight) + 4,
    );
    const previous = lastMeasuredRef.current;
    if (previous?.width === width && previous.height === height) return;
    lastMeasuredRef.current = { width, height };
    callbacks?.onStyleChange(id, {}, { width, height });
  }, [
    autoResize,
    callbacks,
    fontFamily,
    fontSize,
    fontStyle,
    fontWeight,
    id,
    lineHeight,
    textDecoration,
    visibleText,
  ]);

  useLayoutEffect(() => {
    if (!data.textEditOnMount) return;
    callbacks?.onStyleChange(id, { textEditOnMount: undefined });
  }, [callbacks, data.textEditOnMount, id]);

  /**
   * Put the caret in the editor when the element is created mid-edit.
   *
   * `autoFocus` is not enough: React Flow selects the new node and moves focus to
   * its wrapper (nodes are focusable), and a palette insert additionally hands
   * focus back to the flyout trigger as the popover closes. Both happen after
   * mount, so the focus call has to run after them — hence the frame delay.
   *
   * The frame is deliberately not cancelled on cleanup. Auto-resize writes the
   * measured size back into the document, so this node re-renders repeatedly just
   * after mounting; a cleanup that cancelled the pending frame would keep
   * rescheduling it and the focus would never land.
   */
  /**
   * Put the caret in the editor when the element is created mid-edit.
   *
   * This cannot be done with `autoFocus`, or with a single deferred `focus()`:
   *
   *  - React Flow renders a newly added node hidden until it has measured it, and
   *    `focus()` is silently ignored on an element with no layout box;
   *  - once visible, React Flow selects the node and moves focus to its wrapper,
   *    and a palette insert also returns focus to the flyout trigger it closed.
   *
   * So the editor is claimed as soon as it is actually focusable, retrying over a
   * short window and stopping the moment the caret lands. Success is measured by
   * asking whether focus took, rather than by predicting focusability, so the same
   * code works in a headless DOM with no layout. The window is bounded so a node
   * that never becomes visible cannot leave a frame loop running.
   */
  const editorRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!startedInEditModeRef.current) return;
    let frame = 0;
    let attemptsLeft = FOCUS_ON_CREATE_ATTEMPTS;
    const claimEditor = () => {
      const editor = editorRef.current;
      if (!editor) return;
      if (document.activeElement !== editor) editor.focus();
      if (document.activeElement === editor) {
        editor.setSelectionRange(editor.value.length, editor.value.length);
        return;
      }
      if (--attemptsLeft > 0) frame = requestAnimationFrame(claimEditor);
    };
    frame = requestAnimationFrame(claimEditor);
    return () => cancelAnimationFrame(frame);
  }, []);

  const startEditing = useCallback(() => {
    initialValueRef.current = String(data.label ?? "");
    editFinishedRef.current = false;
    setDraft(String(data.label ?? ""));
    setIsEditing(true);
  }, [data.label]);

  const finishEditing = useCallback(() => {
    if (editFinishedRef.current) return;
    editFinishedRef.current = true;
    callbacks?.onLabelChange(id, draft);
    setIsEditing(false);
  }, [callbacks, draft, id]);

  const cancelEditing = useCallback(() => {
    if (editFinishedRef.current) return;
    editFinishedRef.current = true;
    callbacks?.onLabelChange(id, initialValueRef.current);
    setDraft(initialValueRef.current);
    setIsEditing(false);
  }, [callbacks, id]);

  return (
    <>
      <NodeResizer
        color="#0c8c5e"
        isVisible={selected && !isEditing && !data?.locked}
        minWidth={40}
        minHeight={Math.max(28, Math.ceil(fontSize * lineHeight) + 6)}
        onResizeStart={() => {
          lastMeasuredRef.current = null;
          callbacks?.onStyleChange(id, { textAutoResize: false });
        }}
      />
      <div
        className="dm-text-element relative h-full w-full"
        style={{ backgroundColor: fillColor, opacity }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          startEditing();
        }}
        onKeyDown={(event) => {
          if (!isEditing && event.key === "Enter") {
            event.preventDefault();
            startEditing();
          }
        }}
      >
        <span
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute left-0 top-0 inline-block whitespace-pre px-0.5 py-0.5"
          style={{ ...sharedStyle, color: "transparent", width: "max-content" }}
        >
          {visibleText || "\u200b"}
        </span>

        {isEditing ? (
          <textarea
            ref={editorRef}
            autoFocus
            aria-label="Edit text element"
            value={draft}
            placeholder="Type something…"
            spellCheck
            className="dm-text-editor nodrag nopan nowheel block h-full w-full resize-none overflow-hidden border-0 bg-transparent px-0.5 py-0.5 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            style={{ ...sharedStyle, color: textColor, overflowWrap: "anywhere" }}
            onChange={(event) => {
              const nextValue = event.target.value;
              setDraft(nextValue);
              callbacks?.onLabelChange(id, nextValue);
            }}
            onBlur={finishEditing}
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Escape") {
                event.preventDefault();
                cancelEditing();
              } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                finishEditing();
              } else if (event.key === "Tab") {
                event.preventDefault();
                const target = event.currentTarget;
                const start = target.selectionStart;
                const end = target.selectionEnd;
                const nextValue = `${draft.slice(0, start)}    ${draft.slice(end)}`;
                setDraft(nextValue);
                callbacks?.onLabelChange(id, nextValue);
                requestAnimationFrame(() => target.setSelectionRange(start + 4, start + 4));
              }
            }}
          />
        ) : (
          <div
            className="dm-story-text-surface h-full w-full whitespace-pre-wrap break-words px-0.5 py-0.5"
            data-story-active={isStoryTarget ? "true" : undefined}
            style={{ ...sharedStyle, overflowWrap: "anywhere" }}
          >
            {visibleText || <span className="text-gray-400">Double-click to add text</span>}
          </div>
        )}

        {[Position.Top, Position.Left, Position.Right, Position.Bottom].map((position) => (
          <Handle
            key={position}
            type="source"
            position={position}
            id={position.toLowerCase()}
            className="h-3 w-3 border-2 border-slate-400 bg-white"
          />
        ))}
      </div>
    </>
  );
}
