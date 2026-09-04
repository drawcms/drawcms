import { generateId } from "../lib/id";
import type { StoryScene, StoryState, StoryStep, StoryTarget } from "./model";

function mapScene(story: StoryState, sceneId: string, map: (scene: StoryScene) => StoryScene) {
  return {
    ...story,
    scenes: story.scenes.map((scene) => (scene.id === sceneId ? map(scene) : scene)),
  };
}

export function addStoryStep(
  story: StoryState,
  sceneId: string,
  draft: { title: string; description?: string; targets: StoryTarget[]; durationMs?: number },
): StoryState {
  const step: StoryStep = {
    id: generateId(),
    title: draft.title.trim().slice(0, 120),
    ...(draft.description?.trim() ? { description: draft.description.trim().slice(0, 500) } : {}),
    targets: draft.targets.map((target) => ({ ...target })),
    ...(draft.durationMs !== undefined ? { durationMs: draft.durationMs } : {}),
  };
  return mapScene(story, sceneId, (scene) => ({ ...scene, steps: [...scene.steps, step] }));
}

export function updateStoryStep(
  story: StoryState,
  sceneId: string,
  stepId: string,
  patch: Pick<StoryStep, "title" | "description" | "targets" | "durationMs">,
): StoryState {
  return mapScene(story, sceneId, (scene) => ({
    ...scene,
    steps: scene.steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            title: patch.title.trim().slice(0, 120),
            ...(patch.description?.trim()
              ? { description: patch.description.trim().slice(0, 500) }
              : { description: undefined }),
            targets: patch.targets.map((target) => ({ ...target })),
            durationMs: patch.durationMs,
          }
        : step,
    ),
  }));
}

export function removeStoryStep(story: StoryState, sceneId: string, stepId: string): StoryState {
  return mapScene(story, sceneId, (scene) => ({
    ...scene,
    steps: scene.steps.filter((step) => step.id !== stepId),
  }));
}

export function moveStoryStep(
  story: StoryState,
  sceneId: string,
  stepId: string,
  direction: -1 | 1,
): StoryState {
  return mapScene(story, sceneId, (scene) => {
    const index = scene.steps.findIndex((step) => step.id === stepId);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= scene.steps.length) return scene;
    const steps = [...scene.steps];
    [steps[index], steps[destination]] = [steps[destination], steps[index]];
    return { ...scene, steps };
  });
}

export function addStoryScene(story: StoryState): StoryState {
  const scene: StoryScene = {
    id: generateId(),
    title: `Scene ${story.scenes.length + 1}`,
    steps: [],
  };
  return { ...story, scenes: [...story.scenes, scene], activeSceneId: scene.id };
}

export function setActiveStoryScene(story: StoryState, sceneId: string): StoryState {
  return story.scenes.some((scene) => scene.id === sceneId)
    ? { ...story, activeSceneId: sceneId }
    : story;
}

export function updateStoryScene(
  story: StoryState,
  sceneId: string,
  patch: Pick<StoryScene, "title" | "description">,
): StoryState {
  return mapScene(story, sceneId, (scene) => ({
    ...scene,
    title: patch.title.trim().slice(0, 120) || scene.title,
    ...(patch.description?.trim()
      ? { description: patch.description.trim().slice(0, 500) }
      : { description: undefined }),
  }));
}

export function removeStoryScene(story: StoryState, sceneId: string): StoryState {
  if (story.scenes.length <= 1) return story;
  const index = story.scenes.findIndex((scene) => scene.id === sceneId);
  if (index < 0) return story;
  const scenes = story.scenes.filter((scene) => scene.id !== sceneId);
  const fallback = scenes[Math.min(index, scenes.length - 1)];
  return {
    ...story,
    scenes,
    activeSceneId: story.activeSceneId === sceneId ? fallback.id : story.activeSceneId,
  };
}

export function moveStoryScene(story: StoryState, sceneId: string, direction: -1 | 1): StoryState {
  const index = story.scenes.findIndex((scene) => scene.id === sceneId);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= story.scenes.length) return story;
  const scenes = [...story.scenes];
  [scenes[index], scenes[destination]] = [scenes[destination], scenes[index]];
  return { ...story, scenes };
}
