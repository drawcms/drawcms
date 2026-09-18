"use client";

import { useState } from "react";
import { Clock3, Layers3, Search, Type } from "lucide-react";
import { cn } from "../lib/utils";
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
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
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
  const searchTerm = query.trim().toLocaleLowerCase();
  const groups = [
    { kind: "node" as const, label: "Elements", items: knownNodes },
    { kind: "edge" as const, label: "Connectors", items: knownEdges },
  ].map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        (!selectedOnly || selectedKeys.has(`${group.kind}:${item.id}`)) &&
        item.label.toLocaleLowerCase().includes(searchTerm),
    ),
  }));
  const visibleCount = groups.reduce((count, group) => count + group.items.length, 0);
  const hasElements = knownNodes.length + knownEdges.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] gap-0 p-0 sm:max-w-3xl md:max-w-4xl [&>[data-slot=dialog-close]]:top-4 [&>[data-slot=dialog-close]]:right-4 [&>[data-slot=dialog-close]]:size-10">
        <DialogHeader className="shrink-0 gap-2 border-b px-5 py-5 pr-16 sm:px-6 sm:pr-16">
          <DialogTitle className="text-lg">
            {mode === "create" ? "Add presentation step" : "Edit step"}
          </DialogTitle>
          <DialogDescription>Tell the story and choose what to highlight.</DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
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
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="grid md:grid-cols-2">
              <section
                aria-labelledby="story-step-content-heading"
                className="min-w-0 space-y-4 p-5 sm:p-6"
              >
                <h3
                  id="story-step-content-heading"
                  className="flex items-center gap-2 text-sm font-semibold"
                >
                  <Type size={16} className="text-muted-foreground" aria-hidden="true" />
                  Step content
                </h3>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="story-step-title">
                    Title
                  </label>
                  <input
                    id="story-step-title"
                    autoComplete="off"
                    required
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={120}
                    placeholder="e.g. Request reaches the gateway"
                    className="min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <label className="text-sm font-medium" htmlFor="story-step-description">
                      Description
                    </label>
                    <span className="text-xs text-muted-foreground">Optional</span>
                  </div>
                  <textarea
                    id="story-step-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Explain what happens and why it matters."
                    aria-describedby="story-step-description-count"
                    className="block w-full resize-none rounded-lg border border-border bg-card px-3 py-3 text-sm leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <p
                    id="story-step-description-count"
                    className="text-right text-xs tabular-nums text-muted-foreground"
                  >
                    {description.length}/500
                  </p>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="story-step-duration"
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <Clock3 size={16} className="text-muted-foreground" aria-hidden="true" />
                      Hold duration
                    </label>
                    <output
                      htmlFor="story-step-duration"
                      className="rounded-md bg-muted px-2.5 py-1 text-sm font-semibold tabular-nums"
                    >
                      {durationSeconds.toFixed(1)}
                      <span className="ml-1 font-normal text-muted-foreground">s</span>
                    </output>
                  </div>
                  <div>
                    <input
                      id="story-step-duration"
                      type="range"
                      min={STORY_STEP_MIN_DURATION_MS / 1000}
                      max={STORY_STEP_MAX_DURATION_MS / 1000}
                      step={0.5}
                      value={durationSeconds}
                      onChange={(event) => setDurationSeconds(Number(event.target.value))}
                      aria-valuetext={`${durationSeconds} seconds`}
                      aria-describedby="story-step-duration-hint"
                      className="block h-10 w-full cursor-pointer accent-primary focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                    <div
                      className="flex justify-between text-xs tabular-nums text-muted-foreground"
                      aria-hidden="true"
                    >
                      <span>0.5s</span>
                      <span>30s</span>
                    </div>
                  </div>
                  <div className="flex gap-2" role="group" aria-label="Duration presets">
                    {[2, 4, 8].map((seconds) => (
                      <Button
                        key={seconds}
                        type="button"
                        variant="outline"
                        aria-pressed={durationSeconds === seconds}
                        onClick={() => setDurationSeconds(seconds)}
                        className="h-10 flex-1 text-xs aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary"
                      >
                        {seconds}s{seconds === 4 ? " · Default" : ""}
                      </Button>
                    ))}
                  </div>
                  <p
                    id="story-step-duration-hint"
                    className="text-xs leading-5 text-muted-foreground"
                  >
                    Time before the next step during autoplay.
                  </p>
                </div>
              </section>

              <section
                aria-labelledby="story-step-targets-heading"
                className="min-w-0 border-t bg-muted/30 p-5 sm:p-6 md:border-t-0 md:border-l"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3
                    id="story-step-targets-heading"
                    className="flex items-center gap-2 text-sm font-semibold"
                  >
                    <Layers3 size={16} className="text-muted-foreground" aria-hidden="true" />
                    Highlighted items
                  </h3>
                  <span
                    className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                    aria-live="polite"
                  >
                    {selectedCount} selected
                  </span>
                </div>
                <p
                  id="story-step-targets-hint"
                  className="mb-4 text-xs leading-5 text-muted-foreground"
                >
                  Choose the elements or connectors viewers should focus on.
                </p>

                <label className="sr-only" htmlFor="story-step-search">
                  Search items
                </label>
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    id="story-step-search"
                    type="search"
                    autoComplete="off"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search items…"
                    className="h-11 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div
                  className="my-3 flex gap-1 rounded-lg bg-muted p-1"
                  role="group"
                  aria-label="Filter items"
                >
                  {[
                    { label: "All items", selected: false },
                    { label: "Selected", selected: true },
                  ].map((filter) => (
                    <Button
                      key={filter.label}
                      type="button"
                      variant="ghost"
                      aria-pressed={selectedOnly === filter.selected}
                      onClick={() => setSelectedOnly(filter.selected)}
                      className="h-10 flex-1 text-xs text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>

                <div
                  role="group"
                  aria-label="Items in this step"
                  aria-describedby={
                    selectedCount === 0 ? "story-step-targets-error" : "story-step-targets-hint"
                  }
                  className="h-64 overflow-y-auto overscroll-contain rounded-lg border border-border bg-card p-1"
                >
                  {visibleCount > 0 ? (
                    groups.map(
                      (group) =>
                        group.items.length > 0 && (
                          <fieldset key={group.kind} className="min-w-0 pb-2">
                            <legend className="w-full px-3 pt-3 pb-2 text-xs font-medium text-muted-foreground">
                              {group.label}{" "}
                              <span className="ml-1 tabular-nums">{group.items.length}</span>
                            </legend>
                            {group.items.map((item) => (
                              <TargetRow
                                key={`${group.kind}:${item.id}`}
                                label={item.label}
                                kind={group.kind === "node" ? "Element" : "Connector"}
                                checked={selectedKeys.has(`${group.kind}:${item.id}`)}
                                onToggle={() => toggleTarget(group.kind, item.id)}
                              />
                            ))}
                          </fieldset>
                        ),
                    )
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center">
                      <Search size={20} className="text-muted-foreground" aria-hidden="true" />
                      <p className="text-sm font-medium">
                        {!hasElements
                          ? "No items yet"
                          : searchTerm
                            ? "No matching items"
                            : "No items selected"}
                      </p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {!hasElements
                          ? "Add elements to the diagram to highlight them in a step."
                          : searchTerm
                            ? "Try a different name or show all items."
                            : "Choose an element or connector from All items."}
                      </p>
                      {hasElements && (
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-1 h-10"
                          onClick={() => {
                            setQuery("");
                            setSelectedOnly(false);
                          }}
                        >
                          Show all items
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {selectedCount === 0 && (
                  <p
                    id="story-step-targets-error"
                    className="mt-3 text-xs font-medium text-destructive"
                    role="alert"
                  >
                    Select at least one element for this step.
                  </p>
                )}
              </section>
            </div>
          </div>

          <DialogFooter className="m-0 shrink-0 flex-row flex-wrap items-center gap-2 rounded-none bg-background px-5 py-4 sm:px-6">
            <p className="mr-auto hidden text-xs text-muted-foreground sm:block">
              Configure animations in the Motion tab.
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 sm:flex-none"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-11 flex-1 px-4 sm:flex-none"
              disabled={!title.trim() || selectedCount === 0}
            >
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
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-2.5 rounded-md border border-transparent px-3 py-2.5 text-sm text-foreground hover:bg-muted has-focus-visible:ring-2 has-focus-visible:ring-inset has-focus-visible:ring-ring",
        checked && "border-primary/20 bg-primary/5 hover:bg-primary/10",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-border accent-primary"
      />
      <span className="min-w-0 flex-1 leading-5 [overflow-wrap:anywhere]">{label}</span>
      <span className="sr-only">{kind}</span>
    </label>
  );
}
