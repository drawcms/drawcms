// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { GuideBar, type GuideSignals } from "./GuideBar";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  // Node's own experimental localStorage global shadows jsdom's, so the built-in
  // is not the Storage the guide's persistence actually writes to. Stub it
  // explicitly, the same way ChatGptButton.test.tsx does.
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

const signals = (overrides: Partial<GuideSignals> = {}): GuideSignals => ({
  nodeCount: 0,
  edgeCount: 0,
  motionSignature: "",
  storyStepCount: 0,
  selection: "",
  isAnimating: false,
  animateToggles: 0,
  stepsPanelOpens: 0,
  savedOrExported: 0,
  ...overrides,
});

/** Let the confirmation timer elapse so the guide moves to the next step. */
const flushConfirmation = async () => {
  await act(async () => {
    vi.advanceTimersByTime(1500);
  });
};

describe("hands-on guide", () => {
  it("opens on the first instruction and waits for the reader to act", () => {
    render(<GuideBar signals={signals()} />);
    expect(screen.getByText(/Press Animate/)).toBeTruthy();
    expect(screen.getByText("1 of 8")).toBeTruthy();
    // Back/Next are always available so the reader is never stuck on a step.
    expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
  });

  it("advances when the reader performs the step, confirming it first", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<GuideBar signals={signals()} />);
    expect(screen.getByText(/Press Animate to play/)).toBeTruthy();

    // The reader presses Animate.
    rerender(<GuideBar signals={signals({ isAnimating: true, animateToggles: 1 })} />);
    expect(screen.getByText(/Animate turns the whole-canvas motion loop/)).toBeTruthy();

    await flushConfirmation();
    expect(screen.getByText(/Click any shape or connector/)).toBeTruthy();
    expect(screen.getByText("2 of 8")).toBeTruthy();
  });

  it("does not credit the reader for motion a template started for them", async () => {
    vi.useFakeTimers();
    // Every template autoplays: the canvas is already looping before the guide
    // opens, so the first step has to both read correctly and stay incomplete.
    const autoplayed = signals({ isAnimating: true });
    const { rerender } = render(<GuideBar signals={autoplayed} />);
    expect(screen.getByText(/Motion is already looping/)).toBeTruthy();

    rerender(<GuideBar signals={{ ...autoplayed }} />);
    await flushConfirmation();
    expect(screen.getByText("1 of 8")).toBeTruthy();

    // Pausing it is a deliberate press, so it counts.
    rerender(<GuideBar signals={{ ...autoplayed, isAnimating: false, animateToggles: 1 }} />);
    await flushConfirmation();
    expect(screen.getByText("2 of 8")).toBeTruthy();
  });

  it("does not credit the reader for what the loaded template already had", async () => {
    vi.useFakeTimers();
    // The guided sample opens with shapes, connectors, presets and a story
    // already present. None of that should complete a step.
    const sample = signals({
      nodeCount: 4,
      edgeCount: 3,
      motionSignature: "e:1:Data Flow|e:2:Data Flow|e:3:Data Flow",
      storyStepCount: 3,
    });
    const { rerender } = render(<GuideBar signals={sample} />);

    // Re-render with the identical document: still on step 1, nothing credited.
    rerender(<GuideBar signals={{ ...sample }} />);
    await flushConfirmation();
    expect(screen.getByText("1 of 8")).toBeTruthy();
    expect(screen.getByText(/Press Animate/)).toBeTruthy();
  });

  it("measures each step from where the previous one finished", async () => {
    vi.useFakeTimers();
    const sample = signals({
      nodeCount: 4,
      edgeCount: 3,
      motionSignature: "e:1:Data Flow|e:2:Data Flow|e:3:Data Flow",
    });
    const { rerender } = render(<GuideBar signals={sample} />);

    // Step 1: animate.
    const animated = { ...sample, isAnimating: true, animateToggles: 1 };
    rerender(<GuideBar signals={animated} />);
    await flushConfirmation();
    // Step 2: select.
    rerender(<GuideBar signals={{ ...animated, selection: "n:gateway" }} />);
    await flushConfirmation();
    expect(screen.getByText("3 of 8")).toBeTruthy();

    // Step 3 wants a motion change. The sample's existing presets must not count.
    rerender(<GuideBar signals={{ ...animated, selection: "n:gateway" }} />);
    await flushConfirmation();
    expect(screen.getByText("3 of 8")).toBeTruthy();

    // Applying one more preset completes it.
    rerender(
      <GuideBar
        signals={{
          ...animated,
          selection: "n:gateway",
          motionSignature: "e:1:Pulse|e:2:Data Flow|e:3:Data Flow",
        }}
      />,
    );
    await flushConfirmation();
    expect(screen.getByText("4 of 8")).toBeTruthy();
  });

  it("credits selecting a different element when one was already selected", async () => {
    vi.useFakeTimers();
    // Resume at the select step with a selection already in place.
    window.localStorage.setItem("drawcms.onboarding.guide-step.v1", "1");
    const before = signals({ selection: "n:gateway" });
    const { rerender } = render(<GuideBar signals={before} />);

    // The same selection is not the reader clicking anything.
    rerender(<GuideBar signals={{ ...before }} />);
    await flushConfirmation();
    expect(screen.getByText("2 of 8")).toBeTruthy();

    rerender(<GuideBar signals={{ ...before, selection: "e:gateway-db" }} />);
    await flushConfirmation();
    expect(screen.getByText("3 of 8")).toBeTruthy();
  });

  it("rings the control a step is about and keeps it clickable", async () => {
    vi.useFakeTimers();
    // Stand in for the real Animate button in the top bar.
    const animate = document.createElement("button");
    animate.setAttribute("data-guide", "animate");
    animate.textContent = "Animate";
    // jsdom reports 0×0 by default; the guide treats that as "not on screen".
    animate.getBoundingClientRect = () =>
      ({ top: 20, left: 400, width: 120, height: 40 }) as DOMRect;
    document.body.appendChild(animate);

    render(<GuideBar signals={signals()} />);
    // The measurement runs inside an animation frame.
    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    const ring = document.querySelector("[data-guide-spotlight]") as HTMLElement | null;
    expect(ring).toBeTruthy();
    // Positioned around the control, with padding on each side.
    expect(ring!.style.top).toBe("14px");
    expect(ring!.style.left).toBe("394px");
    expect(ring!.style.width).toBe("132px");

    // The overlay must not swallow the click the reader has to make.
    const overlay = ring!.parentElement as HTMLElement;
    expect(overlay.className).toContain("pointer-events-none");
    // …while the instruction bubble itself stays interactive.
    expect(document.querySelector(".pointer-events-auto")).toBeTruthy();

    animate.remove();
  });

  it("falls back to a centred bubble when the step has no single control", async () => {
    vi.useFakeTimers();
    // Step 2 ("click any shape") targets the canvas, so nothing is ringed.
    window.localStorage.setItem("drawcms.onboarding.guide-step.v1", "1");
    render(<GuideBar signals={signals()} />);
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByText(/Click any shape or connector/)).toBeTruthy();
    expect(document.querySelector("[data-guide-spotlight]")).toBeNull();
  });

  it("dims the rest of the screen and lets Back return to the previous step", async () => {
    vi.useFakeTimers();
    const animate = document.createElement("button");
    animate.setAttribute("data-guide", "animate");
    animate.getBoundingClientRect = () =>
      ({ top: 20, left: 400, width: 120, height: 40 }) as DOMRect;
    document.body.appendChild(animate);

    render(<GuideBar signals={signals()} />);
    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    // The spotlight paints the dim with a huge spread shadow around the lit hole.
    const spotlight = document.querySelector("[data-guide-spotlight]") as HTMLElement;
    expect(spotlight.style.boxShadow).toContain("9999px");

    // Back is disabled on the first step…
    const back = screen.getByRole("button", { name: "Back" }) as HTMLButtonElement;
    expect(back.disabled).toBe(true);

    // …and returns to it from the second.
    await act(async () => {
      screen.getByRole("button", { name: "Next" }).click();
    });
    expect(screen.getByText("2 of 8")).toBeTruthy();
    await act(async () => {
      screen.getByRole("button", { name: "Back" }).click();
    });
    expect(screen.getByText("1 of 8")).toBeTruthy();

    animate.remove();
  });

  it("credits swapping a preset on an element that already animated", async () => {
    vi.useFakeTimers();
    // Resume at the Motion step. The connector already animates, so a count of
    // animated elements would never change and this step would hang forever.
    window.localStorage.setItem("drawcms.onboarding.guide-step.v1", "2");
    const before = signals({ edgeCount: 1, motionSignature: "e:1:Data Flow" });
    const { rerender } = render(<GuideBar signals={before} />);
    expect(screen.getByText("3 of 8")).toBeTruthy();

    // Same element, different preset: the fingerprint changes, the count does not.
    rerender(<GuideBar signals={{ ...before, motionSignature: "e:1:Pulse" }} />);
    await flushConfirmation();
    expect(screen.getByText("4 of 8")).toBeTruthy();
  });

  it("detects the closing steps instead of waiting on Next", async () => {
    vi.useFakeTimers();
    // The Steps panel comes before Add as step, and watches the button press
    // rather than the panel's open state — adding a step opens the panel too.
    window.localStorage.setItem("drawcms.onboarding.guide-step.v1", "5");
    const before = signals();
    const { rerender } = render(<GuideBar signals={before} />);
    expect(screen.getByText(/Press Steps to open/)).toBeTruthy();
    rerender(<GuideBar signals={{ ...before, stepsPanelOpens: 1 }} />);
    await flushConfirmation();
    expect(screen.getByText("7 of 8")).toBeTruthy();

    // Adding a story step moves on to the last one.
    rerender(<GuideBar signals={{ ...before, stepsPanelOpens: 1, storyStepCount: 1 }} />);
    await flushConfirmation();
    expect(screen.getByText("8 of 8")).toBeTruthy();

    // Save or export finishes the guide.
    rerender(
      <GuideBar
        signals={{ ...before, stepsPanelOpens: 1, storyStepCount: 1, savedOrExported: 1 }}
      />,
    );
    await flushConfirmation();
    expect(screen.queryByText("8 of 8")).toBeNull();
  });

  it("keeps the Steps step open when something else opened the panel", async () => {
    vi.useFakeTimers();
    window.localStorage.setItem("drawcms.onboarding.guide-step.v1", "5");
    // The panel is already on screen, but nobody pressed the button.
    const before = signals({ stepsPanelOpens: 0 });
    const { rerender } = render(<GuideBar signals={before} />);
    rerender(<GuideBar signals={{ ...before }} />);
    await flushConfirmation();
    expect(screen.getByText("6 of 8")).toBeTruthy();
  });

  it("finishes after the last step and reports completion once", async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    // Resume at the final step.
    window.localStorage.setItem("drawcms.onboarding.guide-step.v1", "7");
    render(<GuideBar signals={signals()} onDismiss={onDismiss} />);
    expect(screen.getByText("8 of 8")).toBeTruthy();

    await act(async () => {
      screen.getByRole("button", { name: "Finish" }).click();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("8 of 8")).toBeNull();
  });
});
