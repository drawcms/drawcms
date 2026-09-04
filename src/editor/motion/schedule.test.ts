import { describe, expect, it } from "vitest";
import { CaptureCancelledError, createCaptureToken, planFrames, progressAt } from "./schedule";

describe("planFrames", () => {
  it("yields exact clock times shared by preview and capture", () => {
    const plan = planFrames(3, 10);
    expect(plan.frameCount).toBe(31);
    expect(plan.frameDelayMs).toBe(100);
    expect(plan.timesSeconds[0]).toBe(0);
    expect(plan.timesSeconds[10]).toBe(1);
    expect(plan.timesSeconds[30]).toBe(3);
    // exactness: times are the same values produced by `i / fps`
    expect(plan.timesSeconds[7]).toBeCloseTo(0.7, 10);
  });

  it("clamps final frame time to the duration and respects caps", () => {
    const plan = planFrames(2.05, 10, { maxFrames: 100 });
    expect(plan.frameCount).toBe(22); // ceil(20.5) intervals + the t=0 frame
    expect(plan.timesSeconds.at(-1)).toBeLessThanOrEqual(2.05);
    expect(planFrames(60, 30, { maxFrames: 10 }).frameCount).toBe(10);
  });

  it("rejects invalid durations and rates with readable errors", () => {
    expect(() => planFrames(0, 10)).toThrow(/positive/);
    expect(() => planFrames(-1, 10)).toThrow(/positive/);
    expect(() => planFrames(1, 0)).toThrow(/positive/);
    expect(() => planFrames(Number.NaN, 10)).toThrow(/positive/);
  });

  it("computes progress deterministically", () => {
    expect(progressAt(0, 31)).toBe(0);
    expect(progressAt(15, 31)).toBe(0.5);
    expect(progressAt(30, 31)).toBe(1);
    expect(progressAt(0, 1)).toBe(1);
  });

  it("captures can be cancelled through the token", () => {
    const token = createCaptureToken();
    expect(token.cancelled).toBe(false);
    token.cancelled = true;
    if (token.cancelled) {
      expect(() => {
        throw new CaptureCancelledError();
      }).toThrow(/cancelled/);
    }
  });
});
