"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { loadGuideStep, saveGuideStep } from "../onboarding/state";

/**
 * Live editor signals the guide watches to tell whether the reader actually
 * performed the step. Counts rather than booleans so the guide can compare
 * against a baseline taken when it mounted: the guided sample already ships
 * shapes, connectors, motion presets, and a story, so "does a preset exist"
 * would be true before the reader touched anything. "Did a new preset appear
 * since you started" is the question that actually means they did it.
 */
export interface GuideSignals {
  nodeCount: number;
  edgeCount: number;
  /**
   * Fingerprint of every element's motion preset, not a count. A count cannot
   * see the common case: the reader selects a connector that already animates
   * and swaps its preset — the number of animated elements never changes, so a
   * count would leave that step stuck forever.
   */
  motionSignature: string;
  storyStepCount: number;
  /**
   * Id of the selected element, `""` when nothing is selected. An id rather
   * than a boolean so clicking a different element still registers when the
   * document opened with something already selected.
   */
  selection: string;
  /**
   * Whether the whole-canvas loop is running. Used to word the first step, not
   * to detect it — see `animateToggles`.
   */
  isAnimating: boolean;
  /**
   * Bumped only when the reader presses Animate themselves. A template that
   * autoplays turns `isAnimating` on without bumping this, so the guide cannot
   * congratulate the reader for motion the editor started for them.
   */
  animateToggles: number;
  /**
   * Bumped only when the reader presses Steps. Same reason as
   * `animateToggles`: the Add-as-step flow opens the panel on its own, and
   * clicking empty canvas closes it, so the panel's open state says nothing
   * about what the reader did.
   */
  stepsPanelOpens: number;
  /** Bumped each time the reader saves or exports. */
  savedOrExported: number;
}

interface GuideStep {
  /**
   * The instruction, written as something to do. A function when the wording
   * depends on where the document started — the first step cannot say "press
   * Animate to play" to a reader whose template is already playing.
   */
  text: string | ((from: GuideSignals) => string);
  /** Confirmation shown the moment the reader does it. */
  done: string;
  /**
   * CSS selector for the control this step is about. When it resolves, the
   * guide rings that control and anchors the instruction beside it, so the
   * reader is looking at the thing they need to use. Steps whose action happens
   * on the canvas have no single control and fall back to a centred bubble.
   */
  target?: string;
  /**
   * True once the reader has performed this step. `from` is the signal snapshot
   * taken when the guide mounted. Steps without a detectable signal return
   * false and wait for an explicit Next.
   */
  satisfied?: (now: GuideSignals, from: GuideSignals) => boolean;
}

const GUIDE_STEPS: readonly GuideStep[] = [
  {
    // The guided sample and every template autoplay, so this step has to read
    // correctly to a reader whose canvas is already moving.
    text: (from) =>
      from.isAnimating
        ? "Motion is already looping. Press Animate to pause it — that toggle drives the whole canvas."
        : "Press Animate to play every preset on the canvas.",
    done: "Animate turns the whole-canvas motion loop on and off.",
    target: '[data-guide="animate"]',
    satisfied: (now, from) => now.animateToggles > from.animateToggles,
  },
  {
    text: "Click any shape or connector on the canvas to select it.",
    done: "Its properties are now in the right panel.",
    satisfied: (now, from) => now.selection !== "" && now.selection !== from.selection,
  },
  {
    // The Motion tab only exists while something is selected, which the
    // previous step guarantees.
    text: "Open the Motion tab, then pick a preset for what you selected.",
    done: "Motion applied.",
    target: '[data-tab="Motion"]',
    satisfied: (now, from) => now.motionSignature !== from.motionSignature,
  },
  {
    // The elements panel ships collapsed to a rail; the expanded panel and the
    // rail carry different labels, so match either or the step loses its anchor.
    text: "Add a shape from the elements rail on the left: open a group, then pick a shape.",
    done: "New element added.",
    target: '[aria-label="Element library"], [aria-label="Element tools"]',
    satisfied: (now, from) => now.nodeCount > from.nodeCount,
  },
  {
    text: "Hover that shape, then drag from one of its handles to another shape.",
    done: "Connector drawn.",
    satisfied: (now, from) => now.edgeCount > from.edgeCount,
  },
  {
    // Deliberately before "Add as step": adding a step opens this panel by
    // itself, so asking the reader to open it afterwards would be asking for
    // something already done. Opened first, the panel is on screen to show the
    // step they create next appearing in it.
    text: "Press Steps to open the walkthrough panel, where you reorder and preview it.",
    done: "That panel is where the story is arranged.",
    target: '[aria-label="Open presentation steps"]',
    satisfied: (now, from) => now.stepsPanelOpens > from.stepsPanelOpens,
  },
  {
    text: "Now select a shape or connector, right-click it, and choose Add as step.",
    done: "That step is part of your walkthrough.",
    satisfied: (now, from) => now.storyStepCount > from.storyStepCount,
  },
  {
    text: "Last one: save a .drawcms file from the File menu, or export from Export.",
    done: "That is the whole loop \u2014 build, animate, narrate, share.",
    satisfied: (now, from) => now.savedOrExported > from.savedOrExported,
  },
];

