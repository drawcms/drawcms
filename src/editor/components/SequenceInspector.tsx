"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CopyPlus,
  Layers3,
  MonitorPlay,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  STORY_STEP_DEFAULT_DURATION_MS,
  type StoryState,
  type StoryStep,
  type StoryTarget,
} from "../story/model";
import {
  addStoryScene,
  moveStoryScene,
  moveStoryStep,
  removeStoryScene,
  removeStoryStep,
  setActiveStoryScene,
  updateStoryScene,
} from "../story/ops";

interface SequenceInspectorProps {
  story: StoryState;
  knownNodes: { id: string; label: string }[];
  knownEdges: { id: string; label: string }[];
  selectedTargets: StoryTarget[];
  onChange: (next: StoryState) => void;
  onCreateStep: (targets: StoryTarget[]) => void;
  onEditStep: (sceneId: string, step: StoryStep) => void;
  onPreview: () => void;
  onClose: () => void;
}

function targetName(
  target: StoryTarget,
  knownNodes: SequenceInspectorProps["knownNodes"],
  knownEdges: SequenceInspectorProps["knownEdges"],
) {
  return target.targetKind === "node"
    ? (knownNodes.find((node) => node.id === target.targetId)?.label ?? "Element")
    : (knownEdges.find((edge) => edge.id === target.targetId)?.label ?? "Connector");
}

