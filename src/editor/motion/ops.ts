import { sanitizeMotion, type MotionState } from "./model";

/** Re-normalize after any mutation (dead story targets, clamped ranges). */
export function normalizeMotion(
  motion: MotionState,
  knownNodeIds: ReadonlySet<string>,
  knownEdgeIds: ReadonlySet<string>,
): MotionState {
  return sanitizeMotion(motion, knownNodeIds, knownEdgeIds);
}
