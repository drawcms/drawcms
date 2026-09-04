"use client";

import { ChevronDown, Pause, Play, X } from "lucide-react";

export interface PresentationControlStep {
  id: string;
  title: string;
  description?: string;
  /** Optional group name, such as the scene containing this step. */
  context?: string;
  /** Short secondary value, such as a duration or highlighted-item count. */
  meta?: string;
}

export interface PresentationSceneProgress {
  /** One-based current scene number among scenes that contain steps. */
  current: number;
  total: number;
  /** One-based current step number inside the current scene. */
  step: number;
  steps: number;
}

export interface PresentationControlScene {
  id: string;
  title: string;
}

export interface PresentationControlsProps {
  steps: PresentationControlStep[];
  currentStepIndex: number;
  playing: boolean;
  sceneLabel?: string;
  sceneProgress?: PresentationSceneProgress;
  scenes?: PresentationControlScene[];
  currentSceneId?: string;
  emptyMessage?: string;
  onSelectStep: (index: number) => void;
  onSelectScene?: (sceneId: string) => void;
  onExit: () => void;
  onTogglePlay: () => void;
  className?: string;
}

/**
 * Shared presentation chrome used by the landing sample, editor preview,
 * public share page, and embedded widget.
 */
export function PresentationControls({
  steps,
  currentStepIndex,
  playing,
  sceneLabel,
  sceneProgress,
  scenes = [],
  currentSceneId,
  emptyMessage = "No presentation steps have been added yet.",
  onSelectStep,
  onSelectScene,
  onExit,
  onTogglePlay,
  className = "",
}: PresentationControlsProps) {
  const currentStep = steps[currentStepIndex] ?? null;
  const hasSteps = steps.length > 0;
  const hasMultipleScenes = Boolean(sceneProgress && sceneProgress.total > 1);
  const hasScenePicker = Boolean(
    scenes.length > 1 && currentSceneId !== undefined && onSelectScene,
  );

  return (
    <section
      className={`shrink-0 border-t border-border bg-card text-foreground ${className}`}
      role="region"
      aria-label="Presentation steps"
    >
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0" aria-live="polite">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              {currentStep
                ? hasMultipleScenes
                  ? `Scene ${sceneProgress?.current} of ${sceneProgress?.total}`
                  : `Sequence ${currentStepIndex + 1} of ${steps.length}`
                : "Presentation"}
            </p>
            {sceneLabel && !hasScenePicker && (
              <span className="truncate text-xs text-muted-foreground">{sceneLabel}</span>
            )}
            {hasMultipleScenes && sceneProgress && (
              <span className="text-xs text-muted-foreground">
                Step {sceneProgress.step} of {sceneProgress.steps}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {currentStep?.title ?? "No steps to preview"}
          </p>
          <p className="mt-0.5 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
            {currentStep?.description || emptyMessage}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {hasScenePicker && (
            <label className="relative min-w-0">
              <span className="sr-only">Choose scene</span>
              <select
                aria-label="Choose scene"
                value={currentSceneId}
                onChange={(event) => onSelectScene?.(event.target.value)}
                className="min-h-11 max-w-48 appearance-none truncate rounded-md border border-border bg-card py-2 pl-3 pr-9 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {scenes.map((scene, index) => (
                  <option key={scene.id} value={scene.id}>
                    {index + 1}. {scene.title}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </label>
          )}
          <button
            type="button"
            onClick={onExit}
            disabled={!hasSteps}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground transition-colors duration-100 hover:bg-muted active:bg-muted disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Exit
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!hasSteps}
            aria-pressed={playing}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-100 hover:bg-primary active:bg-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {playing ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            {playing ? "Pause" : "Play"}
          </button>
        </div>
      </div>

      {hasSteps && (
        <ol
          className="flex overflow-x-auto border-t border-border"
          aria-label="Presentation step list"
        >
          {steps.map((step, index) => (
            <li key={step.id} className="min-w-48 flex-1 border-r border-border last:border-r-0">
              <button
                type="button"
                onClick={() => onSelectStep(index)}
                aria-current={currentStepIndex === index ? "step" : undefined}
                className={`flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 ${
                  currentStepIndex === index
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted"
                }`}
              >
                <span className="flex min-w-0 items-center gap-3 text-sm">
                  <span className="shrink-0 font-mono text-xs text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    {step.context && (
                      <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {step.context}
                      </span>
                    )}
                    <span className="truncate font-medium">{step.title}</span>
                  </span>
                </span>
                {step.meta && <span className="shrink-0 text-xs">{step.meta}</span>}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