export function SequenceInspector({
  story,
  knownNodes,
  knownEdges,
  selectedTargets,
  onChange,
  onCreateStep,
  onEditStep,
  onPreview,
  onClose,
}: SequenceInspectorProps) {
  const activeScene =
    story.scenes.find((scene) => scene.id === story.activeSceneId) ?? story.scenes[0];
  const [confirmingSceneDelete, setConfirmingSceneDelete] = useState(false);

  if (!activeScene) return null;

  const controlClass =
    "min-h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors hover:border-border focus-visible:ring-2 focus-visible:ring-ring";
  const iconButtonClass =
    "inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <aside
      className="flex h-full w-72 flex-col overflow-hidden rounded-lg border border-border bg-card"
      aria-label="Steps panel"
    >
      <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Presentation
          </p>
          <h2 className="mt-1 text-lg font-bold text-foreground">Steps</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Arrange the story. Motion stays on each item.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onPreview}
            disabled={!story.scenes.some((scene) => scene.steps.length > 0)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white transition-colors duration-100 hover:bg-neutral-800 active:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <MonitorPlay size={15} aria-hidden="true" />
            Preview
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close steps panel"
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-3 pt-1">
        <section className="rounded-lg border border-primary/30 bg-accent/70 p-3">
          <div className="flex items-center gap-2">
            <Layers3 size={16} className="text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">Create from selection</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Select one or more items, then right-click and choose Add as step.
          </p>
          <button
            type="button"
            onClick={() => onCreateStep(selectedTargets)}
            disabled={selectedTargets.length === 0}
            className={`mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              selectedTargets.length > 0
                ? "bg-primary text-primary-foreground hover:bg-primary"
                : "cursor-not-allowed bg-muted text-muted-foreground"
            }`}
          >
            <Plus size={16} aria-hidden="true" />
            {selectedTargets.length > 0
              ? `Add ${selectedTargets.length} selected ${selectedTargets.length === 1 ? "item" : "items"}`
              : "Select items first"}
          </button>
        </section>

        <section className="space-y-3" aria-labelledby="scene-settings-heading">
          <div className="flex items-center justify-between gap-2">
            <h3 id="scene-settings-heading" className="text-xs font-semibold text-foreground">
              Scene
            </h3>
            <button
              type="button"
              onClick={() => {
                onChange(addStoryScene(story));
                setConfirmingSceneDelete(false);
              }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CopyPlus size={15} aria-hidden="true" /> New scene
            </button>
          </div>

          <label className="block space-y-1.5" htmlFor="active-story-scene">
            <span className="text-xs font-medium text-foreground">Current scene</span>
            <span className="relative block">
              <select
                id="active-story-scene"
                value={activeScene.id}
                onChange={(event) => {
                  onChange(setActiveStoryScene(story, event.target.value));
                  setConfirmingSceneDelete(false);
                }}
                className={`${controlClass} appearance-none pr-10`}
              >
                {story.scenes.map((scene, index) => (
                  <option key={scene.id} value={scene.id}>
                    {index + 1}. {scene.title}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={15}
                className="pointer-events-none absolute right-3 top-3 text-muted-foreground"
                aria-hidden="true"
              />
            </span>
          </label>

          <label className="block space-y-1.5" htmlFor={`story-scene-title-${activeScene.id}`}>
            <span className="text-xs font-medium text-foreground">Scene title</span>
            <input
              key={`title-${activeScene.id}`}
              id={`story-scene-title-${activeScene.id}`}
              defaultValue={activeScene.title}
              maxLength={120}
              onBlur={(event) =>
                onChange(
                  updateStoryScene(story, activeScene.id, {
                    title: event.target.value,
                    description: activeScene.description,
                  }),
                )
              }
              className={controlClass}
            />
          </label>

          <label
            className="block space-y-1.5"
            htmlFor={`story-scene-description-${activeScene.id}`}
          >
            <span className="text-xs font-medium text-foreground">Scene description</span>
            <textarea
              key={`description-${activeScene.id}`}
              id={`story-scene-description-${activeScene.id}`}
              defaultValue={activeScene.description ?? ""}
              maxLength={500}
              rows={3}
              onBlur={(event) =>
                onChange(
                  updateStoryScene(story, activeScene.id, {
                    title: activeScene.title,
                    description: event.target.value,
                  }),
                )
              }
              placeholder="What should viewers understand in this scene?"
              className={`${controlClass} resize-none py-2`}
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange(moveStoryScene(story, activeScene.id, -1))}
              disabled={story.scenes[0]?.id === activeScene.id}
              aria-label="Move scene earlier"
              title="Move scene earlier"
              className={iconButtonClass}
            >
              <ArrowUp size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onChange(moveStoryScene(story, activeScene.id, 1))}
              disabled={story.scenes.at(-1)?.id === activeScene.id}
              aria-label="Move scene later"
              title="Move scene later"
              className={iconButtonClass}
            >
              <ArrowDown size={15} aria-hidden="true" />
            </button>
            <div className="flex-1" />
            {confirmingSceneDelete ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingSceneDelete(false)}
                  className="min-h-10 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange(removeStoryScene(story, activeScene.id));
                    setConfirmingSceneDelete(false);
                  }}
                  className="min-h-10 rounded-md bg-danger px-2.5 text-xs font-semibold text-danger-foreground hover:bg-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                >
                  Delete
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingSceneDelete(true)}
                disabled={story.scenes.length <= 1}
                aria-label="Delete current scene"
                title={story.scenes.length <= 1 ? "Keep at least one scene" : "Delete scene"}
                className={iconButtonClass}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="story-step-order-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="story-step-order-heading" className="text-xs font-semibold text-foreground">
              Step order
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {activeScene.steps.length} {activeScene.steps.length === 1 ? "step" : "steps"}
            </span>
          </div>

          {activeScene.steps.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted px-4 py-6 text-center">
              <p className="text-sm font-semibold text-foreground">No steps in this scene</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Select canvas items and right-click to add the first step.
              </p>
            </div>
          ) : (
            <ol className="space-y-2" aria-label="Presentation steps">
              {activeScene.steps.map((step, index) => (
                <li key={step.id} className="rounded-lg border border-border bg-card p-2.5">
                  <div className="flex items-start gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent font-mono text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => onEditStep(activeScene.id, step)}
                      className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {step.title}
                      </span>
                      {step.description && (
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                          {step.description}
                        </span>
                      )}
                      <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                        {step.targets
                          .slice(0, 3)
                          .map((target) => targetName(target, knownNodes, knownEdges))
                          .join(", ")}
                        {step.targets.length > 3 ? ` +${step.targets.length - 3}` : ""}
                        {" · "}
                        {((step.durationMs ?? STORY_STEP_DEFAULT_DURATION_MS) / 1000).toFixed(1)}s
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditStep(activeScene.id, step)}
                      aria-label={`Edit ${step.title}`}
                      title="Edit step"
                      className={iconButtonClass}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2 pl-9">
                    <button
                      type="button"
                      onClick={() => onChange(moveStoryStep(story, activeScene.id, step.id, -1))}
                      disabled={index === 0}
                      aria-label={`Move ${step.title} earlier`}
                      title="Move earlier"
                      className={iconButtonClass}
                    >
                      <ArrowUp size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(moveStoryStep(story, activeScene.id, step.id, 1))}
                      disabled={index === activeScene.steps.length - 1}
                      aria-label={`Move ${step.title} later`}
                      title="Move later"
                      className={iconButtonClass}
                    >
                      <ArrowDown size={14} aria-hidden="true" />
                    </button>
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() => onChange(removeStoryStep(story, activeScene.id, step.id))}
                      aria-label={`Delete ${step.title}`}
                      title="Delete step"
                      className={`${iconButtonClass} hover:border-danger/25 hover:bg-danger-soft hover:text-danger`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </aside>
  );
}
