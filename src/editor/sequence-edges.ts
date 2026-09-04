import { type AppEdge, type SequenceEdgeType } from "./types";

export const SEQUENCE_LIFELINE_TYPES = new Set(["sequence-actor", "sequence-participant"]);
export const SEQUENCE_ROW_COUNT = 12;
export const SEQUENCE_ROW_START_PERCENT = 36;
export const SEQUENCE_ROW_STEP_PERCENT = 5;

export function sequenceRowHandle(row: number) {
  return `sequence-row-${Math.max(1, Math.min(SEQUENCE_ROW_COUNT, Math.round(row)))}`;
}

/** A row's vertical position as a fraction (0..1) of the lifeline height. */
export function sequenceRowFraction(row: number): number {
  const clamped = Math.max(1, Math.min(SEQUENCE_ROW_COUNT, row));
  return (SEQUENCE_ROW_START_PERCENT + (clamped - 1) * SEQUENCE_ROW_STEP_PERCENT) / 100;
}

/** A row's absolute vertical position for a lifeline of the given band. */
export function sequenceRowY(lifelineY: number, lifelineHeight: number, row: number): number {
  return lifelineY + lifelineHeight * sequenceRowFraction(row);
}

/**
 * Activation-bar geometry spanning the given message rows. The activation
 * artwork occupies y=23..78 of its stretchable viewBox, so its bounds are
 * derived from that band rather than a magic offset (shared by the built-in
 * templates and agent-built sequence diagrams — see document/templates.ts
 * and webmcp/tools.ts).
 */
export function sequenceActivationBounds(
  lifelineY: number,
  lifelineHeight: number,
  firstRow: number,
  lastRow: number,
): { y: number; height: number } {
  const visibleTop = sequenceRowY(lifelineY, lifelineHeight, firstRow);
  const visibleBottom = sequenceRowY(lifelineY, lifelineHeight, lastRow);
  const height = (visibleBottom - visibleTop) / 0.55;
  const y = visibleTop - height * 0.23;
  return { y, height };
}

export function sequenceRowFromHandle(handle: string | null | undefined) {
  const match = /^sequence-row-(\d+)$/.exec(handle ?? "");
  if (!match) return null;
  const row = Number(match[1]);
  return Number.isInteger(row) && row >= 1 && row <= SEQUENCE_ROW_COUNT ? row : null;
}

export function nextSequenceRow(edges: AppEdge[], needsReturnRow = false) {
  const usedRows = edges.flatMap((edge) =>
    [sequenceRowFromHandle(edge.sourceHandle), sequenceRowFromHandle(edge.targetHandle)].filter(
      (row): row is number => row !== null,
    ),
  );
  const next = (usedRows.length > 0 ? Math.max(...usedRows) : 0) + 1;
  return Math.min(next, needsReturnRow ? SEQUENCE_ROW_COUNT - 1 : SEQUENCE_ROW_COUNT);
}

export interface CreateSequenceEdgeInput {
  id: string;
  sequenceType: SequenceEdgeType;
  label: string;
  source: string;
  target: string;
  row: number;
}

export function createSequenceEdge({
  id,
  sequenceType,
  label,
  source,
  target,
  row,
}: CreateSequenceEdgeInput): AppEdge {
  const isSelfMessage = sequenceType === "sequence-message-self";
  const sourceRow = Math.min(row, isSelfMessage ? SEQUENCE_ROW_COUNT - 1 : SEQUENCE_ROW_COUNT);
  const targetRow = isSelfMessage ? sourceRow + 1 : sourceRow;

  return {
    id,
    source,
    target,
    zIndex: 2,
    sourceHandle: sequenceRowHandle(sourceRow),
    targetHandle: sequenceRowHandle(targetRow),
    label,
    data: {
      label,
      sequenceType,
      routingMode: isSelfMessage ? "elbow" : "straight",
      ...(isSelfMessage ? { bend: { x: 64, y: 0 } } : {}),
    },
  };
}
