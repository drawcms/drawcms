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
  onSubmit: (input: { title: string; description?: string; durationMs?: number }) => void;
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

  const targetNames = targets.map((target) =>
    target.targetKind === "node"
      ? (knownNodes.find((node) => node.id === target.targetId)?.label ?? "Element")
      : (knownEdges.find((edge) => edge.id === target.targetId)?.label ?? "Connector"),
  );

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
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const nextTitle = title.trim();
            if (!nextTitle || targets.length === 0) return;
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
            });
            onOpenChange(false);
          }}
        >
          <div className="rounded-lg border border-border bg-muted p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Layers3 size={15} className="text-primary" aria-hidden="true" />
              {targets.length} {targets.length === 1 ? "item" : "items"} in this step
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {targetNames.join(", ")}
            </p>
          </div>

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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || targets.length === 0}>
              {mode === "create" ? "Add step" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
