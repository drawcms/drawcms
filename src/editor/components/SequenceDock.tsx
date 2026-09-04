"use client";

import { useEffect, useMemo, useState } from "react";
import { Play } from "lucide-react";
import {
  STORY_STEP_DEFAULT_DURATION_MS,
  type StoryScene,
  type StoryState,
  type StoryStep,
} from "../story/model";
import {
  PresentationControls,
  type PresentationControlScene,
  type PresentationControlStep,
} from "./PresentationControls";

/** Fallback pace for steps the author has not given an explicit duration. */
const AUTO_ADVANCE_MS = STORY_STEP_DEFAULT_DURATION_MS;

export interface SequenceDockProps {
  story: StoryState;
  knownNodes: { id: string; label: string }[];
  knownEdges: { id: string; label: string }[];
  /** Keeps the canvas highlight and item motion synchronized with the player. */
  onActiveStepChange?: (state: {
    scene: StoryScene | null;
    step: StoryStep | null;
    playing: boolean;
    mode: "loop" | "steps";
  }) => void;
}

interface PlaybackEntry {
  key: string;
  scene: StoryScene;
  step: StoryStep;
  sceneNumber: number;
  sceneCount: number;
  stepNumber: number;
  stepCount: number;
}

/** Read-only story navigation for preview, share pages, and embedded widgets. */
export function SequenceDock({
  story,
  knownNodes,
  knownEdges,
  onActiveStepChange,
}: SequenceDockProps) {
  const playableScenes = useMemo(
    () => story.scenes.filter((scene) => scene.steps.length > 0),
    [story.scenes],
  );
  const entries = useMemo<PlaybackEntry[]>(() => {
    return playableScenes.flatMap((scene, sceneIndex) =>
      scene.steps.map((step, stepIndex) => ({
        key: `${scene.id}:${step.id}:${stepIndex}`,
        scene,
        step,
        sceneNumber: sceneIndex + 1,
        sceneCount: playableScenes.length,
        stepNumber: stepIndex + 1,
        stepCount: scene.steps.length,
      })),
    );
  }, [playableScenes]);
  // activeSceneId belongs to the authoring inspector. Viewers always begin at
  // the first playable scene so preview, share, embed, and replay agree.
  // The dock also starts in loop mode: the canvas runs its motion presets
  // continuously, and step playback only starts when the viewer asks for it.
  const [mode, setMode] = useState<"loop" | "steps">("loop");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackGeneration, setPlaybackGeneration] = useState(0);
  const boundedCurrentIndex = Math.min(currentIndex, Math.max(0, entries.length - 1));
  const currentEntry = entries[boundedCurrentIndex] ?? null;
  const currentSceneEntries = useMemo(
    () => (currentEntry ? entries.filter((entry) => entry.scene.id === currentEntry.scene.id) : []),
    [currentEntry, entries],
  );
  const currentSceneStepIndex = currentEntry
    ? currentSceneEntries.findIndex((entry) => entry.key === currentEntry.key)
    : -1;

  useEffect(() => {
    if (mode !== "steps" || !playing || entries.length <= 1) return;
    // Each step holds for its own authored duration (falling back to the
    // default) rather than a single fixed interval for every step.
    const timer = window.setTimeout(() => {
      setCurrentIndex((index) => (index + 1) % entries.length);
    }, currentEntry?.step.durationMs ?? AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [currentEntry, entries.length, mode, playbackGeneration, playing]);

  useEffect(() => {
    onActiveStepChange?.({
      scene: mode === "steps" ? (currentEntry?.scene ?? null) : null,
      step: mode === "steps" ? (currentEntry?.step ?? null) : null,
      playing: mode === "steps" && playing,
      mode,
    });
  }, [currentEntry, mode, onActiveStepChange, playing]);

  const controls = useMemo<PresentationControlStep[]>(
    () =>
      currentSceneEntries.map(({ key, scene, step, sceneCount }) => ({
        id: key,
        title: step.title,
        ...(step.description ? { description: step.description } : {}),
        ...(sceneCount > 1 ? { context: scene.title } : {}),
        meta: `${step.targets.length} ${step.targets.length === 1 ? "item" : "items"}`,
      })),
    [currentSceneEntries],
  );
  const sceneControls = useMemo<PresentationControlScene[]>(
    () => playableScenes.map((scene) => ({ id: scene.id, title: scene.title })),
    [playableScenes],
  );

  const targetName = (targetId: string, targetKind: "node" | "edge") =>
    targetKind === "node"
      ? (knownNodes.find((node) => node.id === targetId)?.label ?? "Element")
      : (knownEdges.find((edge) => edge.id === targetId)?.label ?? "Connector");
  const emptyMessage = currentEntry
    ? `Highlights ${currentEntry.step.targets
        .map((target) => targetName(target.targetId, target.targetKind))
        .join(", ")}.`
    : "The author has not added presentation steps yet.";

  const startSteps = () => {
    setMode("steps");
    setCurrentIndex(0);
    setPlaying(true);
    setPlaybackGeneration((generation) => generation + 1);
  };

  const exitToLoop = () => {
    setMode("loop");
    setPlaying(false);
  };

  if (mode === "loop") {
    return (
      <section
        className="shrink-0 border-t border-border bg-card px-4 py-4 text-foreground sm:px-5"
        role="region"
        aria-label="Presentation playback"
      >
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={startSteps}
            disabled={entries.length === 0}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors duration-100 hover:bg-primary/90 active:bg-primary/80 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            Play Steps
          </button>
        </div>
      </section>
    );
  }

  return (
    <PresentationControls
      steps={controls}
      currentStepIndex={currentSceneStepIndex}
      playing={playing}
      sceneLabel={currentEntry?.scene.title}
      sceneProgress={
        currentEntry
          ? {
              current: currentEntry.sceneNumber,
              total: currentEntry.sceneCount,
              step: currentEntry.stepNumber,
              steps: currentEntry.stepCount,
            }
          : undefined
      }
      scenes={sceneControls}
      currentSceneId={currentEntry?.scene.id}
      emptyMessage={emptyMessage}
      onSelectStep={(index) => {
        const entry = currentSceneEntries[index];
        if (!entry) return;
        const globalIndex = entries.findIndex((candidate) => candidate.key === entry.key);
        if (globalIndex < 0) return;
        setCurrentIndex(globalIndex);
        setPlaying(false);
      }}
      onSelectScene={(sceneId) => {
        const index = entries.findIndex((entry) => entry.scene.id === sceneId);
        if (index < 0) return;
        setCurrentIndex(index);
        setPlaying(false);
      }}
      onExit={exitToLoop}
      onTogglePlay={() => setPlaying((value) => !value)}
    />
  );
}
