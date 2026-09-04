import type { StoryScene, StoryState, StoryStep } from "./model";

export interface StoryPlaybackEntry {
  scene: StoryScene;
  step: StoryStep;
  /** 0-based index of this step within its scene. */
  stepIndexInScene: number;
  /** 0-based index of this entry's scene among playable scenes. */
  sceneIndex: number;
}

/** Scenes with at least one step — matches SequenceDock.tsx's playable-scene filter. */
export function playableStoryScenes(story: StoryState): StoryScene[] {
  return story.scenes.filter((scene) => scene.steps.length > 0);
}

/**
 * Flatten every playable scene's steps into one ordered timeline (matches
 * SequenceDock.tsx's `entries`), so every consumer walks through the same
 * steps in the same order as the human presentation dock.
 */
export function flattenStoryPlayback(story: StoryState): StoryPlaybackEntry[] {
  const scenes = playableStoryScenes(story);
  return scenes.flatMap((scene, sceneIndex) =>
    scene.steps.map((step, stepIndexInScene) => ({ scene, step, stepIndexInScene, sceneIndex })),
  );
}

/** Locate an entry by step id, or by scene id (its first step), or neither (not found: -1). */
export function findStoryPlaybackEntryIndex(
  entries: StoryPlaybackEntry[],
  query: { sceneId?: string; stepId?: string },
): number {
  if (query.stepId) {
    return entries.findIndex(
      (entry) =>
        entry.step.id === query.stepId && (!query.sceneId || entry.scene.id === query.sceneId),
    );
  }
  if (query.sceneId) {
    return entries.findIndex((entry) => entry.scene.id === query.sceneId);
  }
  return -1;
}
