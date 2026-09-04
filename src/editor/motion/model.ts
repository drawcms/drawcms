import { z } from "zod";
import { createEmptyStory, sanitizeStory, storyStateSchema } from "../story/model";

/**
 * Motion model (DM-019, reduced to narrative-only per DM-034).
 *
 * DrawCMS elements animate through per-element legacy presets (node/edge
 * `data.preset`, `data.motionSpeed`, `data.motionLoop` — see
 * document/schema.ts `documentMotionSchema`). Document-level motion state
 * exists only to carry the presentation story: an earlier scene/track/step
 * timeline lived here too, but nothing ever played it back, so it was
 * removed rather than wired up. See
 * content/docs/decisions/003-single-motion-model.md.
 */

export const motionStateSchema = z
  .object({
    /** Narrative presentation steps, independent from element motion settings. */
    story: storyStateSchema.optional(),
  })
  .passthrough();

export type MotionState = z.infer<typeof motionStateSchema>;

export function createEmptyMotion(): MotionState {
  return { story: createEmptyStory() };
}

/**
 * Normalize story targets and clamp step fields. Never throws: motion must
 * degrade safely even when the referenced document changed around it.
 */
export function sanitizeMotion(
  motion: MotionState,
  knownNodeIds: ReadonlySet<string>,
  knownEdgeIds: ReadonlySet<string>,
): MotionState {
  const story = sanitizeStory(motion.story ?? createEmptyStory(), knownNodeIds, knownEdgeIds);
  return { ...motion, story };
}

/**
 * Reconcile only when graph edits orphan an authored story target.
 * Preserving object identity for already-valid motion avoids unnecessary
 * editor state updates while node positions or edge geometry are changing.
 */
export function reconcileMotionTargets(
  motion: MotionState,
  knownNodeIds: ReadonlySet<string>,
  knownEdgeIds: ReadonlySet<string>,
): MotionState {
  const targetExists = (target: { targetId: string; targetKind: "node" | "edge" }) =>
    target.targetKind === "node"
      ? knownNodeIds.has(target.targetId)
      : knownEdgeIds.has(target.targetId);

  const hasOrphanedStoryTarget = motion.story?.scenes.some((scene) =>
    scene.steps.some((step) => step.targets.some((target) => !targetExists(target))),
  );

  return hasOrphanedStoryTarget ? sanitizeMotion(motion, knownNodeIds, knownEdgeIds) : motion;
}
