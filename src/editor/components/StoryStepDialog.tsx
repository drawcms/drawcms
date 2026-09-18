"use client";

import { useState } from "react";
import { Layers3 } from "lucide-react";
import {
  STORY_STEP_DEFAULT_DURATION_MS,
  STORY_STEP_MAX_DURATION_MS,
  STORY_STEP_MIN_DURATION_MS,
  type StoryTarget,
} from "../story/model";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

interface StoryStepDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initialTitle: string;
  initialDescription?: string;
  initialDurationMs?: number;
  targets: StoryTarget[];
  knownNodes: { id: string; label: string }[];
  knownEdges: { id: string; label: string }[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    title: string;
    description?: string;
    durationMs?: number;
    targets: StoryTarget[];
  }) => void;
}

export function StoryStepDialog({
  open,
  mode,
  initialTitle,
  initialDescription,
  initialDurationMs,
  targets,
  knownNodes,
  knownEdges,
  onOpenChange,
  onSubmit,
}: StoryStepDialogProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [durationSeconds, setDurationSeconds] = useState(
    (initialDurationMs ?? STORY_STEP_DEFAULT_DURATION_MS) / 1000,
  );
  // Which elements this step highlights, editable here so a person can fix a
  // step the agent (or a quick selection) got wrong — e.g. narrow a sequence
  // step from three participants down to the single message it should show.
  // Keyed as `${kind}:${id}` for set membership.
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(targets.map((t) => `${t.targetKind}:${t.targetId}`)),
  );

  const toggleTarget = (kind: "node" | "edge", id: string) => {
    const key = `${kind}:${id}`;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedTargets: StoryTarget[] = [
    ...knownNodes
      .filter((n) => selectedKeys.has(`node:${n.id}`))
      .map((n) => ({ targetId: n.id, targetKind: "node" as const })),
    ...knownEdges
      .filter((e) => selectedKeys.has(`edge:${e.id}`))
      .map((e) => ({ targetId: e.id, targetKind: "edge" as const })),
  ];
  const selectedCount = selectedTargets.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add presentation step" : "Edit step"}</DialogTitle>
          <DialogDescription>
            Add the information viewers should see. Configure animation separately in the Motion
            tab.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const nextTitle = title.trim();
            if (!nextTitle || selectedCount === 0) return;
            const clampedDurationMs = Math.round(
              Math.min(
                STORY_STEP_MAX_DURATION_MS,
                Math.max(STORY_STEP_MIN_DURATION_MS, durationSeconds * 1000),
              ),
            );
            onSubmit({
              title: nextTitle,
              ...(description.trim() ? { description: description.trim() } : {}),
              ...(clampedDurationMs !== STORY_STEP_DEFAULT_DURATION_MS
                ? { durationMs: clampedDurationMs }
                : {}),
              targets: selectedTargets,
            });
            onOpenChange(false);
          }}
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <fieldset className="space-y-1.5">
              <legend className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Layers3 size={15} className="text-primary" aria-hidden="true" />
                Items in this step
                <span className="font-normal text-muted-foreground">
                  ({selectedCount} selected)
                </span>
              </legend>
              <p className="text-xs leading-5 text-muted-foreground">
                Choose the elements this step highlights. For a sequence walkthrough, select the one
                message the step is about.
              </p>
              <div className="space-y-0.5 rounded-lg border border-border bg-card p-1">
                {knownNodes.length + knownEdges.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    This diagram has no elements yet.
                  </p>
                ) : (
                  <>
                    {knownNodes.map((node) => (
                      <TargetRow
                        key={`node:${node.id}`}
                        label={node.label}
                        kind="Element"
                        checked={selectedKeys.has(`node:${node.id}`)}
                        onToggle={() => toggleTarget("node", node.id)}
                      />
                    ))}
                    {knownEdges.map((edge) => (
                      <TargetRow
                        key={`edge:${edge.id}`}
                        label={edge.label}
                        kind="Connector"
                        checked={selectedKeys.has(`edge:${edge.id}`)}
                        onToggle={() => toggleTarget("edge", edge.id)}
                      />
                    ))}
                  </>
                )}
              </div>
              {selectedCount === 0 && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
                  Select at least one element for this step.
                </p>
              )}
            </fieldset>

            <label className="block space-y-1.5" htmlFor="story-step-title">
              <span className="text-sm font-medium text-foreground">Title</span>
              <input
                id="story-step-title"
                autoFocus
                autoComplete="off"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                placeholder="e.g. Request reaches the gateway"
                className="min-h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors hover:border-border focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <label className="block space-y-1.5" htmlFor="story-step-description">
              <span className="text-sm font-medium text-foreground">Description</span>
              <textarea
                id="story-step-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Explain what happens and why it matters."
                className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors hover:border-border focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="block text-right text-xs tabular-nums text-muted-foreground">
                {description.length}/500
              </span>
            </label>

            <label className="block space-y-1.5" htmlFor="story-step-duration">
              <span className="text-sm font-medium text-foreground">
                Hold for {durationSeconds.toFixed(1)}s before advancing
              </span>
              <input
                id="story-step-duration"
                type="range"
                min={STORY_STEP_MIN_DURATION_MS / 1000}
                max={STORY_STEP_MAX_DURATION_MS / 1000}
                step={0.5}
                value={durationSeconds}
                onChange={(event) => setDurationSeconds(Number(event.target.value))}
                className="w-full"
              />
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || selectedCount === 0}>
              {mode === "create" ? "Add step" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One selectable element in the step's item list. */
function TargetRow({
  label,
  kind,
  checked,
  onToggle,
}: {
  label: string;
  kind: "Element" | "Connector";
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="size-4 shrink-0 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {kind}
      </span>
    </label>
  );
}
