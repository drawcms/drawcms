"use client";

import React, {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEventHandler,
} from "react";

interface EditableNodeLabelProps {
  value: string;
  isEditing: boolean;
  onCommit: (value: string) => void;
  onCancel: () => void;
  ariaLabel?: string;
  className?: string;
  displayClassName?: string;
  editorClassName?: string;
  style?: CSSProperties;
  fitText?: boolean;
  minFontSize?: number;
  /**
   * Labels drawn beneath a symbol have only a single line reserved inside the
   * node box. Let those wrap past the reserved height instead of cropping the
   * text, matching how draw.io paints below-shape labels against the canvas.
   */
  allowOverflow?: boolean;
  storyActive?: boolean;
  onClick?: MouseEventHandler<HTMLSpanElement>;
  onDoubleClick?: MouseEventHandler<HTMLSpanElement>;
}

function numericFontSize(value: CSSProperties["fontSize"]): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 14;
}

function MultilineLabelEditor({
  value,
  onCommit,
  onCancel,
  ariaLabel,
  editorClassName,
  style,
}: Pick<
  EditableNodeLabelProps,
  "value" | "onCommit" | "onCancel" | "ariaLabel" | "editorClassName" | "style"
>) {
  const [draft, setDraft] = useState(value);
  const finishedRef = useRef(false);
  const requestedFontSize = numericFontSize(style?.fontSize);

  const commit = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onCommit(draft);
  }, [draft, onCommit]);

  const cancel = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onCancel();
  }, [onCancel]);

  return (
    <textarea
      autoFocus
      aria-label={ariaLabel}
      rows={3}
      value={draft}
      title="Enter adds a new line. Ctrl or Command + Enter saves."
      className={`dm-node-label nodrag nopan nowheel box-border block h-full min-h-12 w-full resize-none overflow-auto whitespace-pre-wrap break-words rounded-md border border-primary bg-card/95 px-2 py-1.5 leading-snug text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${editorClassName}`}
      style={{
        ...style,
        fontSize: requestedFontSize,
        overflowWrap: "anywhere",
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}

/**
 * Shared freeform label editor for canvas elements. Display text is constrained
 * to its owning element, while editing uses a real textarea so line breaks are
 * visible and can be entered without prematurely closing the editor.
 */
export function EditableNodeLabel({
  value,
  isEditing,
  onCommit,
  onCancel,
  ariaLabel = "Element label",
  className = "",
  displayClassName = "",
  editorClassName = "",
  style,
  fitText = true,
  minFontSize = 8,
  allowOverflow = false,
  storyActive = false,
  onClick,
  onDoubleClick,
}: EditableNodeLabelProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const requestedFontSize = numericFontSize(style?.fontSize);

  const fitLabel = useCallback(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text || !fitText) {
      if (text) text.style.fontSize = `${requestedFontSize}px`;
      return;
    }

    const availableWidth = container.clientWidth;
    const availableHeight = container.clientHeight;
    if (!availableWidth || !availableHeight) {
      text.style.fontSize = `${requestedFontSize}px`;
      return;
    }

    let nextFontSize = requestedFontSize;
    text.style.fontSize = `${nextFontSize}px`;
    while (
      nextFontSize > minFontSize &&
      (text.scrollWidth > availableWidth + 1 || text.scrollHeight > availableHeight + 1)
    ) {
      nextFontSize -= 1;
      text.style.fontSize = `${nextFontSize}px`;
    }
  }, [fitText, minFontSize, requestedFontSize]);

  useLayoutEffect(() => {
    if (isEditing) return;
    fitLabel();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fitLabel);
    observer.observe(container);
    return () => observer.disconnect();
  }, [fitLabel, isEditing, value]);

  if (isEditing) {
    return (
      <MultilineLabelEditor
        value={value}
        onCommit={onCommit}
        onCancel={onCancel}
        ariaLabel={ariaLabel}
        editorClassName={editorClassName}
        style={style}
      />
    );
  }

  return (
    <span
      ref={containerRef}
      className={`dm-node-label flex w-full max-w-full px-1 ${
        allowOverflow
          ? "min-h-full items-start overflow-visible"
          : "h-full items-center overflow-hidden"
      } ${className}`}
      data-story-active={storyActive ? "true" : undefined}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <span
        ref={textRef}
        className={`block w-full max-w-full whitespace-pre-wrap break-words leading-snug ${displayClassName}`}
        style={{
          ...style,
          fontSize: requestedFontSize,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </span>
    </span>
  );
}
