import { z } from "zod";

export const storyTargetSchema = z
  .object({
    targetId: z.string().min(1).max(250),
    targetKind: z.enum(["node", "edge"]),
  })
  .passthrough();

/** Auto-advance duration bounds for untimed steps and clamping (ms). */
export const STORY_STEP_MIN_DURATION_MS = 500;
export const STORY_STEP_MAX_DURATION_MS = 30_000;
export const STORY_STEP_DEFAULT_DURATION_MS = 4_000;

export const storyStepSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    targets: z.array(storyTargetSchema).min(1).max(100),
    /** How long this step holds before auto-advancing during playback. */
    durationMs: z
      .number()
      .min(STORY_STEP_MIN_DURATION_MS)
      .max(STORY_STEP_MAX_DURATION_MS)
      .optional(),
  })
  .passthrough();

export const storySceneSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    steps: z.array(storyStepSchema).max(2_000),
  })
  .passthrough();

export const storyStateSchema = z
  .object({
    scenes: z.array(storySceneSchema).min(1).max(100),
    activeSceneId: z.string().min(1).optional(),
  })
  .passthrough();

export type StoryTarget = z.infer<typeof storyTargetSchema>;
export type StoryStep = z.infer<typeof storyStepSchema>;
export type StoryScene = z.infer<typeof storySceneSchema>;
export type StoryState = z.infer<typeof storyStateSchema>;

export function createEmptyStory(): StoryState {
  return {
    scenes: [{ id: "story-scene-1", title: "Scene 1", steps: [] }],
    activeSceneId: "story-scene-1",
  };
}

/**
 * Preserve authored copy from the old timed-motion sequence when opening a
 * document created before narrative steps were separated from animation.
 */
export function storyFromLegacyMotion(motion: {
  scenes: Array<{
    id: string;
    name: string;
    tracks: Array<{
      targetId: string;
      targetKind: "node" | "edge";
      steps: Array<{
        id: string;
        label?: string;
        description?: string;
        at: number;
        delay?: number;
      }>;
    }>;
  }>;
  activeSceneId?: string;
}): StoryState {
  if (motion.scenes.length === 0) return createEmptyStory();

  const scenes = motion.scenes.map((scene, sceneIndex) => ({
    id: `story-${scene.id}`,
    title: scene.name.trim() || `Scene ${sceneIndex + 1}`,
    steps: scene.tracks
      .flatMap((track, trackIndex) =>
        track.steps.map((step, stepIndex) => ({ step, track, trackIndex, stepIndex })),
      )
      .sort(
        (a, b) =>
          a.step.at + (a.step.delay ?? 0) - (b.step.at + (b.step.delay ?? 0)) ||
          a.trackIndex - b.trackIndex ||
          a.stepIndex - b.stepIndex,
      )
      .map(({ step, track }, stepIndex) => ({
        id: `story-${step.id}`,
        title: step.label?.trim() || `Step ${stepIndex + 1}`,
        ...(step.description?.trim() ? { description: step.description.trim() } : {}),
        targets: [{ targetId: track.targetId, targetKind: track.targetKind }],
      })),
  }));

  const activeSceneId = motion.activeSceneId ? `story-${motion.activeSceneId}` : scenes[0].id;
  return {
    scenes,
    activeSceneId: scenes.some((scene) => scene.id === activeSceneId)
      ? activeSceneId
      : scenes[0].id,
  };
}

export function sanitizeStory(
  story: StoryState,
  knownNodeIds: ReadonlySet<string>,
  knownEdgeIds: ReadonlySet<string>,
): StoryState {
  const fallback = createEmptyStory();
  const scenes = (story.scenes.length > 0 ? story.scenes : fallback.scenes).map(
    (scene, sceneIndex) => ({
      ...scene,
      title: scene.title.trim().slice(0, 120) || `Scene ${sceneIndex + 1}`,
      ...(scene.description !== undefined
        ? { description: scene.description.trim().slice(0, 500) }
        : {}),
      steps: scene.steps
        .map((step, stepIndex) => ({
          ...step,
          title: step.title.trim().slice(0, 120) || `Step ${stepIndex + 1}`,
          ...(step.description !== undefined
            ? { description: step.description.trim().slice(0, 500) }
            : {}),
          ...(step.durationMs !== undefined
            ? {
                durationMs: Math.min(
                  STORY_STEP_MAX_DURATION_MS,
                  Math.max(STORY_STEP_MIN_DURATION_MS, step.durationMs),
                ),
              }
            : {}),
          targets: step.targets.filter((target) =>
            target.targetKind === "node"
              ? knownNodeIds.has(target.targetId)
              : knownEdgeIds.has(target.targetId),
          ),
        }))
        .filter((step) => step.targets.length > 0),
    }),
  );
  const activeSceneId = scenes.some((scene) => scene.id === story.activeSceneId)
    ? story.activeSceneId
    : scenes[0]?.id;
  return { ...story, scenes, activeSceneId };
}
