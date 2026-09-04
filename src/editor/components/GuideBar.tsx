"use client";

import { useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { loadGuideStep, saveGuideStep } from "../onboarding/state";

const GUIDE_STEPS = [
  "Pick a shape from the left palette, or drag one onto the canvas.",
  "Select a shape or connector, then open Motion in the properties panel.",
  "Drag between the small handles on a shape to draw a connector.",
  "Choose a preset, adjust its speed and loop, then preview the selection.",
  "Use Animate in the top bar to play or stop every preset on the canvas.",
  "Select one or more items, right-click, then choose Add as step to explain them.",
  "Use Steps beside Fit all elements to arrange the presentation order.",
  "Save or export from the File and Export menus in the top bar.",
] as const;

/**
 * Progressive hint bar (DM-021): one pointer at a time, persisted, and
 * dismissible. Reopened by resetting onboarding state via the File menu.
 */
export function GuideBar({ onDismiss }: { onDismiss?: () => void }) {
  const [step, setStep] = useState<number>(() => loadGuideStep());
  const [hidden, setHidden] = useState(false);

  if (hidden || step >= GUIDE_STEPS.length) return null;

  const advance = () => {
    const next = step + 1;
    setStep(next);
    saveGuideStep(next);
    if (next >= GUIDE_STEPS.length) onDismiss?.();
  };

  return (
    <div
      role="status"
      className="absolute left-3 right-3 top-3 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-card/95 px-3 py-2 text-sm text-foreground shadow-lg sm:left-1/2 sm:right-auto sm:top-20 sm:-translate-x-1/2 sm:flex-nowrap sm:gap-3 sm:rounded-full sm:px-4"
    >
      <Lightbulb size={14} className="shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1 sm:whitespace-nowrap">
        <span className="mr-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-primary">
          {step + 1}/{GUIDE_STEPS.length}
        </span>
        {GUIDE_STEPS[step]}
      </span>
      <button
        onClick={advance}
        className="min-h-10 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {step + 1 === GUIDE_STEPS.length ? "Finish" : "Next"}
      </button>
      <button
        onClick={() => {
          setHidden(true);
          onDismiss?.();
        }}
        aria-label="Dismiss guide"
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X size={12} />
      </button>
    </div>
  );
}