/**
 * Stand-in for a baseline when the host has not handed over signals yet, so the
 * first instruction still renders readable text instead of crashing.
 */
const EMPTY_SIGNALS: GuideSignals = {
  nodeCount: 0,
  edgeCount: 0,
  motionSignature: "",
  storyStepCount: 0,
  selection: "",
  isAnimating: false,
  animateToggles: 0,
  stepsPanelOpens: 0,
  savedOrExported: 0,
};

/** How long the confirmation stays on screen before the next instruction. */
const CONFIRM_MS = 1100;

/** Breathing room between the ring and the control it surrounds. */
const RING_PAD = 6;

/** Gap between the lit control and the card, leaving room for the caret. */
const CARET = 10;

/** Nominal card size, used to choose a side and keep the card on screen. */
const CARD_W = 320;
const CARD_H = 150;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Track a step's target control on screen. Measurement is deliberately polled
 * as well as event-driven: panels here open, collapse, and re-layout without
 * firing resize or scroll, and a stale ring pointing at nothing is worse than
 * no ring at all.
 */
function useTargetBox(selector?: string): Box | null {
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    let raf = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const measure = () => {
      if (!selector) {
        setBox(null);
        return;
      }
      const element = document.querySelector(selector);
      if (!element) {
        setBox(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      // A control inside a collapsed panel measures zero: treat it as absent.
      if (rect.width === 0 || rect.height === 0) {
        setBox(null);
        return;
      }
      setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    // Every measurement runs inside an animation frame, so this effect never
    // writes state synchronously.
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    schedule();
    if (selector) {
      timer = setInterval(schedule, 400);
      window.addEventListener("resize", schedule);
      window.addEventListener("scroll", schedule, true);
    }
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearInterval(timer);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [selector]);

  return box;
}

/**
 * Hands-on guide (DM-021): one instruction at a time that the reader completes
 * by doing it in the editor, not by clicking Next. The guide watches live
 * editor signals, confirms the moment the action lands, and advances itself.
 * Next and Dismiss stay available so it can never trap anyone — including on
 * the two closing steps, which have no reliable signal to watch.
 */
export function GuideBar({
  signals,
  onDismiss,
}: {
  signals?: GuideSignals;
  onDismiss?: () => void;
}) {
  const [step, setStep] = useState<number>(() => loadGuideStep());
  const [hidden, setHidden] = useState(false);

  // Where the document started, so an element the template already had does not
  // count as something the reader just did. State rather than a ref because
  // `satisfied` compares against it during render.
  const [baseline, setBaseline] = useState<GuideSignals | null>(() => signals ?? null);

  // Latest signals, read inside the advance timer and the Skip handler without
  // making them depend on every signal tick. Written in an effect, never during
  // render.
  const signalsRef = useRef<GuideSignals | undefined>(undefined);
  useEffect(() => {
    signalsRef.current = signals;
  }, [signals]);

  // The guide renders under Suspense with signals already in hand from the host;
  // if a caller mounts it without them, `satisfied` simply returns false and the
  // reader moves with Back/Next. Capturing a late baseline from an effect would
  // buy nothing and cost a cascading render.

  // Held in a ref so the advance timer below does not depend on the caller
  // passing a stable callback: an inline arrow would otherwise restart the
  // confirmation timer on every render and the guide would never move on.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const current = step < GUIDE_STEPS.length ? GUIDE_STEPS[step] : undefined;
  const box = useTargetBox(hidden ? undefined : current?.target);

  const satisfied = useMemo(() => {
    if (!current?.satisfied || !signals || !baseline) return false;
    return current.satisfied(signals, baseline);
  }, [current, signals, baseline]);

  // Advance on completion: hold the confirmation briefly, then move on and
  // re-baseline so the next step measures from here. `satisfied` is a boolean,
  // so this effect only re-runs when completion actually flips — and if it flips
  // back (the reader undoes the action mid-confirmation) the cleanup cancels the
  // advance and a later completion schedules a fresh one.
  useEffect(() => {
    if (!satisfied || hidden) return;
    const timer = setTimeout(() => {
      if (signalsRef.current) setBaseline(signalsRef.current);
      setStep((value) => {
        const next = value + 1;
        saveGuideStep(next);
        if (next >= GUIDE_STEPS.length) onDismissRef.current?.();
        return next;
      });
    }, CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [satisfied, hidden, step]);

  if (hidden || !current) return null;

  const advance = () => {
    if (signalsRef.current) setBaseline(signalsRef.current);
    const next = step + 1;
    setStep(next);
    saveGuideStep(next);
    if (next >= GUIDE_STEPS.length) onDismiss?.();
  };

  const showingDone = satisfied && current.done.length > 0;
  const instruction =
    typeof current.text === "string" ? current.text : current.text(baseline ?? EMPTY_SIGNALS);

  const goBack = () => {
    if (step === 0) return;
    if (signalsRef.current) setBaseline(signalsRef.current);
    const previous = step - 1;
    setStep(previous);
    saveGuideStep(previous);
  };

  const card = (
    <>
      <p className="pr-6 text-[13px] leading-5 text-foreground">
        {showingDone ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-primary">
            <Check size={14} aria-hidden />
            {current.done}
          </span>
        ) : (
          instruction
        )}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {step + 1} of {GUIDE_STEPS.length}
        </span>
        <span className="flex items-center gap-1.5">
          <button
            onClick={goBack}
            disabled={step === 0}
            className="min-h-8 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
          >
            Back
          </button>
          <button
            onClick={advance}
            className="min-h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors duration-100 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            {step + 1 === GUIDE_STEPS.length ? "Finish" : "Next"}
          </button>
        </span>
      </div>
      <button
        onClick={() => {
          setHidden(true);
          onDismiss?.();
        }}
        aria-label="Dismiss guide"
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
      >
        <X size={13} />
      </button>
    </>
  );

  const cardShell =
    "pointer-events-auto absolute w-[min(20rem,calc(100vw-1.5rem))] rounded-lg bg-card p-3.5 shadow-lg ring-1 ring-border";

  // Anchored to a real control: dim everything else, leave the control lit, and
  // point a caret at it. The overlay is pointer-events-none apart from the card,
  // so the reader can still click the control being highlighted — the point of a
  // hands-on walkthrough rather than a slideshow.
  if (box) {
    const holeTop = box.top - RING_PAD;
    const holeLeft = box.left - RING_PAD;
    const holeWidth = box.width + RING_PAD * 2;
    const holeHeight = box.height + RING_PAD * 2;
    const holeRight = holeLeft + holeWidth;
    const holeBottom = holeTop + holeHeight;
    const centreX = holeLeft + holeWidth / 2;
    const centreY = holeTop + holeHeight / 2;

    const cardWidth = Math.min(CARD_W, window.innerWidth - 24);
    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), Math.max(min, max));

    // Below reads most naturally, but a control that lives inside a side panel
    // must not get the card dropped onto that panel's own contents — below the
    // Motion tab is the preset list this step is telling the reader to click.
    // So a target hugging a vertical edge gets the card on its inward side,
    // while a control pinned to the very top of the window, whose "below" is
    // open canvas, keeps below.
    const side: "below" | "above" | "left" | "right" =
      holeBottom < window.innerHeight * 0.12
        ? "below"
        : centreX > window.innerWidth * 0.66 && holeLeft > cardWidth + CARET + 12
          ? "left"
          : centreX < window.innerWidth * 0.34 &&
              window.innerWidth - holeRight > cardWidth + CARET + 12
            ? "right"
            : window.innerHeight - holeBottom > CARD_H + CARET
              ? "below"
              : "above";

    const horizontal = side === "left" || side === "right";
    const cardTop = horizontal
      ? clamp(centreY - CARD_H / 2, 12, window.innerHeight - CARD_H - 12)
      : side === "below"
        ? holeBottom + CARET
        : Math.max(12, holeTop - CARD_H - CARET);
    const cardLeft = horizontal
      ? side === "left"
        ? holeLeft - cardWidth - CARET
        : holeRight + CARET
      : clamp(centreX - cardWidth / 2, 12, window.innerWidth - cardWidth - 12);

    // Keep the caret over the control even when the card is clamped to an edge.
    // CARD_H is nominal, so on a card taller than that the caret lands slightly
    // off the hole's centre — close enough for a 10px decoration.
    const caretAlong = horizontal
      ? clamp(centreY - cardTop - 6, 14, CARD_H - 26)
      : clamp(centreX - cardLeft - 6, 14, cardWidth - 26);
    const caretStyle =
      side === "below"
        ? { top: -5, left: caretAlong }
        : side === "above"
          ? { bottom: -5, left: caretAlong }
          : side === "left"
            ? { right: -5, top: caretAlong }
            : { left: -5, top: caretAlong };

    return (
      // Above the top bar (z-40) so the dim and the ring are not hidden behind
      // it — the Animate toggle the first step points at lives up there — but
      // below dialogs (z-50), which must never be dimmed.
      <div className="pointer-events-none fixed inset-0 z-[45]">
        {/* One element paints the dim everywhere and the lit hole at once. */}
        <div
          aria-hidden
          data-guide-spotlight
          className="absolute rounded-lg ring-2 ring-white/80 transition-all duration-200 motion-reduce:transition-none"
          style={{
            top: holeTop,
            left: holeLeft,
            width: holeWidth,
            height: holeHeight,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)",
          }}
        />
        <div
          role="status"
          aria-live="polite"
          data-guide-card
          data-guide-side={side}
          className={cardShell}
          style={{ top: cardTop, left: cardLeft }}
        >
          <span aria-hidden className="absolute h-3 w-3 rotate-45 bg-card" style={caretStyle} />
          {card}
        </div>
      </div>
    );
  }

  // No single control to point at (canvas actions): centre the card and skip the
  // dim, so the canvas stays fully visible while the reader works on it.
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        role="status"
        aria-live="polite"
        data-guide-card
        className={`${cardShell} left-1/2 top-6 -translate-x-1/2`}
      >
        {card}
      </div>
    </div>
  );
}
